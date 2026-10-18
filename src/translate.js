import { config } from './config.js';
import { askForJson } from './anthropic.js';
import { LANGS } from './langs.js';
import { buildContext, buildRequest } from './prompt.js';
import { validatePayload } from './validate.js';

/**
 * 문장 id를 config.chunkMax 이하로 고르게 쪼갠다.
 * 11개를 10 상한으로 쪼개면 [6, 5]가 된다. 마지막 묶음만 유난히 작아지지 않게.
 */
export function splitIntoChunks(ids, max) {
  if (ids.length === 0) return [];

  const count = Math.ceil(ids.length / max);
  const base = Math.floor(ids.length / count);
  const extra = ids.length % count; // 앞쪽 묶음에 하나씩 더 준다

  const chunks = [];
  let at = 0;
  for (let i = 0; i < count; i += 1) {
    const size = base + (i < extra ? 1 : 0);
    chunks.push(ids.slice(at, at + size));
    at += size;
  }
  return chunks;
}

/** 동시에 limit개까지만 돌린다. */
async function runLimited(items, limit, fn) {
  const queue = items.map((item, index) => ({ item, index }));
  const workers = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    while (queue.length > 0) {
      const { item, index } = queue.shift();
      await fn(item, index);
    }
  });
  await Promise.all(workers);
}

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
 * 한국어 문장 목록을 한 언어의 학습 데이터로 바꾼다.
 *
 * - 문장을 묶음으로 나눠 보내고, 1차 묶음만 혼자 먼저 보내 캐시를 채운다.
 *   전부 한꺼번에 보내면 아직 캐시가 없어 다 미스가 된다.
 * - 검증에 실패한 문장만 그 묶음 안에서 최대 config.maxRetries번 다시 물어본다.
 */
export async function translate({ lang, sentences, log = console.log }) {
  const mod = LANGS[lang];
  if (!mod) throw new Error(`모르는 언어: ${lang}`);

  const system = mod.buildSystemPrompt();
  const context = buildContext(sentences);
  const chunks = splitIntoChunks(
    sentences.map((s) => s.id),
    config.chunkMax,
  );

  const results = new Map();
  const notes = { vocab: [], highlights: [] };
  const usages = [];
  const failedIds = [];

  const runChunk = async (ids, index) => {
    const tag = `[${lang} ${index + 1}/${chunks.length}]`;
    let pending = [...ids];
    let problems = null;

    for (let attempt = 0; attempt <= config.maxRetries; attempt += 1) {
      if (pending.length === 0) break;

      const label = attempt === 0 ? '1차 호출' : `재요청 ${attempt}회`;
      log(`${tag} ${label} — 문장 ${pending.length}개: ${pending.join(', ')}`);

      const request = buildRequest({ allSentences: sentences, requestIds: pending, problems });

      let payload;
      let usage;
      try {
        ({ payload, usage } = await askForJson({
          system,
          context,
          request,
          schema: mod.schema,
        }));
      } catch (err) {
        log(`${tag} ! 호출 실패: ${err.message}`);
        break;
      }

      usages.push(usage);
      log(
        `${tag} 토큰: 입력 ${usage.input_tokens}` +
          ` / 캐시 쓰기 ${usage.cache_creation_input_tokens ?? 0}` +
          ` 읽기 ${usage.cache_read_input_tokens ?? 0}` +
          ` / 출력 ${usage.output_tokens}`,
      );

      const { ok, failed, global } = validatePayload(payload, pending, mod.checkSentence);

      for (const g of global) log(`${tag} ! ${g}`);
      for (const sentence of payload.sentences ?? []) {
        if (ok.includes(sentence.id)) results.set(sentence.id, sentence);
      }
      mergeNotes(notes, payload.notes);

      log(`${tag} 통과 ${ok.length}개${failed.size > 0 ? `, 실패 ${failed.size}개` : ''}`);
      for (const problem of [...failed.values()].flat()) log(`${tag} ! ${problem}`);

      pending = [...failed.keys()].sort((a, b) => a - b);
      problems = [...failed.values()].flat();
    }

    if (pending.length > 0) failedIds.push(...pending);
  };

  if (chunks.length > 0) {
    await runChunk(chunks[0], 0);
  }
  if (chunks.length > 1) {
    await runLimited(chunks.slice(1), config.chunkConcurrency, (ids, i) => runChunk(ids, i + 1));
  }

  // 묶음이 끝난 순서는 제각각이므로 문장 id 기준으로 다시 줄 세운다.
  const bySid = (a, b) => a.sid - b.sid;

  return {
    sentences: sentences
      .map((s) => s.id)
      .filter((id) => results.has(id))
      .map((id) => results.get(id)),
    notes: {
      vocab: [...notes.vocab].sort(bySid),
      highlights: [...notes.highlights].sort(bySid),
    },
    failedIds: failedIds.sort((a, b) => a - b),
    usages,
    chunkCount: chunks.length,
  };
}
