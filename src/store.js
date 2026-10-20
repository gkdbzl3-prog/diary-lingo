// 일기 저장소. 읽고 쓰는 함수는 여기에서만 내보낸다.
//
// 자격증명이 있으면 Firestore, 없으면 data/<id>.json 파일이다.
//   FIREBASE_SERVICE_ACCOUNT        서비스 계정 JSON 통째로 (fly secret)
//   GOOGLE_APPLICATION_CREDENTIALS  그 JSON 파일 경로 (로컬)
// 둘 다 없으면 파일로 떨어진다 — 키 없이도 `pnpm dev`와 테스트가 그대로 돈다.
// 억지로 한쪽을 고르려면 DIARY_LINGO_STORE=firestore|files 로 못 박는다.
//
// 함수는 전부 async다. 부르는 쪽은 어느 저장소인지 알 필요가 없다.

const forced = process.env.DIARY_LINGO_STORE;
const hasCredential = Boolean(
  process.env.FIREBASE_SERVICE_ACCOUNT || process.env.GOOGLE_APPLICATION_CREDENTIALS,
);

export const backend = forced ?? (hasCredential ? 'firestore' : 'files');

const impl = backend === 'firestore'
  ? await import('./store/firestore.js')
  : await import('./store/files.js');

export const {
  isValidId,
  titleOf,
  nextId,
  listDiaries,
  readDiary,
  hasDiary,
  writeDiary,
  saveTyping,
  removeDiary,
  saveQa,
} = impl;
