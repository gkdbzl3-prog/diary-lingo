import test from 'node:test';
import assert from 'node:assert/strict';
import { furigana } from '../web/src/ja/furigana.js';

/** 루비가 붙은 조각만 "한자(읽기)" 꼴로 적어 눈으로 보기 쉽게 만든다. */
const show = (parts) =>
  parts.map((p) => (p.reading ? `${p.text}(${p.reading})` : p.text)).join('');

test('오쿠리가나는 한자 위로 올라가지 않는다', () => {
  // 流行り는 流行(はや) + 오쿠리가나 り다. り까지 한자 위로 올리면 안 된다.
  assert.equal(show(furigana('流行りに', 'はやりに')), '流行(はや)りに');
  assert.equal(show(furigana('乗って', 'のって')), '乗(の)って');
  assert.equal(show(furigana('見ない', 'みない')), '見(み)ない');
});

test('한자 덩어리가 둘이어도 읽기가 제자리에 나뉜다', () => {
  assert.equal(
    show(furigana('手帳にも興味が', 'てちょうにもきょうみが')),
    '手帳(てちょう)にも興味(きょうみ)が',
  );
  assert.equal(show(furigana('日記帳のほうが', 'にっきちょうのほうが')), '日記帳(にっきちょう)のほうが');
});

test('문장부호는 읽기 없이 그대로 남는다', () => {
  assert.equal(show(furigana('最近、', 'さいきん、')), '最近(さいきん)、');
  assert.equal(show(furigana('、', '、')), '、');
  assert.equal(show(furigana('。', undefined)), '。');
});

test('가나로만 된 문절에는 루비가 없다', () => {
  assert.equal(show(furigana('やっぱり', 'やっぱり')), 'やっぱり');
  assert.equal(show(furigana('コツコツ', 'コツコツ')), 'コツコツ');
  assert.deepEqual(furigana('やっぱり', 'やっぱり'), [{ text: 'やっぱり' }]);
});

test('가나로 시작하는 문절도 한자 자리를 찾는다', () => {
  assert.equal(show(furigana('お金が', 'おかねが')), 'お金(かね)が');
  assert.equal(show(furigana('ご飯', 'ごはん')), 'ご飯(はん)');
});

test('숫자와 々도 읽기를 받는다', () => {
  assert.equal(show(furigana('2023年', 'にせんにじゅうさんねん')), '2023年(にせんにじゅうさんねん)');
  assert.equal(show(furigana('人々が', 'ひとびとが')), '人々(ひとびと)が');
});

test('읽기가 어긋나면 쪼개지 않고 문절 통째로 단다', () => {
  // 가나가 읽기에 없다 — 틀린 자리에 후리가나를 얹느니 뭉뚱그린다.
  assert.equal(show(furigana('食べる', 'たべます')), '食べる(たべます)');
  // 한자 읽기가 비게 되는 경우도 마찬가지다.
  assert.equal(show(furigana('見ない', 'ないみ')), '見ない(ないみ)');
});

test('읽기가 없으면 원문만 돌려준다', () => {
  assert.deepEqual(furigana('口座', ''), [{ text: '口座' }]);
  assert.deepEqual(furigana('口座', undefined), [{ text: '口座' }]);
  assert.deepEqual(furigana('', 'こうざ'), []);
});

test('날님이 말한 문장이 그대로 나온다', () => {
  const tokens = [
    { w: '口座に', kana: 'こうざに' },
    { w: 'まとまった', kana: 'まとまった' },
    { w: 'お金が', kana: 'おかねが' },
    { w: '一度に', kana: 'いちどに' },
    { w: '入ると', kana: 'はいると' },
  ];
  const line = tokens.map((t) => show(furigana(t.w, t.kana))).join('');
  assert.equal(line, '口座(こうざ)にまとまったお金(かね)が一度(いちど)に入(はい)ると');
});
