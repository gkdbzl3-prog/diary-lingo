// 채점은 하지 않는다. 다만 的/地/得, 他/她/它처럼 **소리가 같아서** 잘못 고른
// 글자는 혼자서는 알아차릴 수 없으니 그 칸에만 작은 표시를 한다.
// 다음자(多音字)는 모든 읽기를 보고, 성조는 무시한다.
//
// pinyin-pro는 사전까지 들고 와서 300kB가 넘는다. 표시는 없어도 연습에 지장이
// 없는 덧붙임이라, 첫 화면을 붙잡지 않도록 따로 떼어 늦게 불러온다.
// 불러오기 전에는 그냥 표시하지 않는다.

let pinyin = null;
let started = false;
const waiters = new Set();

export function loadPinyin() {
  if (started) return;
  started = true;
  import('pinyin-pro')
    .then((m) => {
      pinyin = m.pinyin;
      for (const fn of waiters) fn();
      waiters.clear();
    })
    .catch(() => {
      // 못 불러와도 연습은 그대로 된다. 표시만 없다.
      started = false;
    });
}

/** 사전을 불러오면 알려 준다. @returns {() => void} 구독 해지 */
export function onPinyinReady(fn) {
  if (pinyin) return () => {};
  waiters.add(fn);
  return () => waiters.delete(fn);
}

const cache = new Map();

function readings(ch) {
  if (cache.has(ch)) return cache.get(ch);
  const list = pinyin(ch, { toneType: 'none', multiple: true, type: 'array' });
  const set = new Set(list.map((r) => String(r).trim()).filter(Boolean));
  cache.set(ch, set);
  return set;
}

/** 입력한 글자가 원래 글자와 다르지만 읽기가 겹치는가. */
export function isHomophone(typedChar, wantChar) {
  if (!pinyin) return false;
  if (!typedChar || !wantChar) return false;
  if (typedChar === wantChar) return false;

  const want = readings(wantChar);
  for (const r of readings(typedChar)) {
    if (want.has(r)) return true;
  }
  return false;
}
