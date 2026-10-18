import React, { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { deleteBack, firstTypeable, initialTyped, placeChars, prevTypeable } from './cells.js';

/**
 * 중국어 한 줄. [병음 · 한글 발음 · 田字格 칸 · 해석] 한 세트다.
 *
 * IME 때문에 칸마다 input을 두지 않는다. jintian 하나로 今天 두 글자가 한꺼번에
 * 확정되기 때문이다. 줄마다 보이지 않는 input을 하나만 두고, 확정된 글자를
 * 칸에 순서대로 나눠 넣는다. 그 input을 지금 칸 위로 옮겨서 IME 후보창이
 * 칸 근처에 뜨게 한다.
 *
 * 칸을 채우는 규칙 자체는 cells.js의 순수 함수에 있다(테스트용).
 */
export default function TypingLine({ cells, gloss }) {
  const [typed, setTyped] = useState(() => initialTyped(cells));
  const [cursor, setCursor] = useState(() => firstTypeable(cells, 0));
  const [composing, setComposing] = useState('');
  const [focused, setFocused] = useState(false);
  const [box, setBox] = useState(null);

  const inputRef = useRef(null);
  const rowRef = useRef(null);
  const cellRefs = useRef([]);

  // 이벤트 핸들러는 state를 기다릴 수 없다(한 번에 여러 글자가 들어온다).
  // 그래서 ref를 진짜 값으로 두고 state는 화면용으로만 따라가게 한다.
  const typedRef = useRef(typed);
  const cursorRef = useRef(cursor);

  // compositionend 바로 뒤에 브라우저가 같은 글자로 input을 한 번 더 보내는 걸 걸러낸다.
  const echoRef = useRef(false);

  const apply = useCallback(({ typed: nextTyped, cursor: nextCursor }) => {
    typedRef.current = nextTyped;
    cursorRef.current = nextCursor;
    setTyped(nextTyped);
    setCursor(nextCursor);
  }, []);

  const moveTo = useCallback(
    (at) => {
      const next = firstTypeable(cells, at);
      cursorRef.current = next;
      setCursor(next);
      inputRef.current?.focus();
    },
    [cells],
  );

  const place = useCallback(
    (text) => {
      if (!text) return;
      apply(placeChars(cells, typedRef.current, cursorRef.current, text));
    },
    [apply, cells],
  );

  const backspace = useCallback(() => {
    apply(deleteBack(cells, typedRef.current, cursorRef.current));
  }, [apply, cells]);

  // 숨긴 input을 지금 칸 위로 옮긴다. IME 후보창 위치가 여기서 결정된다.
  useLayoutEffect(() => {
    const measure = () => {
      // 줄을 다 채우면 cursor가 칸 수와 같아진다. 그때는 마지막 칸에 붙여 둔다.
      const cell = cellRefs.current[Math.min(cursor, cells.length - 1)];
      const row = rowRef.current;
      if (!cell || !row) {
        setBox(null);
        return;
      }
      const c = cell.getBoundingClientRect();
      const r = row.getBoundingClientRect();
      setBox({ left: c.left - r.left, top: c.top - r.top, width: c.width, height: c.height });
    };

    measure();

    const row = rowRef.current;
    if (!row || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(row);
    return () => observer.disconnect();
  }, [cursor, cells.length]);

  const onInput = (e) => {
    const el = e.currentTarget;
    if (e.nativeEvent.isComposing) return; // 조합 중. 확정될 때 처리한다.
    if (echoRef.current) {
      echoRef.current = false;
      el.value = '';
      return;
    }
    const value = el.value;
    el.value = '';
    place(value);
  };

  const onCompositionEnd = (e) => {
    setComposing('');
    const data = e.data ?? '';
    e.currentTarget.value = '';
    if (!data) return;
    place(data);
    // 이 뒤에 오는 input 한 번만 무시한다. 안 보내는 브라우저도 있어서 다음 틱에 플래그를 내린다.
    echoRef.current = true;
    setTimeout(() => {
      echoRef.current = false;
    }, 0);
  };

  const onKeyDown = (e) => {
    if (e.nativeEvent.isComposing) return; // 조합 중에는 IME가 키를 가져간다.

    if (e.key === 'Backspace') {
      if (e.currentTarget.value !== '') return;
      e.preventDefault();
      backspace();
      return;
    }
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const at = prevTypeable(cells, cursorRef.current);
      if (at >= 0) moveTo(at);
      return;
    }
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      moveTo(cursorRef.current + 1);
    }
  };

  const placed = focused && box;

  return (
    <div className="line">
      <div className="line-row line-py">
        {cells.map((cell, i) => (
          <span className="cell-label" key={i}>
            {cell.py}
          </span>
        ))}
      </div>

      <div className="line-row line-pron">
        {cells.map((cell, i) => (
          <span className="cell-label" key={i}>
            {cell.pron}
          </span>
        ))}
      </div>

      <div className="line-row line-boxes" ref={rowRef}>
        {cells.map((cell, i) => (
          <button
            type="button"
            key={i}
            ref={(el) => {
              cellRefs.current[i] = el;
            }}
            className={[
              'cell',
              cell.locked ? 'cell-locked' : '',
              !cell.locked && focused && i === cursor ? 'cell-active' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            tabIndex={-1}
            onPointerDown={(e) => {
              e.preventDefault();
              moveTo(i);
            }}
          >
            <span className="cell-char">{typed[i]}</span>
            {!cell.locked && i === cursor && composing ? (
              <span className="cell-composing">{composing}</span>
            ) : null}
          </button>
        ))}

        <input
          ref={inputRef}
          className="line-input"
          // IME 후보창이 칸 근처에 뜨도록 지금 칸 위에 겹쳐 둔다.
          style={
            placed
              ? { left: box.left, top: box.top, width: box.width, height: box.height }
              : { left: 0, top: 0, width: 1, height: 1 }
          }
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          lang="zh-CN"
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onInput={onInput}
          onCompositionStart={(e) => setComposing(e.data ?? '')}
          onCompositionUpdate={(e) => setComposing(e.data ?? '')}
          onCompositionEnd={onCompositionEnd}
          onKeyDown={onKeyDown}
        />
      </div>

      <p className="line-gloss">{gloss}</p>
    </div>
  );
}
