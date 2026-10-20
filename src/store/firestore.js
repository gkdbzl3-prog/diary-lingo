// Firestore 저장소. 서버만 들어오므로 Admin SDK(서비스 계정)로 붙는다.
// 브라우저는 Firestore를 직접 건드리지 않는다 — 보안 규칙은 전부 잠가 두면 된다.
//
// 기기마다 제 칸을 쓴다. 남이 들어와도 다른 기기 코드를 받으므로 서로의 일기가 보이지 않는다.
//
//   users/{device}                              기기 메타 (처음·마지막으로 쓴 때)
//   users/{device}/diaries/{id}                 일기 메타 (제목·만든 때·문장 수·언어·원문)
//   users/{device}/diaries/{id}/langs/{lang}    언어별 번역 결과  ← 덩치가 여기 다 있다
//   users/{device}/diaries/{id}/typing/{lang}   타이핑 임시저장
//   users/{device}/diaries/{id}/qa/{lang}       문답
//
// 한 일기를 한 문서에 다 담으면 Firestore 1MiB 한도에 걸린다(11문장 3언어가 이미 116KB다).
// 언어별로 쪼개면 한 문서가 문장 300개쯤까지 간다.
//
// 덩치가 큰 값은 JSON 문자열 한 칸(`json`)에 담는다. 두 가지 이유다.
//   - Firestore는 배열 안의 배열을 못 받는다. 타이핑은 `[sid][줄][칸]`이라 바로 걸린다.
//   - 이 데이터는 통째로 읽고 통째로 쓴다. 안을 질의할 일이 없다.

import fs from 'node:fs';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { isValidId, titleOf } from './files.js';

// id 규칙과 제목 뽑기는 저장 방식과 상관없다. 파일 쪽 것을 그대로 쓴다.
export { isValidId, titleOf };

const USERS = process.env.DIARY_LINGO_COLLECTION ?? 'users';

/**
 * 자격증명을 찾는다. 둘 중 하나다.
 *   FIREBASE_SERVICE_ACCOUNT        서비스 계정 JSON 통째로 (fly secret 용)
 *   GOOGLE_APPLICATION_CREDENTIALS  그 JSON 파일 경로 (로컬 개발 용)
 */
function credential() {
  const inline = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (inline) return cert(JSON.parse(inline));

  const file = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (file) return cert(JSON.parse(fs.readFileSync(file, 'utf8')));

  throw new Error('Firestore 자격증명이 없다 (FIREBASE_SERVICE_ACCOUNT 또는 GOOGLE_APPLICATION_CREDENTIALS)');
}

let cached;

export function db() {
  if (!cached) {
    const app = getApps()[0] ?? initializeApp({ credential: credential() });
    cached = getFirestore(app);
    cached.settings({ ignoreUndefinedProperties: true });
  }
  return cached;
}

