// 일기 저장소. 6단계에서 Firestore로 갈아타기 쉽게 읽고 쓰는 함수만 내보낸다.
// 지금은 data/<id>.json 한 파일에 원문과 언어별 결과를 같이 담는다.

import fs from 'node:fs';
import path from 'node:path';

const DIR = process.env.DIARY_LINGO_DATA ?? 'data';

function fileOf(id) {
  return path.join(DIR, `${id}.json`);
}

/** 파일 이름으로 쓸 수 있는 id만 허용한다. 경로 조작을 막는다. */
export function isValidId(id) {
  return typeof id === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(id) && !id.includes('..');
}

/** 일기 첫 문장 앞부분을 제목으로 쓴다. */
export function titleOf(text) {
  const first = text.trim().split(/\r?\n/)[0] ?? '';
  return first.length > 40 ? `${first.slice(0, 40)}…` : first;
}

/** 겹치지 않는 id를 만든다. diary-01, diary-02 … */
export function nextId(prefix = 'diary') {
  for (let n = 1; n < 1000; n += 1) {
    const id = `${prefix}-${String(n).padStart(2, '0')}`;
    if (!fs.existsSync(fileOf(id))) return id;
  }
  throw new Error('id를 더 만들 수 없다');
}

export function listDiaries() {
  if (!fs.existsSync(DIR)) return [];
  return fs
    .readdirSync(DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      const doc = readDiary(path.basename(f, '.json'));
      return {
        id: doc.id,
        title: doc.title,
        createdAt: doc.createdAt,
        sentenceCount: doc.ko?.sentences?.length ?? 0,
        langs: Object.keys(doc.langs ?? {}),
      };
    })
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

export function readDiary(id) {
  if (!isValidId(id)) throw new Error(`쓸 수 없는 id: ${id}`);
  return JSON.parse(fs.readFileSync(fileOf(id), 'utf8'));
}

export function hasDiary(id) {
  return isValidId(id) && fs.existsSync(fileOf(id));
}

export function writeDiary(doc) {
  if (!isValidId(doc.id)) throw new Error(`쓸 수 없는 id: ${doc.id}`);
  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(fileOf(doc.id), `${JSON.stringify(doc, null, 2)}\n`);
  return doc;
}
