import React, { useMemo } from 'react';
import TypingLine from './TypingLine.jsx';
import { lineToCells } from './cells.js';

/**
 * 중국어 문장 하나. 줄 세트를 세로로 쌓는다.
 *
 * 줄바꿈 위치는 기기 너비와 상관없이 고정이다. 대신 문장 안에서 가장 긴 줄이
 * 딱 들어가도록 칸 크기를 container query 단위로 계산해서, 좁은 화면에서는
 * 카드 전체가 비율대로 줄어든다.
 */
export default function ZhSentence({ sentence, ko }) {
  const lines = useMemo(() => (sentence.lines ?? []).map(lineToCells), [sentence]);
  const maxCells = Math.max(1, ...lines.map((cells) => cells.length));

  return (
    <section className="sentence" style={{ '--max-cells': maxCells }}>
      <header className="sentence-head">
        <span className="sentence-id">#{sentence.id}</span>
        <p className="sentence-ko">{ko}</p>
      </header>

      <div className="lines">
        {lines.map((cells, i) => (
          <TypingLine key={i} cells={cells} gloss={sentence.lines[i].gloss} />
        ))}
      </div>
    </section>
  );
}
