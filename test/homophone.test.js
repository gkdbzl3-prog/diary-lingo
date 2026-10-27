import test from 'node:test';
import assert from 'node:assert/strict';
import { isHomophone, loadPinyin, onPinyinReady } from '../web/src/zh/homophone.js';
import { hasWrongKanji } from '../web/src/ja/kanji.js';

test('ja: 가나와 한자 표기 차이는 양방향으로 경고하지 않는다', () => {
  for (const [kana, kanji] of [
    ['わかる', '分かる'],
    ['うえで', '上で'],
    ['気持ちがわかる。', '気持ちが分かる。'],
    ['確認したうえで決める。', '確認した上で決める。'],
  ]) {
    assert.equal(hasWrongKanji(kanji, kana), false, `${kana} → ${kanji}`);
    assert.equal(hasWrongKanji(kana, kanji), false, `${kanji} → ${kana}`);
  }
});

test('ja: 표기 차이와 별개인 한자 오변환은 여전히 경고한다', () => {
  assert.equal(hasWrongKanji('分かるけど日記長が好き', 'わかるけど日記帳が好き'), true);
});

// 사전은 따로 떼어 늦게 불러온다. 오기 전에는 표시하지 않는 게 정상이다.
test('zh: 사전을 불러오기 전에는 표시하지 않는다', () => {
  assert.equal(isHomophone('地', '的'), false);
});

test('zh: 사전을 불러온다', async () => {
  loadPinyin();
  await new Promise((resolve) => onPinyinReady(resolve));
  assert.ok(isHomophone('地', '的'), '불러온 뒤에는 표시한다');
});

test('zh: 소리가 같은 다른 글자는 표시한다', () => {
  // 的 / 地 / 得 — 전부 de
  assert.ok(isHomophone('地', '的'));
  assert.ok(isHomophone('得', '的'));
  assert.ok(isHomophone('的', '得'));
  // 他 / 她 / 它 — 전부 ta
  assert.ok(isHomophone('她', '他'));
  assert.ok(isHomophone('它', '她'));
});

test('zh: 같은 글자는 표시하지 않는다', () => {
  assert.equal(isHomophone('的', '的'), false);
  assert.equal(isHomophone('', '的'), false);
});

test('zh: 소리가 다른 글자는 표시하지 않는다', () => {
  assert.equal(isHomophone('好', '的'), false);
  assert.equal(isHomophone('我', '你'), false);
});

test('zh: 다음자는 읽기 하나만 겹쳐도 표시한다', () => {
  // 了 le/liao, 乐 le/yue — le가 겹친다
  assert.ok(isHomophone('乐', '了'));
});

test('ja: 다른 한자로 변환되면 알려 준다', () => {
  assert.ok(hasWrongKanji('日記長が好き', '日記帳が好き'));
  assert.ok(hasWrongKanji('最近、早りに乗って', '最近、流行りに乗って'));
});

test('ja: 한자로 안 바꾸고 가나로 둔 건 그대로 둔다', () => {
  assert.equal(hasWrongKanji('日記帳がすき', '日記帳が好き'), false);
  assert.equal(hasWrongKanji('にっきちょうが好き', '日記帳が好き'), false);
});

test('ja: 똑같이 쳤거나 아직 안 쳤으면 아무것도 안 한다', () => {
  assert.equal(hasWrongKanji('日記帳が好き', '日記帳が好き'), false);
  assert.equal(hasWrongKanji('', '日記帳が好き'), false);
});

test('ja: 치는 중인 앞부분만 맞아도 조용하다', () => {
  assert.equal(hasWrongKanji('日記', '日記帳が好き'), false);
  assert.equal(hasWrongKanji('日記帳', '日記帳が好き'), false);
});
