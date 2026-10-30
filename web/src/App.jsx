import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createDiary, deleteDiary, getDiary, listDiaries, retranslateDiary, saveTyping } from './api.js';
import { useTypingStore } from './useTypingStore.js';
import ZhSentence from './zh/ZhSentence.jsx';
import JaSentence from './ja/JaSentence.jsx';
import EnSentence from './en/EnSentence.jsx';
import FullText from './FullText.jsx';
import Notes from './Notes.jsx';
import Qa from './Qa.jsx';
import Dictionary from './Dictionary.jsx';
import Device from './Device.jsx';

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
  const [translationWarnings, setTranslationWarnings] = useState([]);
  const [failedLangs, setFailedLangs] = useState([]);
  // 삭제는 되돌릴 수 없다. 한 번 더 눌러야 지워진다.
  const [confirmDelete, setConfirmDelete] = useState(false);
  // 저장 직후 잠깐만 버튼 글자가 "저장됨"이 된다. 자리를 따로 먹지 않게.
  const [justSaved, setJustSaved] = useState(false);

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
      setTranslationWarnings(next?.warnings ?? []);
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
    const previous = doc;
    setBusy(true);
    setError('');
    setTranslationWarnings([]);
    setFailedLangs([]);
    setConfirmDelete(false);
    setDoc(null);
    const onProgress = (event) => {
      if (event.type === 'language') {
        setDoc(event.doc);
        setLang((current) => event.doc.langs[current] ? current : event.lang);
      } else if (event.type === 'warning') {
        setFailedLangs((current) => [...current, event.lang]);
        setTranslationWarnings((current) => [...current, event.message]);
      }
    };
    try {
      const result = previous
        ? await retranslateDiary(previous.id, draft, ORDER, onProgress)
        : await createDiary(draft, ORDER, onProgress);
      openDoc(result);
      // A list refresh failure must not discard an already saved translation.
      await refresh().catch((err) => setError(`번역은 저장됐지만 목록을 불러오지 못했다: ${err.message}`));
    } catch (err) {
      setDoc(previous);
      setLang((current) => previous?.langs?.[current] ? current : (ORDER.find((l) => previous?.langs?.[l]) ?? 'zh'));
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
    if (!doc || saving || busy) return;
    setSaving(true);
    setError('');
    try {
      const result = await saveTyping(doc.id, lang, store.snapshot(lang));
      store.markSaved(result.typingUpdatedAt);
      setJustSaved(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }, [doc, lang, saving, busy, store]);

  useEffect(() => {
    if (!justSaved) return undefined;
    const timer = setTimeout(() => setJustSaved(false), 2500);
    return () => clearTimeout(timer);
  }, [justSaved]);

  // 다시 치기 시작하면 바로 "임시저장"으로 돌아온다
  useEffect(() => {
    if (store.dirty) setJustSaved(false);
  }, [store.dirty]);

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
    if (!store.dirty && !busy) return undefined;
    const warn = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [store.dirty, busy]);

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
        <select disabled={busy} value={doc?.id ?? ''} onChange={(e) => open(e.target.value)}>
          <option value="">새 일기</option>
          {doc && !diaries.some((d) => d.id === doc.id) ? (
            <option value={doc.id}>{short(doc.title)} · 번역 중</option>
          ) : null}
          {diaries.map((d) => (
            <option key={d.id} value={d.id}>
              {d.id} · {short(d.title)}
            </option>
          ))}
        </select>
        {doc ? (
          <div className="head-actions">
            <button type="button" className="tab" disabled={busy} onClick={newDiary}>
              새 일기
            </button>
            {/* 한 번 누르면 옆에 취소가 생긴다. 삭제를 한 번 더 누르면 그때 지워진다. */}
            <button
              type="button"
              className={confirmDelete ? 'tab tab-delete tab-armed' : 'tab tab-delete'}
              disabled={busy}
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
          disabled={busy}
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
        <p className="hint" role="status">
          {ORDER.map((l) => `${LABEL[l]} ${available.includes(l) ? '완료' : failedLangs.includes(l) ? '실패' : '번역 중…'}`).join(' · ')}
          <br />먼저 끝난 언어부터 읽을 수 있습니다. 번역이 끝나면 저장되며, 연습과 질문을 할 수 있습니다.
        </p>
      ) : null}

      {doc && changed && !busy ? (
        <p className="hint">
          원문을 고쳤다. "다시 변환"을 누르면 이 일기를 다시 번역한다. 문장이 달라지므로
          여기 타이핑한 내용은 지워진다.
        </p>
      ) : null}

      {error ? <p className="error" role="alert">{error}</p> : null}
      {translationWarnings.length > 0 ? (
        <p className="error" role="alert">일부 번역을 완료하지 못했습니다. {translationWarnings.join(' / ')}</p>
      ) : null}

      {doc ? (
        <div className="toolbar">
          <div className="tabs">
            {ORDER.map((l) => (
              <button
                type="button"
                key={l}
                className={l === lang ? 'tab tab-on' : 'tab'}
                disabled={!available.includes(l)}
                title={available.includes(l) ? '' : failedLangs.includes(l) ? '번역 실패' : busy ? '번역 중' : '이 일기에는 아직 없다'}
                onClick={() => setLang(l)}
              >
                {LABEL[l]}
              </button>
            ))}
          </div>

          <div className="toolbar-right">
            {hasNotes && !busy ? (
              <button type="button" className="tab" onClick={() => scrollTo(notesRef)}>
                어휘·문법 ↓
              </button>
            ) : null}
            <button type="button" className="tab" disabled={busy} onClick={() => setShowFull((v) => !v)}>
              {showFull ? '연습으로' : '전체 보기'}
            </button>
            <button
              type="button"
              className={justSaved ? 'save save-done' : 'save'}
              onClick={save}
              disabled={busy || saving || !store.dirty}
              title={store.savedAt ? `마지막 저장 ${clock(store.savedAt)}` : ''}
            >
              {saving ? '저장 중…' : justSaved ? '저장됨' : '임시저장'}
            </button>
          </div>
        </div>
      ) : null}

      {doc && !current ? <p className="hint">이 일기에는 {LABEL[lang]} 결과가 없다.</p> : null}

      {current && (showFull || busy) ? (
        <FullText koSentences={doc.ko.sentences} langSentences={current.sentences} lang={lang} />
      ) : null}

      {current && !showFull && !busy ? (
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
        </>
      ) : null}

      {current && !busy ? <Notes notes={current.notes} anchorRef={notesRef} /> : null}

      {current && !busy ? (
        <Qa
          key={`${doc.id}:${lang}`}
          diaryId={doc.id}
          lang={lang}
          label={LABEL[lang]}
          initialTurns={doc.qa?.[lang] ?? []}
        />
      ) : null}

      {current ? <Dictionary key={lang} lang={lang} label={LABEL[lang]} /> : null}

      <footer className="app-foot">
        {doc ? (
          <button type="button" className="tab" onClick={() => scrollTo(topRef)}>
            ↑ 맨 위로
          </button>
        ) : null}
        {!busy ? <Device /> : null}
      </footer>
    </main>
  );
}
