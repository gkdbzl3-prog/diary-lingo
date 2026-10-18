import React, { useState } from 'react';
import { hasWrongKanji } from './kanji.js';

/**
 * 일본어 한 줄. [요미가나 · 한글 발음 · 한 줄 입력 · 해석]
 *
 * 중국어와 달리 칸을 쓰지 않는다. 가나와 한자가 섞여 글자 폭이 제각각이고,
 * IME가 문절을 통째로 바꾸기 때문에 한 줄 입력이 맞다.
 * 요미가나와 발음은 문절 단위로 띄어 쓴다.
 */
function JaLine({ line, initial, onChange }) {
  const [value, setValue] = useState(initial ?? '');
  const tokens = line.tokens ?? [];
  const want = tokens.map((t) => t.w ?? '').join('');
  const wrongKanji = hasWrongKanji(value, want);

  const change = (next) => {
    setValue(next);
    onChange?.(next);
  };

  return (
    <div className="line">
      <div className="ja-row ja-kana">
        {tokens.map((t, i) => (
          <span key={i}>{t.kana}</span>
        ))}
      </div>

      <div className="ja-row ja-pron">
        {tokens.map((t, i) => (
          <span key={i}>{t.pron}</span>
        ))}
      </div>

      <input
        className="ja-input"
        value={value}
        onChange={(e) => change(e.target.value)}
        lang="ja"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
      />

      {/* 채점은 안 한다. IME가 다른 한자로 바꿔 버린 경우만 알려 준다.
          한자로 안 바꾸고 가나로 둔 건 틀린 게 아니므로 조용하다. */}
      {wrongKanji ? <p className="line-warn">다른 한자로 변환됨</p> : null}

      <p className="line-gloss">{line.gloss}</p>
    </div>
  );
}

export default function JaSentence({ sentence, ko, saved, onChange }) {
  return (
    <section className="sentence">
      <header className="sentence-head">
        <span className="sentence-id">#{sentence.id}</span>
        <p className="sentence-ko">{ko}</p>
      </header>

      <div className="lines lines-text">
        {(sentence.lines ?? []).map((line, i) => (
          <JaLine
            key={i}
            line={line}
            initial={saved?.(sentence.id, i)}
            onChange={(value) => onChange?.(sentence.id, i, value)}
          />
        ))}
      </div>
    </section>
  );
}
