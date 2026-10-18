// CLI가 만든 out/<이름>.<lang>.json 들을 data/<이름>.json 하나로 모은다.
// 화면을 보려고 번역을 다시 돌리지 않게 하는 개발용 도구.
//   pnpm import-out

import fs from 'node:fs';
import path from 'node:path';
import { SUPPORTED } from './langs.js';
import { titleOf, writeDiary } from './store.js';

const OUT = process.argv[2] ?? 'out';

if (!fs.existsSync(OUT)) {
  console.error(`${OUT}/ 이 없다. 먼저 pnpm translate 를 돌려야 한다.`);
  process.exit(1);
}

const byBase = new Map();
for (const file of fs.readdirSync(OUT)) {
  const m = file.match(/^(.+)\.([a-z]{2})\.json$/);
  if (!m || !SUPPORTED.includes(m[2])) continue;
  const [, base, lang] = m;
  if (!byBase.has(base)) byBase.set(base, new Map());
  byBase.get(base).set(lang, JSON.parse(fs.readFileSync(path.join(OUT, file), 'utf8')));
}

if (byBase.size === 0) {
  console.error(`${OUT}/ 에 가져올 게 없다.`);
  process.exit(1);
}

for (const [base, langs] of byBase) {
  const first = [...langs.values()][0];
  const sentences = first.ko?.sentences ?? [];

  // 원문 파일이 아직 있으면 그걸 쓰고, 없으면 문장을 문단별로 이어 붙인다.
  let text = '';
  const source = first.meta?.source;
  if (source && fs.existsSync(source)) {
    text = fs.readFileSync(source, 'utf8');
  } else {
    const paragraphs = [];
    for (const s of sentences) {
      const at = s.p - 1;
      paragraphs[at] = paragraphs[at] ? `${paragraphs[at]} ${s.ko}` : s.ko;
    }
    text = paragraphs.join('\n');
  }

  const doc = {
    id: base,
    title: titleOf(text),
    createdAt: first.meta?.createdAt ?? new Date().toISOString(),
    text,
    ko: { sentences },
    langs: {},
  };

  for (const [lang, d] of langs) {
    doc.langs[lang] = { meta: d.meta ?? {}, sentences: d.sentences ?? [], notes: d.notes ?? { vocab: [], highlights: [] } };
  }

  writeDiary(doc);
  console.log(`data/${base}.json ← ${[...langs.keys()].join(', ')} (문장 ${sentences.length}개)`);
}
