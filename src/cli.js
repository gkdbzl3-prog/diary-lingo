import fs from 'node:fs';
import path from 'node:path';
import { splitKoreanDiary } from './sentences.js';
import { translateZh } from './zh/translate.js';
import { config } from './config.js';

const SUPPORTED = ['zh'];

function parseArgs(argv) {
  const args = { lang: 'zh', file: null, out: null };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--lang') args.lang = argv[++i];
    else if (a === '--out') args.out = argv[++i];
    else if (!a.startsWith('--')) args.file = a;
  }
  return args;
}

async function main() {
  const { lang, file, out } = parseArgs(process.argv.slice(2));

  if (!file) {
    console.error('사용법: pnpm translate <일기파일> --lang zh');
    process.exit(1);
  }
  if (!SUPPORTED.includes(lang)) {
    console.error(`아직 ${lang}은 없다. 지금 되는 건: ${SUPPORTED.join(', ')} (2단계에서 ja·en 추가)`);
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

  const started = Date.now();
  const result = await translateZh({ sentences });
  const seconds = ((Date.now() - started) / 1000).toFixed(1);

  const base = path.basename(file).replace(/\.[^.]+$/, '');
  const outPath = out ?? path.join('out', `${base}.${lang}.json`);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });

  const document = {
    meta: {
      source: file,
      model: config.model,
      effort: config.effort,
      createdAt: new Date().toISOString(),
      failedIds: result.failedIds,
    },
    ko: { sentences },
    lang,
    sentences: result.sentences,
    notes: result.notes,
  };
  fs.writeFileSync(outPath, `${JSON.stringify(document, null, 2)}\n`);

  console.log(`\n--- 결과 ---`);
  console.log(`문장 ${result.sentences.length}/${sentences.length}개 통과, ${seconds}초`);
  if (result.failedIds.length > 0) {
    console.log(`끝까지 실패해서 빠진 문장: ${result.failedIds.join(', ')}`);
  }
  console.log(`vocab ${result.notes.vocab.length}개, highlights ${result.notes.highlights.length}개`);
  console.log(`저장: ${outPath}`);

  if (result.failedIds.length > 0) process.exitCode = 2;
}

main().catch((err) => {
  console.error(`\n실패: ${err.message}`);
  process.exit(1);
});
