import React, { useCallback, useEffect, useState } from 'react';
import { createDiary, getDiary, listDiaries } from './api.js';
import ZhSentence from './zh/ZhSentence.jsx';
import Notes from './Notes.jsx';

export default function App() {
  const [diaries, setDiaries] = useState([]);
  const [doc, setDoc] = useState(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    const list = await listDiaries();
    setDiaries(list);
    return list;
  }, []);

  useEffect(() => {
    refresh()
      .then((list) => (list.length > 0 ? getDiary(list[0].id).then(setDoc) : null))
      .catch((err) => setError(err.message));
  }, [refresh]);

  const open = async (id) => {
    setError('');
    if (!id) {
      setDoc(null);
      return;
    }
    try {
      setDoc(await getDiary(id));
    } catch (err) {
      setError(err.message);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (draft.trim() === '' || busy) return;
    setBusy(true);
    setError('');
    try {
      const created = await createDiary(draft, ['zh']);
      setDraft('');
      await refresh();
      setDoc(created);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const zh = doc?.langs?.zh;
  const koById = new Map((doc?.ko?.sentences ?? []).map((s) => [s.id, s.ko]));

  return (
    <main className="app">
      <header className="app-head">
        <h1>diary-lingo</h1>
        <select value={doc?.id ?? ''} onChange={(e) => open(e.target.value)}>
          <option value="">일기 고르기</option>
          {diaries.map((d) => (
            <option key={d.id} value={d.id}>
              {d.id} · {d.title}
            </option>
          ))}
        </select>
      </header>

      <form className="new-diary" onSubmit={submit}>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={3}
          placeholder="한국어 일기를 붙여 넣고 Ctrl+Enter"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submit(e);
          }}
        />
        <button type="submit" disabled={busy || draft.trim() === ''}>
          {busy ? '번역 중…' : '중국어로'}
        </button>
      </form>

      {error ? <p className="error">{error}</p> : null}

      {doc && !zh ? <p className="hint">이 일기에는 중국어 결과가 없다.</p> : null}

      {zh ? (
        <>
          <p className="hint">
            칸을 눌러 커서를 옮기고 중국어 IME로 타이핑한다. 채점하지 않는다.
            {zh.meta?.failedIds?.length > 0 ? ` (빠진 문장: ${zh.meta.failedIds.join(', ')})` : ''}
          </p>
          {zh.sentences.map((s) => (
            <ZhSentence key={`${doc.id}:${s.id}`} sentence={s} ko={koById.get(s.id) ?? ''} />
          ))}
          <Notes notes={zh.notes} />
        </>
      ) : null}
    </main>
  );
}
