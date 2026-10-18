import React, { useState } from 'react';
import { TYPING_INPUT, focusNextInput } from '../focusNext.js';

/**
 * 영어 한 줄. [한글 발음 · 고스트 텍스트 위에 타이핑 · 해석]
 *
 * 원문을 흐릿하게 깔고 그 위에 입력한다. 깔린 글자와 입력 글자가 같은 자리에
 * 오도록 둘의 글꼴·크기·padding을 똑같이 맞춰 겹쳐 둔다.
 */
function EnLine({ line, initial, onChange }) {
  const [value, setValue] = useState(initial ?? '');

  const change = (next) => {
    setValue(next);
    onChange?.(next);
  };

  return (
    <div className="line">
      <p className="en-pron">{line.pron}</p>

      <div className="en-field">
        <span className="en-ghost" aria-hidden="true">
          {line.text}
        </span>
        <input
          className="en-input"
          value={value}
          onChange={(e) => change(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter' || e.nativeEvent.isComposing) return;
            e.preventDefault();
            focusNextInput(e.currentTarget);
          }}
          lang="en"
          {...TYPING_INPUT}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
        />
      </div>

      <p className="line-gloss">{line.gloss}</p>
    </div>
  );
}

export default function EnSentence({ sentence, ko, saved, onChange }) {
  return (
    <section className="sentence">
      <header className="sentence-head">
        <span className="sentence-id">#{sentence.id}</span>
        <p className="sentence-ko">{ko}</p>
      </header>

      <div className="lines lines-text">
        {(sentence.lines ?? []).map((line, i) => (
          <EnLine
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
