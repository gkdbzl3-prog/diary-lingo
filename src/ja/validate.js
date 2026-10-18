import { config } from '../config.js';
import { chars, stripSpace } from '../validate.js';

// 일본어 문장부호. 요미가나 글자 수를 셀 때 빼고, 이 글자들만으로 된 토큰은 kana·pron이 없어도 된다.
// 장음부호(ー)는 가나의 일부이므로 여기 넣지 않는다.
const PUNCT_CLASS = '\\s、。，．・？！「」『』（）〈〉《》…―~〜,.?!;:()\\[\\]"\'';
const PUNCT_ONLY = new RegExp(`^[${PUNCT_CLASS}]+$`, 'u');
const PUNCT_ANY = new RegExp(`[${PUNCT_CLASS}]`, 'gu');

/** 요미가나 길이는 공백·문장부호를 빼고 센다. */
const kanaLength = (s) => chars(String(s).replace(PUNCT_ANY, '')).length;

/**
 * 일본어 문장 하나를 검증한다.
 * @returns {string[]} 문제 목록. 비어 있으면 통과.
 */
export function checkSentence(sentence) {
  const problems = [];
  const { hardMax } = config.lines.ja;
  const id = sentence?.id;

  if (!Array.isArray(sentence?.lines) || sentence.lines.length === 0) {
    problems.push(`#${id}: lines가 비어 있다`);
    return problems;
  }

  let joined = '';

  sentence.lines.forEach((line, li) => {
    const where = `#${id} ${li + 1}번째 줄`;

    if (!Array.isArray(line?.tokens) || line.tokens.length === 0) {
      problems.push(`${where}: tokens가 비어 있다`);
      return;
    }
    if (typeof line.gloss !== 'string' || line.gloss.trim() === '') {
      problems.push(`${where}: gloss가 비어 있다`);
    }

    let lineText = '';
    let lineKana = '';

    for (const token of line.tokens) {
      const w = token?.w;
      if (typeof w !== 'string' || w === '') {
        problems.push(`${where}: w가 비어 있는 토큰이 있다`);
        continue;
      }
      lineText += w;

      const isPunct = PUNCT_ONLY.test(w);
      const kana = token.kana;
      const pron = token.pron;
      const hasKana = typeof kana === 'string' && kana.trim() !== '';
      const hasPron = typeof pron === 'string' && pron.trim() !== '';

      if (isPunct && !hasKana && !hasPron) continue;

      if (!hasKana) problems.push(`${where}: "${w}"에 kana가 없다`);
      if (!hasPron) problems.push(`${where}: "${w}"에 pron이 없다`);
      if (hasKana) lineKana += kana;
    }

    const len = kanaLength(lineKana);
    if (len > hardMax) {
      problems.push(
        `${where}: 요미가나 ${len}자로 최대 ${hardMax}자를 넘는다 ("${lineKana}")`,
      );
    }

    joined += lineText;
  });

  if (stripSpace(sentence.text) !== stripSpace(joined)) {
    problems.push(
      `#${id}: text와 토큰을 이어 붙인 결과가 다르다\n  text  : ${sentence.text}\n  tokens: ${joined}`,
    );
  }

  return problems;
}
