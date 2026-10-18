// 답에 섞여 오는 아주 좁은 마크다운만 푼다: 굵게(**…**)와 목록(- …).
// 프롬프트에서 "목록과 굵게 정도만" 쓰라고 못 박아 뒀으므로 라이브러리를 들이지 않는다.
//
// React 없이 테스트할 수 있게 데이터만 돌려준다. 그리는 건 컴포넌트가 한다.

/** @returns {{bold: boolean, text: string}[]} */
export function parseSpans(line) {
  const spans = [];
  let at = 0;

  while (at < line.length) {
    const open = line.indexOf('**', at);
    if (open < 0) break;
    const close = line.indexOf('**', open + 2);
    if (close < 0) break;

    if (open > at) spans.push({ bold: false, text: line.slice(at, open) });
    const inner = line.slice(open + 2, close);
    if (inner) spans.push({ bold: true, text: inner });
    at = close + 2;
  }

  if (at < line.length) spans.push({ bold: false, text: line.slice(at) });
  return spans.length > 0 ? spans : [{ bold: false, text: line }];
}

/** @returns {({type:'ul', items: object[][]} | {type:'p', spans: object[]})[]} */
export function parseBlocks(text) {
  const blocks = [];
  let list = null;
  let paragraph = [];

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    blocks.push({ type: 'p', spans: parseSpans(paragraph.join(' ')) });
    paragraph = [];
  };
  const flushList = () => {
    if (!list) return;
    blocks.push(list);
    list = null;
  };

  for (const raw of String(text ?? '').split('\n')) {
    const line = raw.trim();

    if (line === '') {
      flushParagraph();
      flushList();
      continue;
    }

    const bullet = line.match(/^[-*]\s+(.*)$/);
    if (bullet) {
      flushParagraph();
      list = list ?? { type: 'ul', items: [] };
      list.items.push(parseSpans(bullet[1]));
      continue;
    }

    flushList();
    paragraph.push(line);
  }

  flushParagraph();
  flushList();
  return blocks;
}
