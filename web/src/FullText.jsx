import React from 'react';
import { paragraphs } from './fullText.js';

/** 원문 전체와 번역 전체. 문장을 문단 기준으로 이어 붙인다. 추가 호출은 없다. */
export default function FullText({ koSentences, langSentences, lang }) {
  const rows = paragraphs(koSentences, langSentences, lang);

  return (
    <section className="fulltext">
      {rows.map((row) => (
        <div className="fulltext-p" key={row.p}>
          <p className="fulltext-target">{row.text}</p>
          <p className="fulltext-ko">{row.ko}</p>
        </div>
      ))}
    </section>
  );
}
