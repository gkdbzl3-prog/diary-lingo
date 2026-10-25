// 한자 위에만 후리가나를 단다.
//
// AI는 문절 통째로 읽기를 준다("流行りに" → "はやりに"). 화면에는 한자 위에만
// 읽기를 얹어야 하므로, 문절을 한자 덩어리와 가나 덩어리로 쪼개고 읽기를
// 덩어리마다 나눠 붙인다. 오쿠리가나("り")까지 한자 위에 올라가면 안 된다.
//
// 순수 함수라 React 없이 테스트된다.

/** 히라가나·가타카나. 장음부호(ー)도 가타카나 범위 안이라 여기 들어온다. */
const KANA = /[ぁ-ゟ゠-ヿｦ-ﾝ]/u;
const PUNCT = /[\s、。，．・？！「」『』（）〈〉《》…―~〜,.?!;:()[\]"']/u;

/**
 * 읽기를 달아야 하는 글자인가. 가나와 문장부호만 아니다 — 한자는 물론이고
 * 숫자(2023年)와 々(人々)도 읽기가 필요하다.
 */
const needsReading = (ch) => !KANA.test(ch) && !PUNCT.test(ch);

/**
 * 문절을 한자 덩어리와 가나 덩어리로 쪼갠다.
 * @returns {{ ruby: boolean, text: string }[]}
 */
function chunk(w) {
  const out = [];
  for (const ch of Array.from(w)) {
    const ruby = needsReading(ch);
    const last = out[out.length - 1];
    if (last && last.ruby === ruby) last.text += ch;
    else out.push({ ruby, text: ch });
  }
  return out;
}

/**
 * 문절 하나를 후리가나 조각으로 나눈다.
 *
 * 가나 덩어리는 읽기에 글자 그대로 나오므로, 그 위치를 찾으면 사이에 낀 한자
 * 덩어리의 읽기가 저절로 잘린다. 어디 하나라도 어긋나면 쪼개지 않고 문절
 * 통째로 읽기를 단다 — 틀린 자리에 후리가나를 얹느니 뭉뚱그리는 게 낫다.
 *
 * @param {string} w 원문 표기
 * @param {string} [kana] 문절 통째 읽기
 * @returns {{ text: string, reading?: string }[]} reading이 있는 조각만 루비를 단다
 */
export function furigana(w, kana) {
  const word = String(w ?? '');
  if (word === '') return [];

  const chunks = chunk(word);
  const hasRuby = chunks.some((c) => c.ruby);
  const reading = String(kana ?? '');

  if (!hasRuby) return [{ text: word }];
  if (reading === '') return [{ text: word }];

  const whole = [{ text: word, reading }];
  const out = [];
  let rest = reading;

  for (let i = 0; i < chunks.length; i += 1) {
    const { ruby, text } = chunks[i];

    if (!ruby) {
      // 가나 덩어리는 읽기에도 그대로 있다. 맨 앞이어야 하거나(앞에 한자가 없다),
      // 바로 앞 한자 덩어리의 읽기만큼 건너뛴 자리에 있다.
      const at = rest.indexOf(text);
      if (at !== 0) return whole;
      rest = rest.slice(text.length);
      out.push({ text });
      continue;
    }

    const next = chunks[i + 1];
    if (!next) {
      // 마지막 덩어리. 남은 읽기를 전부 가져간다.
      if (rest === '') return whole;
      out.push({ text, reading: rest });
      rest = '';
      continue;
    }

    // 다음 가나 덩어리가 나오는 자리까지가 이 한자의 읽기다.
    const at = rest.indexOf(next.text);
    if (at <= 0) return whole;
    out.push({ text, reading: rest.slice(0, at) });
    rest = rest.slice(at);
  }

  if (rest !== '') return whole;
  return out;
}
