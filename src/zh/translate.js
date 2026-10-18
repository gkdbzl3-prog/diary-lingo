import { config } from '../config.js';
import { askForJson } from '../anthropic.js';
import { zhSchema } from './schema.js';
import { buildSystemPrompt, buildUserPrompt, buildRetryPrompt } from './prompt.js';
import { validateZh } from './validate.js';

function mergeNotes(into, notes) {
  const push = (key, items, keyOf) => {
    if (!Array.isArray(items)) return;
    const seen = new Set(into[key].map(keyOf));
    for (const item of items) {
      const k = keyOf(item);
      if (seen.has(k)) continue;
      seen.add(k);
      into[key].push(item);
    }
  };
  push('vocab', notes?.vocab, (v) => `${v.expr}|${v.sid}`);
  push('highlights', notes?.highlights, (h) => `${h.title}|${h.sid}`);
}

/**
 * 한국어 문장 목록을 중국어 학습 데이터로 바꾼다.
 * 검증에 실패한 문장만 최대 config.maxRetries번 다시 물어본다.
 */
export async function translateZh({ sentences, log = console.log }) {
  const system = buildSystemPrompt();
  const results = new Map();
  const notes = { vocab: [], highlights: [] };
  const usages = [];

  let pending = sentences.map((s) => s.id);
  let problemsByAttempt = null;

  for (let attempt = 0; attempt <= config.maxRetries; attempt += 1) {
    if (pending.length === 0) break;

    const label = attempt === 0 ? '1차 호출' : `재요청 ${attempt}회`;
    log(`\n[${label}] 문장 ${pending.length}개: ${pending.join(', ')}`);

    const user =
      attempt === 0
        ? buildUserPrompt({ allSentences: sentences, requestIds: pending })
        : buildRetryPrompt({
            allSentences: sentences,
            requestIds: pending,
            problems: problemsByAttempt,
          });

    const { payload, usage } = await askForJson({ system, user, schema: zhSchema });
    usages.push(usage);
    log(
      `  토큰: 입력 ${usage.input_tokens} (캐시 읽기 ${usage.cache_read_input_tokens ?? 0}) / 출력 ${usage.output_tokens}`,
    );

    const { ok, failed, global } = validateZh(payload, pending);

    for (const g of global) log(`  ! ${g}`);
    for (const sentence of payload.sentences ?? []) {
      if (ok.includes(sentence.id)) results.set(sentence.id, sentence);
    }
    mergeNotes(notes, payload.notes);

    log(`  통과 ${ok.length}개${failed.size > 0 ? `, 실패 ${failed.size}개` : ''}`);
    for (const [id, problems] of failed) {
      for (const p of problems) log(`  ! ${p}`);
    }

    pending = [...failed.keys()].sort((a, b) => a - b);
    problemsByAttempt = [...failed.values()].flat();
  }

  return {
    sentences: sentences.map((s) => s.id).filter((id) => results.has(id)).map((id) => results.get(id)),
    notes,
    failedIds: pending,
    usages,
  };
}
