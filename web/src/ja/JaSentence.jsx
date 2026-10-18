import React, { useState } from 'react';
import { hasWrongKanji } from './kanji.js';
import { TYPING_INPUT, focusNextInput } from '../focusNext.js';

/**
 * 일본어 한 줄. [요미가나 · 한글 발음 · 해석 · 한 줄 입력]
 *
 * 중국어와 달리 칸을 쓰지 않는다. 가나와 한자가 섞여 글자 폭이 제각각이고,
 * IME가 문절을 통째로 바꾸기 때문에 한 줄 입력이 맞다.
 *
 * 해석을 입력란 **위에** 둔다. 아웃풋 연습이 목적이라 한국어 뜻을 먼저 읽고
 * 일본어를 만들어 보는 순서가 맞다.
 * 요미가나는 문절 사이를 띄우지 않고 붙여 쓴다(일본어 본래 모습).
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
      <p className="ja-kana">{tokens.map((t) => t.kana ?? '').join('')}</p>
      <p className="ja-pron">{tokens.map((t) => t.pron ?? '').join(' ')}</p>
      <p className="line-gloss">{line.gloss}</p>

      <input
        className="ja-input"
        value={value}
        onChange={(e) => change(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== 'Enter' || e.nativeEvent.isComposing) return;
          e.preventDefault();
          focusNextInput(e.currentTarget);
        }}
        lang="ja"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        {...TYPING_INPUT}
      />

      {/* 채점은 안 한다. IME가 다른 한자로 바꿔 버린 경우만 알려 준다.
          한자로 안 바꾸고 가나로 둔 건 틀린 게 아니므로 조용하다. */}
      {wrongKanji ? <p className="line-warn">다른 한자로 변환됨</p> : null}
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
