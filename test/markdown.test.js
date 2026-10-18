import test from 'node:test';
import assert from 'node:assert/strict';
import { parseBlocks, parseSpans } from '../web/src/markdown.js';

const plain = (spans) => spans.map((s) => (s.bold ? `[${s.text}]` : s.text)).join('');

test('굵게를 푼다', () => {
  assert.equal(plain(parseSpans('이건 **중요한** 부분이다')), '이건 [중요한] 부분이다');
  assert.equal(plain(parseSpans('**앞**과 **뒤**')), '[앞]과 [뒤]');
});

test('별표가 안 닫히면 그냥 글자로 둔다', () => {
  assert.equal(plain(parseSpans('**안 닫힘')), '**안 닫힘');
  assert.equal(plain(parseSpans('별표 하나 * 는 그대로')), '별표 하나 * 는 그대로');
});

test('문단과 목록을 나눈다', () => {
  const blocks = parseBlocks('첫 문단이다.\n\n- 하나\n- 둘\n\n끝 문단.');
  assert.deepEqual(blocks.map((b) => b.type), ['p', 'ul', 'p']);
  assert.equal(blocks[1].items.length, 2);
  assert.equal(plain(blocks[1].items[0]), '하나');
  assert.equal(plain(blocks[2].spans), '끝 문단.');
});

test('목록 바로 앞뒤 줄도 제대로 끊는다', () => {
  const blocks = parseBlocks('설명이다.\n- 하나\n다시 설명.');
  assert.deepEqual(blocks.map((b) => b.type), ['p', 'ul', 'p']);
});

test('한 문단 안의 줄바꿈은 이어 붙인다', () => {
  const blocks = parseBlocks('앞줄\n뒷줄');
  assert.equal(blocks.length, 1);
  assert.equal(plain(blocks[0].spans), '앞줄 뒷줄');
});

test('목록 안에서도 굵게가 먹는다', () => {
  const blocks = parseBlocks('- **连 A 都**: A조차도');
  assert.equal(plain(blocks[0].items[0]), '[连 A 都]: A조차도');
});

test('빈 답은 블록이 없다', () => {
  assert.deepEqual(parseBlocks(''), []);
  assert.deepEqual(parseBlocks(null), []);
});
