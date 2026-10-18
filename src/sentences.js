// 한국어 일기를 문장으로 나눈다. AI 호출 전에 서버에서 한다.
//
// - 줄바꿈과 빈 줄은 문단 구분. 문단마다 p를 1부터 붙인다.
// - 문장 끝(. ? ! 。 ! ?) 뒤에서 나눈다.
// - 말줄임표(…, ⋯, ...)에서는 자르지 않는다.
// - 모든 언어가 여기서 붙인 id를 기준으로 붙는다.

const TERMINATORS = new Set(['.', '?', '!', '。', '！', '？']);

// 문장 끝 뒤에 붙어 따라오는 닫는 기호들. 여기까지 한 문장으로 본다.
const TRAILING = new Set(['"', "'", '”', '’', ')', ']', '》', '」', '』', '…']);

function splitParagraph(para) {
  const out = [];
  let start = 0;
  let i = 0;

  while (i < para.length) {
    const ch = para[i];

    // 점이 둘 이상 이어지면 말줄임표다. 통째로 건너뛴다.
    if (ch === '.') {
      let run = i;
      while (run < para.length && para[run] === '.') run += 1;
      if (run - i >= 2) {
        i = run;
        continue;
      }
    }

    if (TERMINATORS.has(ch)) {
      let end = i + 1;
      while (end < para.length && (TERMINATORS.has(para[end]) || TRAILING.has(para[end]))) {
        end += 1;
      }
      // 문단 끝이거나 뒤에 공백이 올 때만 문장 경계로 본다.
      // (숫자 사이의 점 같은 건 여기서 걸러진다)
      if (end >= para.length || /\s/.test(para[end])) {
        const sentence = para.slice(start, end).trim();
        if (sentence) out.push(sentence);
        start = end;
        i = end;
        continue;
      }
    }

    i += 1;
  }

  const tail = para.slice(start).trim();
  if (tail) out.push(tail);
  return out;
}

/**
 * @param {string} text 일기 원문
 * @returns {{ sentences: { id: number, p: number, ko: string }[] }}
 */
export function splitKoreanDiary(text) {
  const paragraphs = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const sentences = [];
  let id = 1;

  paragraphs.forEach((para, index) => {
    const p = index + 1;
    for (const ko of splitParagraph(para)) {
      sentences.push({ id, p, ko });
      id += 1;
    }
  });

  return { sentences };
}
