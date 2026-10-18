import test from 'node:test';
import assert from 'node:assert/strict';
import {
  deleteBack,
  firstTypeable,
  initialTyped,
  lineToCells,
  placeChars,
  prevTypeable,
} from '../web/src/zh/cells.js';

// 「最近跟着」 + 「，」 + 「2023」 — 단어·문장부호·숫자가 다 들어간 줄
const line = {
  tokens: [
    { w: '最近', py: ['zuì', 'jìn'], pron: ['쮀이', '진'] },
    { w: '，' },
    { w: '2023', py: ['èr', 'líng', 'èr', 'sān'], pron: ['얼', '링', '얼', '싼'] },
  ],
  gloss: '요즘, 2023',
};

test('한 글자가 한 칸이 되고 병음·발음이 칸마다 붙는다', () => {
  const cells = lineToCells(line);
  assert.equal(cells.length, 7);
  assert.deepEqual(
    cells.map((c) => c.ch),
    ['最', '近', '，', '2', '0', '2', '3'],
  );
  assert.deepEqual(
    cells.map((c) => c.py),
    ['zuì', 'jìn', '', 'èr', 'líng', 'èr', 'sān'],
  );
  // 문장부호만 잠긴다. 숫자는 유저가 타이핑한다.
  assert.deepEqual(
    cells.map((c) => c.locked),
    [false, false, true, false, false, false, false],
  );
});

test('문장부호 칸은 미리 채워져 있고 나머지는 비어 있다', () => {
  assert.deepEqual(initialTyped(lineToCells(line)), ['', '', '，', '', '', '', '']);
});

test('커서는 잠긴 칸을 건너뛴다', () => {
  const cells = lineToCells(line);
  assert.equal(firstTypeable(cells, 2), 3); // ，를 건너뛰고 2로
  assert.equal(prevTypeable(cells, 3), 1); // 뒤로 갈 때도 건너뛴다
  assert.equal(firstTypeable(cells, 7), 7); // 줄 끝
  assert.equal(prevTypeable(cells, 0), -1); // 줄 앞
});

test('IME가 한 번에 확정한 여러 글자를 칸에 나눠 넣는다', () => {
  const cells = lineToCells(line);
  // jintian → 今天 처럼 두 글자가 한꺼번에 온다
  const r = placeChars(cells, initialTyped(cells), 0, '最近');
  assert.deepEqual(r.typed, ['最', '近', '，', '', '', '', '']);
  assert.equal(r.cursor, 3, '문장부호를 건너뛰고 다음 입력 칸으로');
});

test('확정 글자가 문장부호 칸을 넘어가며 들어간다', () => {
  const cells = lineToCells(line);
  const r = placeChars(cells, initialTyped(cells), 0, '最近2023');
  assert.deepEqual(r.typed, ['最', '近', '，', '2', '0', '2', '3']);
  assert.equal(r.cursor, 7);
});

test('칸이 모자라면 남는 글자는 버린다', () => {
  const cells = lineToCells(line);
  const r = placeChars(cells, initialTyped(cells), 0, '最近20231234');
  assert.deepEqual(r.typed, ['最', '近', '，', '2', '0', '2', '3']);
  assert.equal(r.cursor, 7);
});

test('줄 끝에서 더 넣어도 아무 일도 없다', () => {
  const cells = lineToCells(line);
  const full = placeChars(cells, initialTyped(cells), 0, '最近2023');
  const again = placeChars(cells, full.typed, full.cursor, '了');
  assert.deepEqual(again.typed, full.typed);
  assert.equal(again.cursor, 7);
});

test('지우기는 앞 칸으로 가서 지우고, 잠긴 칸은 건너뛴다', () => {
  const cells = lineToCells(line);
  let s = placeChars(cells, initialTyped(cells), 0, '最近2');
  assert.equal(s.cursor, 4);

  s = deleteBack(cells, s.typed, s.cursor); // 2를 지운다
  assert.deepEqual(s.typed, ['最', '近', '，', '', '', '', '']);
  assert.equal(s.cursor, 3);

  s = deleteBack(cells, s.typed, s.cursor); // ，를 건너뛰고 近을 지운다
  assert.deepEqual(s.typed, ['最', '', '，', '', '', '', '']);
  assert.equal(s.cursor, 1);

  s = deleteBack(cells, s.typed, s.cursor);
  assert.deepEqual(s.typed, ['', '', '，', '', '', '', '']);
  assert.equal(s.cursor, 0);

  const none = deleteBack(cells, s.typed, s.cursor); // 줄 앞에서는 아무 일도 없다
  assert.deepEqual(none.typed, s.typed);
  assert.equal(none.cursor, 0);
});

test('가운데 칸을 골라 덮어쓸 수 있다', () => {
  const cells = lineToCells(line);
  const full = placeChars(cells, initialTyped(cells), 0, '最近2023');
  const fixed = placeChars(cells, full.typed, 1, '进');
  assert.deepEqual(fixed.typed, ['最', '进', '，', '2', '0', '2', '3']);
  assert.equal(fixed.cursor, 3);
});

test('문장부호로만 된 줄은 넣을 칸이 없다', () => {
  const cells = lineToCells({ tokens: [{ w: '……' }], gloss: '' });
  assert.equal(firstTypeable(cells, 0), 2);
  const r = placeChars(cells, initialTyped(cells), 0, '了');
  assert.deepEqual(r.typed, ['…', '…']);
});

test('임시저장한 값을 되살리고, 이어서 칠 자리를 찾는다', async (t) => {
  const { restoreTyped, resumeCursor } = await import('../web/src/zh/cells.js');
  const cells = lineToCells(line);

  const typed = restoreTyped(cells, ['最', '近', '，', '2', '', '', '']);
  assert.deepEqual(typed, ['最', '近', '，', '2', '', '', '']);
  assert.equal(resumeCursor(cells, typed), 4, '비어 있는 첫 입력 칸');

  // 저장된 게 없으면 처음부터
  const empty = restoreTyped(cells, undefined);
  assert.deepEqual(empty, initialTyped(cells));
  assert.equal(resumeCursor(cells, empty), 0);

  // 잠긴 칸은 저장값이 뭐든 원래 글자를 지킨다
  const tampered = restoreTyped(cells, ['最', '近', '엑', '', '', '', '']);
  assert.equal(tampered[2], '，');

  // 다 채웠으면 줄 끝
  const full = restoreTyped(cells, ['最', '近', '，', '2', '0', '2', '3']);
  assert.equal(resumeCursor(cells, full), 7);
});
