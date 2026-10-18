import test from 'node:test';
import assert from 'node:assert/strict';
import { paragraphs } from '../web/src/fullText.js';

const ko = [
  { id: 1, p: 1, ko: '첫 문장이다.' },
  { id: 2, p: 1, ko: '같은 문단 둘째다.' },
  { id: 3, p: 2, ko: '둘째 문단이다.' },
];

test('문단 기준으로 원문을 이어 붙인다', () => {
  const rows = paragraphs(ko);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].ko, '첫 문장이다. 같은 문단 둘째다.');
  assert.equal(rows[1].ko, '둘째 문단이다.');
});

test('중국어는 문장 사이를 붙인다', () => {
  const rows = paragraphs(ko, [{ id: 1, text: '第一句。' }, { id: 2, text: '第二句。' }, { id: 3, text: '第二段。' }], 'zh');
  assert.equal(rows[0].text, '第一句。第二句。');
  assert.equal(rows[1].text, '第二段。');
});

test('영어는 문장 사이를 띄운다', () => {
  const rows = paragraphs(ko, [{ id: 1, text: 'First.' }, { id: 2, text: 'Second.' }], 'en');
  assert.equal(rows[0].text, 'First. Second.');
});

test('빠진 문장은 건너뛴다', () => {
  const rows = paragraphs(ko, [{ id: 1, text: '第一句。' }], 'zh');
  assert.equal(rows[0].text, '第一句。');
  assert.equal(rows[1].text, '');
});

test('번역이 없으면 원문만 만든다', () => {
  const rows = paragraphs(ko);
  assert.equal(rows[0].text, '');
});
