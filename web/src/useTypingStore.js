import { useCallback, useRef, useState } from 'react';

/**
 * 타이핑 중인 내용을 모아 둔다. 줄마다 들어오는 변경을
 * typing[lang][sid][줄 번호]에 쌓아 두고, "임시저장"이 그걸 통째로 보낸다.
 *
 * 값은 ref에 둔다. 글자마다 App을 다시 그리면 타이핑이 뚝뚝 끊긴다.
 * state는 저장 버튼에 쓸 "저장 안 된 변경이 있다"와 저장 시각만 들고 있는다.
 */
export function useTypingStore() {
  const ref = useRef({});
  const [dirty, setDirty] = useState(false);
  const [savedAt, setSavedAt] = useState(null);

  const load = useCallback((typing, updatedAt) => {
    ref.current = typing ? JSON.parse(JSON.stringify(typing)) : {};
    setDirty(false);
    setSavedAt(updatedAt ?? null);
  }, []);

  const report = useCallback((lang, sid, lineIndex, value) => {
    const byLang = ref.current[lang] ?? (ref.current[lang] = {});
    const bySid = byLang[sid] ?? (byLang[sid] = {});
    bySid[lineIndex] = value;
    setDirty((was) => was || true);
  }, []);

  const saved = useCallback((lang, sid, lineIndex) => ref.current?.[lang]?.[sid]?.[lineIndex], []);
  const snapshot = useCallback((lang) => ref.current?.[lang] ?? {}, []);
  const markSaved = useCallback((at) => {
    setDirty(false);
    setSavedAt(at ?? new Date().toISOString());
  }, []);

  return { load, report, saved, snapshot, markSaved, dirty, savedAt };
}
