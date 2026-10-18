// 원문 전체 보기와 번역 전체 보기. 문장을 문단(p) 기준으로 이어 붙인다.
// 추가 API 호출은 없다.

/** 언어마다 문장 사이를 무엇으로 이을지. 중국어·일본어는 붙이고 영어는 띄운다. */
const JOIN = { zh: '', ja: '', en: ' ' };

/**
 * @param {{id:number,p:number,ko:string}[]} koSentences
 * @param {{id:number,text:string}[]} [langSentences] 없으면 원문만 만든다
 * @param {'zh'|'ja'|'en'} [lang]
 * @returns {{ p:number, ko:string, text:string }[]} 문단 목록
 */
export function paragraphs(koSentences, langSentences, lang) {
  const byId = new Map((langSentences ?? []).map((s) => [s.id, s.text ?? '']));
  const join = JOIN[lang] ?? ' ';
  const out = new Map();

  for (const s of koSentences ?? []) {
    if (!out.has(s.p)) out.set(s.p, { p: s.p, ko: [], text: [] });
    const row = out.get(s.p);
    row.ko.push(s.ko);
    const translated = byId.get(s.id);
    if (translated) row.text.push(translated);
  }

  return [...out.values()]
    .sort((a, b) => a.p - b.p)
    .map((row) => ({ p: row.p, ko: row.ko.join(' '), text: row.text.join(join) }));
}
