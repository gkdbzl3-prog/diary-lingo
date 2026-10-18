import React, { useEffect, useRef, useState } from 'react';
import { lookupTerm } from './api.js';

/**
 * 옆에 두는 작은 사전. 긁어서 붙여 넣으면 바로 뜻이 뜬다.
 *
 * 기본은 접힌 상태다. 손잡이만 오른쪽 가장자리에 붙어 있고, 누르면 열린다.
 * 넓은 화면(1100px 이상)에서는 열린 동안 본문이 그만큼 왼쪽으로 비켜 주고,
 * 좁은 화면에서는 본문 위로 덮는다.
 */
export default function Dictionary({ lang, label }) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState('');
  const [entry, setEntry] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [recent, setRecent] = useState([]);
  const inputRef = useRef(null);

  // 넓은 화면에서 열려 있을 때만 본문을 비켜 준다. 좁은 화면에서는 덮는다.
  useEffect(() => {
    document.body.classList.toggle('dict-open', open);
    return () => document.body.classList.remove('dict-open');
  }, [open]);

  const run = async (text) => {
    const wanted = text.trim();
    if (wanted === '' || busy) return;
    setBusy(true);
    setError('');
    try {
      const result = await lookupTerm(lang, wanted);
      setEntry(result);
      setRecent((prev) => [result, ...prev.filter((r) => r.term !== result.term)].slice(0, 8));
    } catch (err) {
      setError(err.message);
      setEntry(null);
    } finally {
      setBusy(false);
    }
  };

  // 붙여 넣으면 바로 찾는다. 버튼을 한 번 더 누르지 않아도 되게.
  const onPaste = (e) => {
    const pasted = (e.clipboardData?.getData('text') ?? '').trim();
    if (pasted === '') return;
    e.preventDefault();
    setTerm(pasted);
    run(pasted);
  };

  return (
    <aside className={open ? 'dict dict-is-open' : 'dict'}>
      <button
        type="button"
        className="dict-toggle"
        onClick={() => {
          setOpen((v) => !v);
          if (!open) setTimeout(() => inputRef.current?.focus(), 200);
        }}
        title={open ? '사전 닫기' : '사전 열기'}
        aria-label={open ? '사전 닫기' : '사전 열기'}
      >
        <span className="dict-toggle-arrow">{open ? '›' : '‹'}</span>
        <span className="dict-toggle-label">사전</span>
      </button>

      <div className="dict-body">
        <h2>사전 · {label}</h2>

        <form
          className="dict-form"
          onSubmit={(e) => {
            e.preventDefault();
            run(term);
          }}
        >
          <input
            ref={inputRef}
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            onPaste={onPaste}
            placeholder="모르는 단어를 적어보세요"
            autoComplete="off"
            spellCheck={false}
          />
          <button type="submit" disabled={busy || term.trim() === ''}>
            {busy ? '…' : '찾기'}
          </button>
        </form>

        {error ? <p className="error">{error}</p> : null}

        {entry ? (
          <div className="dict-entry">
            <p className="dict-term">
              {entry.term} <span className="dict-pos">{entry.pos}</span>
            </p>
            <p className="dict-reading">{entry.reading}</p>
            <p className="dict-pron">{entry.pron}</p>

            {entry.meanings?.length > 0 ? (
              <ol className="dict-meanings">
                {entry.meanings.map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ol>
            ) : (
              <p className="hint">뜻을 찾지 못했다.</p>
            )}

            {entry.note ? <p className="dict-note">{entry.note}</p> : null}

            {entry.examples?.map((ex, i) => (
              <div className="dict-example" key={i}>
                <p>{ex.text}</p>
                <p className="dict-example-ko">{ex.ko}</p>
              </div>
            ))}
          </div>
        ) : null}

        {recent.length > 1 ? (
          <div className="dict-recent">
            {recent.map((r) => (
              <button
                type="button"
                key={r.term}
                className={entry?.term === r.term ? 'dict-chip dict-chip-on' : 'dict-chip'}
                onClick={() => setEntry(r)}
              >
                {r.term}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </aside>
  );
}
