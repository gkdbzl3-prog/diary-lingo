import React, { useState } from 'react';
import { askQa, clearQa } from './api.js';
import { parseBlocks } from './markdown.js';

/** 답에 섞여 오는 좁은 마크다운(굵게·목록)만 그린다. */
function Answer({ text }) {
  return (
    <>
      {parseBlocks(text).map((block, i) =>
        block.type === 'ul' ? (
          <ul key={i}>
            {block.items.map((spans, j) => (
              <li key={j}>
                {spans.map((s, k) => (s.bold ? <strong key={k}>{s.text}</strong> : <span key={k}>{s.text}</span>))}
              </li>
            ))}
          </ul>
        ) : (
          <p key={i}>
            {block.spans.map((s, k) => (s.bold ? <strong key={k}>{s.text}</strong> : <span key={k}>{s.text}</span>))}
          </p>
        ),
      )}
    </>
  );
}

/**
 * 하단 Q&A. 일기 원문과 그 언어 번역을 맥락으로 넣고 답은 한국어로 받는다.
 * 문답은 일기에 함께 저장되므로 다시 열어도 남아 있다.
 */
export default function Qa({ diaryId, lang, label, initialTurns }) {
  const [turns, setTurns] = useState(initialTurns ?? []);
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);
  // 오는 대로 쌓이는 답. 다 오면 turns에 들어가고 비워진다.
  const [streaming, setStreaming] = useState('');

  const send = async (e) => {
    e?.preventDefault();
    if (busy || question.trim() === '') return;
    const asked = question.trim();
    setBusy(true);
    setError('');
    setStreaming('');
    setQuestion('');
    // 보낸 질문을 바로 올려 둔다. 답은 글자가 오는 대로 그 아래에 쌓인다.
    setTurns((prev) => [...prev, { role: 'user', text: asked }]);

    try {
      const result = await askQa(diaryId, lang, asked, (delta) =>
        setStreaming((prev) => prev + delta),
      );
      setTurns(result.turns);
      if (result.truncated) setError('답이 길어서 잘렸다. 더 좁혀서 물어보면 좋다.');
    } catch (err) {
      setError(err.message);
      // 답을 못 받았으니 올려 뒀던 질문을 되돌린다.
      setTurns((prev) => prev.slice(0, -1));
      setQuestion(asked);
    } finally {
      setStreaming('');
      setBusy(false);
    }
  };

  const clear = async () => {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    setConfirmClear(false);
    try {
      await clearQa(diaryId, lang);
      setTurns([]);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <section className="qa">
      <div className="qa-head">
        <h2>물어보기</h2>
        {turns.length > 0 ? (
          <div className="head-actions">
            <button
              type="button"
              className={confirmClear ? 'tab tab-delete tab-armed' : 'tab tab-delete'}
              onClick={clear}
            >
              대화 지우기
            </button>
            {confirmClear ? (
              <button type="button" className="tab" onClick={() => setConfirmClear(false)}>
                취소
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {turns.length === 0 ? (
        <p className="hint">
          이 일기의 {label} 번역을 두고 궁금한 걸 물어본다. 답은 한국어로 온다.
          일기 원문과 번역, 어휘·문법이 맥락으로 함께 들어간다.
        </p>
      ) : null}

      <div className="qa-thread">
        {turns.map((turn, i) =>
          turn.role === 'user' ? (
            <p className="qa-q" key={i}>
              {turn.text}
            </p>
          ) : (
            <div className="qa-a" key={i}>
              <Answer text={turn.text} />
            </div>
          ),
        )}
        {streaming ? (
          <div className="qa-a">
            <Answer text={streaming} />
          </div>
        ) : busy ? (
          <p className="hint">생각 중…</p>
        ) : null}
      </div>

      {error ? <p className="error">{error}</p> : null}

      <form className="qa-form" onSubmit={send}>
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          rows={2}
          placeholder={'예) #3의 了는 왜 붙었나?  (엔터로 묻기, Shift+엔터로 줄바꿈)'}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return;
            // 한자·가나 변환 중의 엔터는 IME가 가져간다. 건드리면 안 된다.
            if (e.nativeEvent.isComposing) return;
            if (e.shiftKey) return; // 줄바꿈
            e.preventDefault();
            send(e);
          }}
        />
        <button type="submit" disabled={busy || question.trim() === ''}>
          {busy ? '…' : '묻기'}
        </button>
      </form>
    </section>
  );
}