/** 기기 코드 하나에 매인 저장소를 돌려준다. 부르는 쪽은 제 기기 것만 본다. */
export function storeFor(device) {
  if (!isValidId(device)) throw new Error(`쓸 수 없는 기기 코드: ${device}`);

  const user = () => db().collection(USERS).doc(device);
  const diaries = () => user().collection('diaries');
  const docOf = (id) => diaries().doc(id);

  /** 하위 컬렉션(langs·typing·qa)을 언어별 문서로 읽어 { [lang]: 값 } 으로 돌려준다. */
  async function readPart(id, part) {
    const snap = await docOf(id).collection(part).get();
    const out = {};
    for (const d of snap.docs) out[d.id] = JSON.parse(d.get('json'));
    return out;
  }

  async function readDiary(id) {
    if (!isValidId(id)) throw new Error(`쓸 수 없는 id: ${id}`);
    const snap = await docOf(id).get();
    if (!snap.exists) throw new Error(`일기를 찾을 수 없다: ${id}`);
    const meta = snap.data();

    const [langs, typing, qa] = await Promise.all([
      readPart(id, 'langs'),
      readPart(id, 'typing'),
      readPart(id, 'qa'),
    ]);

    const doc = {
      id,
      title: meta.title,
      createdAt: meta.createdAt,
      text: meta.text ?? '',
      ko: JSON.parse(meta.ko ?? '{}'),
      langs,
    };
    if (meta.typingUpdatedAt) doc.typingUpdatedAt = meta.typingUpdatedAt;
    if (Object.keys(typing).length > 0) doc.typing = typing;
    if (Object.keys(qa).length > 0) doc.qa = qa;
    return doc;
  }

  /** 기기 메타를 남긴다. 다른 기기 코드로 옮길 때 "그런 코드가 있나"를 이걸로 본다. */
  async function touchUser() {
    const now = new Date().toISOString();
    await user().set({ createdAt: now, lastWriteAt: now }, { merge: true });
  }

  return {
    /** 겹치지 않는 id를 만든다. diary-01, diary-02 … 기기마다 따로 센다. */
    async nextId(prefix = 'diary') {
      const snap = await diaries().select().get();
      const taken = new Set(snap.docs.map((d) => d.id));
      for (let n = 1; n < 1000; n += 1) {
        const id = `${prefix}-${String(n).padStart(2, '0')}`;
        if (!taken.has(id)) return id;
      }
      throw new Error('id를 더 만들 수 없다');
    },

    /** 목록은 메타만 읽는다. 번역 결과(하위 컬렉션)는 건드리지 않는다. */
    async listDiaries() {
      const snap = await diaries().get();
      return snap.docs
        .map((d) => {
          const m = d.data();
          return {
            id: d.id,
            title: m.title,
            createdAt: m.createdAt,
            sentenceCount: m.sentenceCount ?? 0,
            langs: m.langs ?? [],
          };
        })
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    },

    readDiary,

    async hasDiary(id) {
      if (!isValidId(id)) return false;
      const snap = await docOf(id).get();
      return snap.exists;
    },

    /**
     * 일기 통째로 쓴다. 메타와 언어별 문서를 한 배치로 올린다.
     * 다시 번역하면 타이핑과 문답은 버리는 규칙이라, 받은 doc에 없는 언어 문서는 지운다.
     */
    async writeDiary(doc) {
      if (!isValidId(doc.id)) throw new Error(`쓸 수 없는 id: ${doc.id}`);
      const ref = docOf(doc.id);
      const batch = db().batch();

      batch.set(ref, {
        title: doc.title,
        createdAt: doc.createdAt,
        sentenceCount: doc.ko?.sentences?.length ?? 0,
        langs: Object.keys(doc.langs ?? {}),
        text: doc.text ?? '',
        ko: JSON.stringify(doc.ko ?? {}),
        typingUpdatedAt: doc.typingUpdatedAt ?? null,
      });

      for (const part of ['langs', 'typing', 'qa']) {
        const wanted = doc[part] ?? {};
        const existing = await ref.collection(part).select().get();
        for (const d of existing.docs) {
          if (!(d.id in wanted)) batch.delete(d.ref);
        }
        for (const [lang, value] of Object.entries(wanted)) {
          batch.set(ref.collection(part).doc(lang), { json: JSON.stringify(value) });
        }
      }

      await batch.commit();
      await touchUser();
      return doc;
    },

    /**
     * 타이핑 중인 내용을 임시저장한다. 번역 결과는 건드리지 않는다.
     * 한 언어 문서만 쓰므로 일기를 통째로 읽고 쓰지 않는다.
     */
    async saveTyping(id, lang, typing) {
      if (!isValidId(id)) throw new Error(`쓸 수 없는 id: ${id}`);
      const ref = docOf(id);
      const typingUpdatedAt = new Date().toISOString();
      const batch = db().batch();
      batch.set(ref.collection('typing').doc(lang), { json: JSON.stringify(typing) });
      batch.set(ref, { typingUpdatedAt }, { merge: true });
      await batch.commit();
      return readDiary(id);
    },

    /** 일기를 지운다. 되돌릴 수 없으므로 화면에서 두 번 확인한 뒤에만 부른다. */
    async removeDiary(id) {
      if (!isValidId(id)) throw new Error(`쓸 수 없는 id: ${id}`);
      const ref = docOf(id);
      const batch = db().batch();
      for (const part of ['langs', 'typing', 'qa']) {
        const snap = await ref.collection(part).select().get();
        for (const d of snap.docs) batch.delete(d.ref);
      }
      batch.delete(ref);
      await batch.commit();
    },

    /** Q&A 문답을 저장한다. 번역 결과와 타이핑은 건드리지 않는다. */
    async saveQa(id, lang, turns) {
      if (!isValidId(id)) throw new Error(`쓸 수 없는 id: ${id}`);
      await docOf(id).collection('qa').doc(lang).set({ json: JSON.stringify(turns) });
      return readDiary(id);
    },

    /** 이 기기 코드로 저장된 것이 있나. 다른 기기 코드로 옮길 때 확인용이다. */
    async exists() {
      const snap = await diaries().select().limit(1).get();
      return !snap.empty;
    },
  };
}
