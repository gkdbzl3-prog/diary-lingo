import { config } from '../config.js';
import { chars, stripSpace } from '../validate.js';

// 중국어 문장부호. 이 글자들만으로 된 토큰은 py·pron이 없어도 된다.
const PUNCT = /^[\s，。、？！；：…—～·「」『』《》〈〉（）""''\-,.?!;:()[\]]+$/u;

/**
 * 중국어 문장 하나를 검증한다.
 * @returns {string[]} 문제 목록. 비어 있으면 통과.
 */
export function checkSentence(sentence) {
  const problems = [];
  const { hardMax } = config.lines.zh;
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

    for (const token of line.tokens) {
      const w = token?.w;
      if (typeof w !== 'string' || w === '') {
        problems.push(`${where}: w가 비어 있는 토큰이 있다`);
        continue;
      }
      lineText += w;

      const isPunct = PUNCT.test(w);
      const hasReading = token.py !== undefined || token.pron !== undefined;

      if (isPunct && !hasReading) continue;

      if (!isPunct && !hasReading) {
        problems.push(`${where}: "${w}"에 py·pron이 없다`);
        continue;
      }

      const want = chars(w).length;
      const py = Array.isArray(token.py) ? token.py : [];
      const pron = Array.isArray(token.pron) ? token.pron : [];

      if (py.length !== want) {
        problems.push(
          `${where}: "${w}"는 ${want}글자인데 py가 ${py.length}개다 (${JSON.stringify(py)})`,
        );
      }
      if (pron.length !== want) {
        problems.push(
          `${where}: "${w}"는 ${want}글자인데 pron이 ${pron.length}개다 (${JSON.stringify(pron)})`,
        );
      }
    }

    const len = chars(lineText).length;
    if (len > hardMax) {
      problems.push(`${where}: ${len}자로 최대 ${hardMax}자를 넘는다 ("${lineText}")`);
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
