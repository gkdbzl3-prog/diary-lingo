import diff from 'fast-diff';

// 가나 ↔ 한자 표기는 어느 방향이든 경고하지 않는다.
// 읽기 사전 없이 정오를 단정할 수 없으므로, 같은 변경 구간에서
// 기존 한자를 다른 한자로 바꾼 경우에만 IME 변환을 알려 준다.
const KANJI = /[㐀-䶿一-鿿豈-﫿]/u;

/** 입력한 줄에 원문의 한자를 다른 한자로 바꾼 구간이 있는가. */
export function hasWrongKanji(typed, want) {
  if (!typed || typed === want) return false;

  let removedKanji = false;
  let insertedKanji = false;
  for (const [op, text] of diff(want, typed)) {
    if (op === diff.EQUAL) {
      if (removedKanji && insertedKanji) return true;
      removedKanji = false;
      insertedKanji = false;
    } else if (op === diff.DELETE) {
      removedKanji ||= KANJI.test(text);
    } else if (op === diff.INSERT) {
      insertedKanji ||= KANJI.test(text);
    }
  }
  return removedKanji && insertedKanji;
}
