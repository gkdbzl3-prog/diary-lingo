import { config } from '../config.js';
import { chars, collapseSpace } from '../validate.js';

/**
 * 영어 문장 하나를 검증한다.
 * @returns {string[]} 문제 목록. 비어 있으면 통과.
 */
export function checkSentence(sentence) {
  const problems = [];
  const { hardMax } = config.lines.en;
  const id = sentence?.id;

  if (!Array.isArray(sentence?.lines) || sentence.lines.length === 0) {
    problems.push(`#${id}: lines가 비어 있다`);
    return problems;
  }

  const texts = [];

  sentence.lines.forEach((line, li) => {
    const where = `#${id} ${li + 1}번째 줄`;

    const text = line?.text;
    if (typeof text !== 'string' || text.trim() === '') {
      problems.push(`${where}: text가 비어 있다`);
      return;
    }
    if (typeof line.pron !== 'string' || line.pron.trim() === '') {
      problems.push(`${where}: pron이 비어 있다`);
    }
    if (typeof line.gloss !== 'string' || line.gloss.trim() === '') {
      problems.push(`${where}: gloss가 비어 있다`);
    }

    const len = chars(text).length;
    if (len > hardMax) {
      problems.push(`${where}: ${len}자로 최대 ${hardMax}자를 넘는다 ("${text}")`);
    }

    texts.push(text.trim());
  });

  // 영어는 공백이 의미가 있으므로 떼어 내지 않고, 여러 칸만 한 칸으로 줄여서 비교한다.
  const joined = collapseSpace(texts.join(' '));
  if (collapseSpace(sentence.text) !== joined) {
    problems.push(
      `#${id}: text와 줄을 이어 붙인 결과가 다르다\n  text : ${sentence.text}\n  lines: ${joined}`,
    );
  }

  return problems;
}
