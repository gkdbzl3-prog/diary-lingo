import diff from 'fast-diff';

// 일본어도 채점하지 않는다. 다만 IME가 **다른 한자로 변환해 버린** 경우만 알려 준다.
// 한자로 안 바꾸고 가나로 그냥 둔 건 틀린 게 아니므로 그대로 둔다.
//
// 그래서 보는 건 "유저가 넣은 쪽(INSERT)"뿐이다. 거기에 한자가 있으면 다른 한자로
// 바꾼 것이고, 가나만 있으면 변환을 안 한 것이다.

const KANJI = /[㐀-䶿一-鿿豈-﫿]/u;

/** 입력한 줄에 원문과 다른 한자가 들어갔는가. */
export function hasWrongKanji(typed, want) {
  if (!typed || typed === want) return false;

  for (const [op, text] of diff(want, typed)) {
    if (op === diff.INSERT && KANJI.test(text)) return true;
  }
  return false;
}
