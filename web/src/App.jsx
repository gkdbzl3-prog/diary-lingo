import React, { useCallback, useEffect, useState } from 'react';
import { createDiary, getDiary, listDiaries, saveTyping } from './api.js';
import { useTypingStore } from './useTypingStore.js';
import ZhSentence from './zh/ZhSentence.jsx';
import JaSentence from './ja/JaSentence.jsx';
import EnSentence from './en/EnSentence.jsx';
import FullText from './FullText.jsx';
import Notes from './Notes.jsx';

const LABEL = { zh: '중국어', ja: '일본어', en: '영어' };
const ORDER = ['zh', 'ja', 'en'];
const SENTENCE = { zh: ZhSentence, ja: JaSentence, en: EnSentence };

const clock = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

export default function App() {
  const [diaries, setDiaries] = useState([]);
  const [doc, setDoc] = useState(null);
  const [lang, setLang] = useState('zh');
  const [showFull, setShowFull] = useState(false);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const store = useTypingStore();

  const refresh = useCallback(async () => {
    const list = await listDiaries();
    setDiaries(list);
    return list;
  }, []);

  const openDoc = useCallback(
    (next) => {
      setDoc(next);
      store.load(next?.typing, next?.typingUpdatedAt);
      const available = Object.keys(next?.langs ?? {});
      setLang((current) => (available.includes(current) ? current : ORDER.find((l) => available.includes(l)) ?? 'zh'));
    },
    [store],
  );

  useEffect(() => {
    refresh()
      .then((list) => (list.length > 0 ? getDiary(list[0].id).then(openDoc) : null))
      .catch((err) => setError(err.message));
    // 처음 한 번만. openDoc은 store 때문에 매 렌더 새로 생긴다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const open = async (id) => {
    setError('');
    if (!id) {
      setDoc(null);
      return;
    }
    try {
      openDoc(await getDiary(id));
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
      openDoc(created);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const save = useCallback(async () => {
    if (!doc || saving) return;
    setSaving(true);
    setError('');
    try {
      const result = await saveTyping(doc.id, lang, store.snapshot(lang));
      store.markSaved(result.typingUpdatedAt);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }, [doc, lang, saving, store]);

  // Ctrl+S / Cmd+S 로도 임시저장
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        save();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [save]);

  // 저장 안 한 게 있으면 창을 닫기 전에 한 번 묻는다
  useEffect(() => {
    if (!store.dirty) return undefined;
    const warn = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [store.dirty]);

  const report = useCallback(
    (sid, lineIndex, value) => store.report(lang, sid, lineIndex, value),
    [store, lang],
  );
  const savedValue = useCallback((sid, lineIndex) => store.saved(lang, sid, lineIndex), [store, lang]);

  const available = Object.keys(doc?.langs ?? {}).filter((l) => ORDER.includes(l));
  const current = doc?.langs?.[lang];
  const Sentence = SENTENCE[lang];
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

      {doc ? (
        <div className="toolbar">
          <div className="tabs">
            {ORDER.map((l) => (
              <button
                type="button"
                key={l}
                className={l === lang ? 'tab tab-on' : 'tab'}
                disabled={!available.includes(l)}
                title={available.includes(l) ? '' : '이 일기에는 아직 없다'}
                onClick={() => setLang(l)}
              >
                {LABEL[l]}
              </button>
            ))}
          </div>

          <div className="toolbar-right">
            <button type="button" className="tab" onClick={() => setShowFull((v) => !v)}>
              {showFull ? '연습으로' : '전체 보기'}
            </button>
            <button type="button" className="save" onClick={save} disabled={saving || !store.dirty}>
              {saving ? '저장 중…' : '임시저장'}
            </button>
            <span className="save-state">
              {store.dirty ? '저장 안 된 변경' : store.savedAt ? `${clock(store.savedAt)} 저장됨` : ''}
            </span>
          </div>
        </div>
      ) : null}

      {doc && !current ? <p className="hint">이 일기에는 {LABEL[lang]} 결과가 없다.</p> : null}

      {current && showFull ? (
        <FullText koSentences={doc.ko.sentences} langSentences={current.sentences} lang={lang} />
      ) : null}

      {current && !showFull ? (
        <>
          <p className="hint">
            {lang === 'zh'
              ? '칸을 눌러 커서를 옮기고 중국어 IME로 타이핑한다.'
              : `${LABEL[lang]} IME로 줄마다 따라 타이핑한다.`}{' '}
            채점하지 않는다. Ctrl+S로도 임시저장된다.
            {current.meta?.failedIds?.length > 0 ? ` (빠진 문장: ${current.meta.failedIds.join(', ')})` : ''}
          </p>
          {current.sentences.map((s) => (
            <Sentence
              key={`${doc.id}:${lang}:${s.id}`}
              sentence={s}
              ko={koById.get(s.id) ?? ''}
              saved={savedValue}
              onChange={report}
            />
          ))}
          <Notes notes={current.notes} />
        </>
      ) : null}
    </main>
  );
}
