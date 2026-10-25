import React, { useState } from 'react';
import { furigana } from './furigana.js';
import { hasWrongKanji } from './kanji.js';
import { TYPING_INPUT, focusNextInput } from '../focusNext.js';
import { lineState } from '../lineState.js';

/**
 * 일본어 한 줄. [한자 예문(후리가나) · 한글 발음 · 해석 · 한 줄 입력]
 *
 * 중국어와 달리 칸을 쓰지 않는다. 가나와 한자가 섞여 글자 폭이 제각각이고,
 * IME가 문절을 통째로 바꾸기 때문에 한 줄 입력이 맞다.
 *
 * 맨 위는 한자가 그대로 보이는 예문이고, 읽기는 한자 위에 후리가나로 얹는다.
 * 요미가나만 한 줄로 두면 무슨 한자를 쓰는 문장인지 알 수 없고, 읽기를 따로
 * 한 줄 두는 것보다 눈이 덜 바쁘다(일본어 본래 모습이기도 하다).
 * 예문은 읽을거리지 쳐야 할 답이 아니므로 발음 줄과 같은 흐린 색이다.
 * 문절 사이는 띄우지 않는다.
 *
 * 해석을 입력란 **위에** 둔다. 아웃풋 연습이 목적이라 한국어 뜻을 먼저 읽고
 * 일본어를 만들어 보는 순서가 맞다.
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
    <div className={`line ${lineState(value.trim().length, want.length)}`}>
      <p className="ja-text">
        {tokens.map((t, ti) =>
          furigana(t.w ?? '', t.kana).map((part, pi) =>
            part.reading ? (
              <ruby key={`${ti}-${pi}`}>
                {part.text}
                <rt>{part.reading}</rt>
              </ruby>
            ) : (
              <React.Fragment key={`${ti}-${pi}`}>{part.text}</React.Fragment>
            ),
          ),
        )}
      </p>
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
