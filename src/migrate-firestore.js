// data/*.json 을 Firestore의 한 기기 코드 밑으로 옮긴다. 여러 번 돌려도 같은 결과다.
//
//   GOOGLE_APPLICATION_CREDENTIALS=<키.json> pnpm migrate-firestore <기기코드>
//   … --dry      무엇을 옮길지만 보여 주고 쓰지 않는다
//   … --from-legacy  data/ 대신 옛 Firestore 루트 컬렉션(diaries/)에서 가져온다
//   … --cleanup      옮기고 나서 옛 루트 컬렉션을 지운다 (--from-legacy와 같이)
//
// 기기 코드는 화면 맨 아래 "이 기기 코드"에 있다. 그 기기에서 사이트를 한 번 연 뒤에 돌려라.
// 원본(data/ 또는 옛 컬렉션)은 --cleanup 없이는 지우지 않는다.

import fs from 'node:fs';
import path from 'node:path';
import { isValidDevice } from './device.js';

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith('--')));
const device = args.find((a) => !a.startsWith('--'));
const dry = flags.has('--dry');
const fromLegacy = flags.has('--from-legacy');
const cleanup = flags.has('--cleanup');

const DIR = process.env.DIARY_LINGO_DATA ?? 'data';

if (!isValidDevice(device)) {
  console.error('기기 코드가 필요하다 (32자리). 화면 맨 아래 "이 기기 코드"를 넣어라.');
  console.error('  예: pnpm migrate-firestore 0123456789abcdef0123456789abcdef');
  process.exit(1);
}

if (!process.env.FIREBASE_SERVICE_ACCOUNT && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error('자격증명이 없다. GOOGLE_APPLICATION_CREDENTIALS에 서비스 계정 키 경로를 넣어라.');
  process.exit(1);
}

const firestore = await import('./store/firestore.js');
const target = firestore.storeFor(device);

/** 옛 저장 방식: Firestore 루트 `diaries/` 컬렉션 (기기 코드가 없던 때) */
async function fromLegacyCollection() {
  const db = firestore.db();
  const snap = await db.collection('diaries').get();
  const docs = [];
  for (const d of snap.docs) {
    const meta = d.data();
    const doc = {
      id: d.id,
      title: meta.title,
      createdAt: meta.createdAt,
      text: meta.text ?? '',
      ko: JSON.parse(meta.ko ?? '{}'),
      langs: {},
    };
    for (const part of ['langs', 'typing', 'qa']) {
      const sub = await d.ref.collection(part).get();
      if (sub.empty) continue;
      doc[part] = {};
      for (const one of sub.docs) doc[part][one.id] = JSON.parse(one.get('json'));
    }
    if (meta.typingUpdatedAt) doc.typingUpdatedAt = meta.typingUpdatedAt;
    docs.push(doc);
  }
  return docs;
}

/** 파일: data/*.json (기기 폴더가 없던 때의 평평한 구조) */
async function fromDataDir() {
  if (!fs.existsSync(DIR)) return [];
  return fs
    .readdirSync(DIR)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')));
}

const docs = fromLegacy ? await fromLegacyCollection() : await fromDataDir();

if (docs.length === 0) {
  console.log(fromLegacy ? '옛 컬렉션에 일기가 없다.' : `${DIR}/ 에 일기가 없다.`);
  process.exit(0);
}

for (const doc of docs) {
  const langs = Object.keys(doc.langs ?? {});
  const already = await target.hasDiary(doc.id);
  const mark = already ? '덮어씀' : '새로';
  if (dry) {
    console.log(`${doc.id}  문장 ${doc.ko?.sentences?.length ?? 0}개 · ${langs.join(', ')} · ${mark}`);
    continue;
  }
  await target.writeDiary(doc);
  console.log(`${doc.id} → users/${device}/diaries (문장 ${doc.ko?.sentences?.length ?? 0}개 · ${langs.join(', ')} · ${mark})`);
}

if (dry) {
  console.log(`\n--dry 라서 쓰지 않았다. ${docs.length}개가 대상이다.`);
  process.exit(0);
}

if (cleanup && fromLegacy) {
  const db = firestore.db();
  const snap = await db.collection('diaries').get();
  for (const d of snap.docs) {
    for (const part of ['langs', 'typing', 'qa']) {
      const sub = await d.ref.collection(part).get();
      for (const one of sub.docs) await one.ref.delete();
    }
    await d.ref.delete();
  }
  console.log(`옛 루트 컬렉션 diaries/ 를 지웠다 (${snap.size}개).`);
}

console.log(`\n${docs.length}개 옮겼다.`);
process.exit(0);
