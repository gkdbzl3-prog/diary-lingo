// data/*.json 을 Firestore로 옮긴다. 한 번만 돌리면 되지만 여러 번 돌려도 같은 결과다.
//
//   GOOGLE_APPLICATION_CREDENTIALS=<서비스 계정 키.json> pnpm migrate-firestore
//   … --dry  무엇을 옮길지만 보여 주고 쓰지 않는다
//
// 원본 파일은 지우지 않는다. 옮기고 나서 화면이 제대로 뜨는 걸 본 뒤에 치우면 된다.

import fs from 'node:fs';
import path from 'node:path';

const DIR = process.env.DIARY_LINGO_DATA ?? 'data';
const dry = process.argv.includes('--dry');

if (!process.env.FIREBASE_SERVICE_ACCOUNT && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error('자격증명이 없다. GOOGLE_APPLICATION_CREDENTIALS에 서비스 계정 키 경로를 넣어라.');
  process.exit(1);
}

// 파일을 읽을 때는 파일 저장소, 쓸 때는 Firestore다. 둘을 같이 쓰는 유일한 곳이다.
const files = await import('./store/files.js');
const firestore = await import('./store/firestore.js');

if (!fs.existsSync(DIR)) {
  console.error(`${DIR}/ 가 없다. 옮길 것이 없다.`);
  process.exit(1);
}

const ids = fs
  .readdirSync(DIR)
  .filter((f) => f.endsWith('.json'))
  .map((f) => path.basename(f, '.json'))
  .sort();

if (ids.length === 0) {
  console.log(`${DIR}/ 에 일기가 없다.`);
  process.exit(0);
}

let moved = 0;
for (const id of ids) {
  const doc = await files.readDiary(id);
  const langs = Object.keys(doc.langs ?? {});
  const already = await firestore.hasDiary(id);
  const mark = already ? '덮어씀' : '새로';

  if (dry) {
    console.log(`${id}  문장 ${doc.ko?.sentences?.length ?? 0}개 · ${langs.join(', ')} · ${mark}`);
    continue;
  }

  await firestore.writeDiary(doc);
  moved += 1;
  console.log(`${id} → Firestore (문장 ${doc.ko?.sentences?.length ?? 0}개 · ${langs.join(', ')} · ${mark})`);
}

if (dry) {
  console.log(`\n--dry 라서 쓰지 않았다. ${ids.length}개가 대상이다.`);
} else {
  console.log(`\n${moved}개 옮겼다. 원본 ${DIR}/ 는 그대로 뒀다.`);
}
process.exit(0);
