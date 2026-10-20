// 파일 저장소. data/<id>.json 한 파일에 원문과 언어별 결과를 같이 담는다.
// 자격증명 없이 돌릴 때(로컬 개발, 테스트) 쓰는 쪽이다. 고르는 곳은 ../store.js.
//
// 함수는 전부 async다. Firestore 구현과 모양을 맞춰야 부르는 쪽이 한 가지만 알면 된다.

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
export async function nextId(prefix = 'diary') {
  for (let n = 1; n < 1000; n += 1) {
    const id = `${prefix}-${String(n).padStart(2, '0')}`;
    if (!fs.existsSync(fileOf(id))) return id;
  }
  throw new Error('id를 더 만들 수 없다');
}

export async function listDiaries() {
  if (!fs.existsSync(DIR)) return [];
  const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.json'));
  return files
    .map((f) => {
      const doc = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'));
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

export async function readDiary(id) {
  if (!isValidId(id)) throw new Error(`쓸 수 없는 id: ${id}`);
  return JSON.parse(fs.readFileSync(fileOf(id), 'utf8'));
}

export async function hasDiary(id) {
  return isValidId(id) && fs.existsSync(fileOf(id));
}

export async function writeDiary(doc) {
  if (!isValidId(doc.id)) throw new Error(`쓸 수 없는 id: ${doc.id}`);
  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(fileOf(doc.id), `${JSON.stringify(doc, null, 2)}\n`);
  return doc;
}

/**
 * 타이핑 중인 내용을 임시저장한다. 번역 결과는 건드리지 않는다.
 * typing[lang][sid][줄 번호] = zh는 칸마다 글자 배열, ja·en은 줄 문자열.
 */
export async function saveTyping(id, lang, typing) {
  const doc = await readDiary(id);
  doc.typing = doc.typing ?? {};
  doc.typing[lang] = typing;
  doc.typingUpdatedAt = new Date().toISOString();
  return await writeDiary(doc);
}

/** 일기를 지운다. 되돌릴 수 없으므로 화면에서 두 번 확인한 뒤에만 부른다. */
export async function removeDiary(id) {
  if (!isValidId(id)) throw new Error(`쓸 수 없는 id: ${id}`);
  fs.rmSync(fileOf(id));
}

/** Q&A 문답을 저장한다. 번역 결과와 타이핑은 건드리지 않는다. */
export async function saveQa(id, lang, turns) {
  const doc = await readDiary(id);
  doc.qa = doc.qa ?? {};
  doc.qa[lang] = turns;
  return await writeDiary(doc);
}
