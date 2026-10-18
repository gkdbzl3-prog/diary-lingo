import test from 'node:test';
import assert from 'node:assert/strict';
import { lineState } from '../web/src/lineState.js';

test('아직 안 친 줄은 표시가 없다', () => {
  assert.equal(lineState(0, 9), '');
});

test('치는 중이면 빨강', () => {
  assert.equal(lineState(1, 9), 'line-partial');
  assert.equal(lineState(8, 9), 'line-partial');
});

test('다 채우면 초록', () => {
  assert.equal(lineState(9, 9), 'line-done');
});

test('원문보다 길게 쳐도 초록이다 (가나로만 쳐서 길어지는 경우)', () => {
  assert.equal(lineState(14, 9), 'line-done');
});

test('하나라도 지우면 다시 빨강', () => {
  assert.equal(lineState(9, 9), 'line-done');
  assert.equal(lineState(8, 9), 'line-partial');
});

test('맞았는지는 보지 않는다 — 개수만 본다', () => {
  // 전부 틀린 글자로 채워도 개수가 찼으면 초록이다. 채점이 아니기 때문.
  assert.equal(lineState(9, 9), 'line-done');
});
