import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createDiary, deleteDiary, getDiary, listDiaries, retranslateDiary, saveTyping } from './api.js';
import { useTypingStore } from './useTypingStore.js';
import ZhSentence from './zh/ZhSentence.jsx';
import JaSentence from './ja/JaSentence.jsx';
import EnSentence from './en/EnSentence.jsx';
import FullText from './FullText.jsx';
import Notes from './Notes.jsx';

const LABEL = { zh: '중국어', ja: '일본어', en: '영어' };
const ORDER = ['zh', 'ja', 'en'];
const SENTENCE = { zh: ZhSentence, ja: JaSentence, en: EnSentence };

/** 드롭다운이 너비를 다 먹으면 옆 버튼이 아래로 밀린다. 제목을 줄여서 띄운다. */
const short = (t) => (t && t.length > 22 ? `${t.slice(0, 22)}…` : (t ?? ''));

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
  // 삭제는 되돌릴 수 없다. 한 번 더 눌러야 지워진다.
  const [confirmDelete, setConfirmDelete] = useState(false);

  const store = useTypingStore();
  const topRef = useRef(null);
  const notesRef = useRef(null);

  const refresh = useCallback(async () => {
    const list = await listDiaries();
    setDiaries(list);
    return list;
  }, []);

  const openDoc = useCallback(
    (next) => {
      setDoc(next);
      setConfirmDelete(false);
      // 원문은 지우지 않는다. 고쳐서 다시 변환할 수 있게 입력란에 그대로 둔다.
      setDraft(next?.text ?? '');
      store.load(next?.typing, next?.typingUpdatedAt);
      const available = Object.keys(next?.langs ?? {});
      setLang((current) =>
        available.includes(current) ? current : (ORDER.find((l) => available.includes(l)) ?? 'zh'),
      );
    },
    [store],
  );

  useEffect(() => {
    refresh()
      .then((list) => (list.length > 0 ? getDiary(list[0].id).then(openDoc) : null))
      .catch((err) => setError(err.message));
    // 처음 한 번만.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const open = async (id) => {
    setError('');
    if (!id) {
      openDoc(null);
      return;
    }
    try {
      openDoc(await getDiary(id));
    } catch (err) {
      setError(err.message);
    }
  };

  const changed = doc ? draft.trim() !== (doc.text ?? '').trim() : draft.trim() !== '';

  const submit = async (e) => {
    e?.preventDefault();
    if (busy || draft.trim() === '' || !changed) return;
    setBusy(true);
    setError('');
    try {
      // 일기를 열어 둔 채 원문을 고쳤으면 그 일기를 다시 번역한다. 새로 쌓지 않는다.
      const result = doc
        ? await retranslateDiary(doc.id, draft, ORDER)
        : await createDiary(draft, ORDER);
      await refresh();
      openDoc(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const newDiary = () => {
    setError('');
    openDoc(null);
    setDraft('');
  };

  const remove = async () => {
    if (!doc) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setConfirmDelete(false);
    setError('');
    try {
      await deleteDiary(doc.id);
      const list = await refresh();
      openDoc(list.length > 0 ? await getDiary(list[0].id) : null);
      if (list.length === 0) setDraft('');
    } catch (err) {
      setError(err.message);
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

  const scrollTo = (ref) => ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const available = Object.keys(doc?.langs ?? {}).filter((l) => ORDER.includes(l));
  const current = doc?.langs?.[lang];
  const Sentence = SENTENCE[lang];
  const koById = new Map((doc?.ko?.sentences ?? []).map((s) => [s.id, s.ko]));
  const hasNotes = (current?.notes?.vocab?.length ?? 0) + (current?.notes?.highlights?.length ?? 0) > 0;

  return (
    <main className="app" ref={topRef}>
      <header className="app-head">
        <h1>Diary-lingo</h1>
        <select value={doc?.id ?? ''} onChange={(e) => open(e.target.value)}>
          <option value="">새 일기</option>
          {diaries.map((d) => (
            <option key={d.id} value={d.id}>
              {d.id} · {short(d.title)}
            </option>
          ))}
        </select>
        {doc ? (
          <div className="head-actions">
            <button type="button" className="tab" onClick={newDiary}>
              새 일기
            </button>
            {/* 한 번 누르면 옆에 취소가 생긴다. 삭제를 한 번 더 누르면 그때 지워진다. */}
            <button
              type="button"
              className={confirmDelete ? 'tab tab-delete tab-armed' : 'tab tab-delete'}
              onClick={remove}
              title={
                confirmDelete
                  ? `한 번 더 누르면 ${doc.id}가 지워진다`
                  : `${doc.id} 지우기 (되돌릴 수 없다)`
              }
            >
              삭제
            </button>
            {confirmDelete ? (
              <button type="button" className="tab" onClick={() => setConfirmDelete(false)}>
                취소
              </button>
            ) : null}
          </div>
        ) : null}
      </header>

      <form className="new-diary" onSubmit={submit}>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={4}
          placeholder="한국어 일기를 붙여 넣고 Ctrl+Enter"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submit(e);
          }}
        />
        <button
          type="submit"
          disabled={busy || draft.trim() === '' || !changed}
          title={doc && !changed ? '원문을 고치면 다시 변환할 수 있다' : ''}
        >
          {busy ? '번역 중…' : doc ? '다시 변환' : '세 언어로'}
        </button>
      </form>

      {confirmDelete ? (
        <p className="error">
          삭제를 한 번 더 누르면 {doc?.id}가 지워진다. 번역 결과와 타이핑한 내용이 함께
          사라지고 되돌릴 수 없다.
        </p>
      ) : null}

      {busy ? (
        <p className="hint">중국어·일본어·영어를 한꺼번에 번역한다. 문장 10개쯤이면 2~3분 걸린다.</p>
      ) : null}

      {doc && changed && !busy ? (
        <p className="hint">
          원문을 고쳤다. "다시 변환"을 누르면 이 일기를 다시 번역한다. 문장이 달라지므로
          여기 타이핑한 내용은 지워진다.
        </p>
      ) : null}

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
            {hasNotes && !showFull ? (
              <button type="button" className="tab" onClick={() => scrollTo(notesRef)}>
                어휘·문법 ↓
              </button>
            ) : null}
            <button type="button" className="tab" onClick={() => setShowFull((v) => !v)}>
              {showFull ? '연습으로' : '전체 보기'}
            </button>
            <button type="button" className="save" onClick={save} disabled={saving || !store.dirty}>
              {saving ? '저장 중…' : '임시저장'}
            </button>
            <span className="save-state">{store.savedAt ? `${clock(store.savedAt)} 저장됨` : ''}</span>
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
            엔터를 치면 다음 줄로 넘어간다. 채점하지 않는다. Ctrl+S로도 임시저장된다.
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
          <Notes notes={current.notes} anchorRef={notesRef} />
        </>
      ) : null}

      {doc ? (
        <footer className="app-foot">
          <button type="button" className="tab" onClick={() => scrollTo(topRef)}>
            ↑ 맨 위로
          </button>
        </footer>
      ) : null}
    </main>
  );
}
