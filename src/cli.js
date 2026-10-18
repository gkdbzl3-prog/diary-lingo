import fs from 'node:fs';
import path from 'node:path';
import { splitKoreanDiary } from './sentences.js';
import { translate } from './translate.js';
import { SUPPORTED } from './langs.js';
import { config } from './config.js';

function parseArgs(argv) {
  const args = { langs: SUPPORTED, file: null, outDir: 'out' };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--lang') {
      const value = argv[++i] ?? '';
      args.langs = value === 'all' ? SUPPORTED : value.split(',').map((s) => s.trim()).filter(Boolean);
    } else if (a === '--out-dir') {
      args.outDir = argv[++i];
    } else if (!a.startsWith('--')) {
      args.file = a;
    }
  }
  return args;
}

function sumUsage(usages) {
  const total = { input: 0, cacheWrite: 0, cacheRead: 0, output: 0 };
  for (const u of usages) {
    total.input += u.input_tokens ?? 0;
    total.cacheWrite += u.cache_creation_input_tokens ?? 0;
    total.cacheRead += u.cache_read_input_tokens ?? 0;
    total.output += u.output_tokens ?? 0;
  }
  return total;
}

async function main() {
  const { langs, file, outDir } = parseArgs(process.argv.slice(2));

  if (!file) {
    console.error(`사용법: pnpm translate <일기파일> [--lang ${SUPPORTED.join(',')}|all] [--out-dir out]`);
    process.exit(1);
  }
  const unknown = langs.filter((l) => !SUPPORTED.includes(l));
  if (unknown.length > 0) {
    console.error(`모르는 언어: ${unknown.join(', ')} (되는 건: ${SUPPORTED.join(', ')})`);
    process.exit(1);
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY가 없다. .env에 넣어 두면 pnpm translate가 알아서 읽는다.');
    process.exit(1);
  }

  const text = fs.readFileSync(file, 'utf8');
  const { sentences } = splitKoreanDiary(text);

  console.log(`모델: ${config.model} (effort ${config.effort})`);
  console.log(`\n한국어 문장 분리: 문단 ${new Set(sentences.map((s) => s.p)).size}개, 문장 ${sentences.length}개`);
  for (const s of sentences) console.log(`  [p${s.p} #${s.id}] ${s.ko}`);
  console.log(`\n언어 ${langs.join(', ')}를 병렬로 호출한다. 묶음은 최대 ${config.chunkMax}문장씩.\n`);

  const base = path.basename(file).replace(/\.[^.]+$/, '');
  fs.mkdirSync(outDir, { recursive: true });

  const started = Date.now();

  // 언어별 병렬. 한 언어가 터져도 나머지는 끝까지 간다.
  const settled = await Promise.allSettled(
    langs.map(async (lang) => {
      const langStarted = Date.now();
      const result = await translate({ lang, sentences });
      const seconds = ((Date.now() - langStarted) / 1000).toFixed(1);

      const outPath = path.join(outDir, `${base}.${lang}.json`);
      const document = {
        meta: {
          source: file,
          model: config.model,
          effort: config.effort,
          createdAt: new Date().toISOString(),
          chunkCount: result.chunkCount,
          failedIds: result.failedIds,
        },
        ko: { sentences },
        lang,
        sentences: result.sentences,
        notes: result.notes,
      };
      fs.writeFileSync(outPath, `${JSON.stringify(document, null, 2)}\n`);

      return { lang, result, seconds, outPath };
    }),
  );

  const totalSeconds = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`\n--- 결과 (${totalSeconds}초) ---`);

  let bad = false;
  settled.forEach((entry, i) => {
    const lang = langs[i];
    if (entry.status === 'rejected') {
      bad = true;
      console.log(`[${lang}] 실패: ${entry.reason?.message ?? entry.reason}`);
      return;
    }
    const { result, seconds, outPath } = entry.value;
    const tokens = sumUsage(result.usages);
    console.log(
      `[${lang}] 문장 ${result.sentences.length}/${sentences.length}개 통과, ` +
        `묶음 ${result.chunkCount}개, 호출 ${result.usages.length}번, ${seconds}초`,
    );
    console.log(
      `       토큰: 입력 ${tokens.input} / 캐시 쓰기 ${tokens.cacheWrite} 읽기 ${tokens.cacheRead} / 출력 ${tokens.output}`,
    );
    console.log(
      `       vocab ${result.notes.vocab.length}개, highlights ${result.notes.highlights.length}개 → ${outPath}`,
    );
    if (result.failedIds.length > 0) {
      bad = true;
      console.log(`       끝까지 실패해서 빠진 문장: ${result.failedIds.join(', ')}`);
    }
  });

  if (bad) process.exitCode = 2;
}

main().catch((err) => {
  console.error(`\n실패: ${err.message}`);
  process.exit(1);
});
