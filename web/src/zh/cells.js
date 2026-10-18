// 중국어 줄을 화면 칸(cell) 목록으로 펼치고, 칸에 글자를 채운다.
//
// 문장부호 토큰(py·pron이 없는 토큰)은 미리 채워 두고 커서가 건너뛴다.
// 아랍 숫자는 글자마다 병음·발음이 붙어 오지만 미리 채우지 않고 유저가 타이핑한다.
//
// 칸 채우기는 IME 때문에 "한 번에 여러 글자"가 기본이다(jintian → 今天).
// 그 규칙만 순수 함수로 떼어 놔서 React 없이도 검증할 수 있게 한다.

export function lineToCells(line) {
  const cells = [];

  for (const token of line.tokens ?? []) {
    const chars = Array.from(token.w ?? '');
    const py = Array.isArray(token.py) ? token.py : [];
    const pron = Array.isArray(token.pron) ? token.pron : [];
    const isPunct = py.length === 0 && pron.length === 0;

    chars.forEach((ch, i) => {
      cells.push({
        ch,
        py: py[i] ?? '',
        pron: pron[i] ?? '',
        locked: isPunct,
      });
    });
  }

  return cells;
}

/** 빈 상태. 잠긴 칸은 미리 채워져 있다. */
export function initialTyped(cells) {
  return cells.map((c) => (c.locked ? c.ch : ''));
}

/** from 이후(포함)의 첫 입력 가능 칸. 없으면 cells.length. */
export function firstTypeable(cells, from) {
  let at = Math.max(0, from);
  while (at < cells.length && cells[at].locked) at += 1;
  return at;
}

/** from 앞의 마지막 입력 가능 칸. 없으면 -1. */
export function prevTypeable(cells, from) {
  let at = Math.min(from, cells.length) - 1;
  while (at >= 0 && cells[at].locked) at -= 1;
  return at;
}

/**
 * 확정된 글자들을 커서부터 순서대로 나눠 넣는다. 잠긴 칸은 건너뛴다.
 * 칸이 모자라면 남는 글자는 버린다(줄 밖으로 넘기지 않는다).
 * @returns {{ typed: string[], cursor: number }}
 */
export function placeChars(cells, typed, cursor, text) {
  const next = [...typed];
  let at = firstTypeable(cells, cursor);

  for (const ch of Array.from(text)) {
    at = firstTypeable(cells, at);
    if (at >= cells.length) break;
    next[at] = ch;
    at += 1;
  }

  return { typed: next, cursor: firstTypeable(cells, at) };
}

/**
 * 커서 앞 칸을 지운다.
 * @returns {{ typed: string[], cursor: number }}
 */
export function deleteBack(cells, typed, cursor) {
  const at = prevTypeable(cells, cursor);
  if (at < 0) return { typed, cursor };

  const next = [...typed];
  next[at] = '';
  return { typed: next, cursor: at };
}
