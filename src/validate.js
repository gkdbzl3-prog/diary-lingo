// 언어와 상관없는 검증: 요청한 문장 id가 빠짐없이, 군더더기 없이, 오름차순으로 왔는지.
// 문장 하나를 보는 일은 언어별 checkSentence가 한다.

export const chars = (s) => Array.from(s);

/** 비교할 때만 공백을 떼어 낸다. 화면에는 공백을 쓰지 않는다. */
export const stripSpace = (s) => (typeof s === 'string' ? s.replace(/\s+/gu, '') : '');

/** 영어는 공백이 의미가 있으므로 여러 칸을 한 칸으로만 줄인다. */
export const collapseSpace = (s) => (typeof s === 'string' ? s.replace(/\s+/gu, ' ').trim() : '');

/**
 * @param {object} payload AI 응답
 * @param {number[]} requestIds 이번에 요청한 문장 id
 * @param {(sentence: object) => string[]} checkSentence 문장 하나를 보고 문제 목록을 돌려준다
 * @returns {{ ok: number[], failed: Map<number, string[]>, global: string[] }}
 */
export function validatePayload(payload, requestIds, checkSentence) {
  const global = [];
  const failed = new Map();
  const ok = [];

  const sentences = Array.isArray(payload?.sentences) ? payload.sentences : [];
  const got = sentences.map((s) => s?.id);

  const missing = requestIds.filter((id) => !got.includes(id));
  if (missing.length > 0) {
    global.push(`빠진 문장 id: ${missing.join(', ')}`);
  }
  const extra = got.filter((id) => !requestIds.includes(id));
  if (extra.length > 0) {
    global.push(`요청하지 않은 문장 id가 왔다: ${extra.join(', ')}`);
  }
  const asked = got.filter((id) => requestIds.includes(id));
  const sorted = [...asked].sort((a, b) => a - b);
  if (asked.join(',') !== sorted.join(',')) {
    global.push(`문장 순서가 오름차순이 아니다: ${asked.join(', ')}`);
  }

  for (const sentence of sentences) {
    if (!requestIds.includes(sentence?.id)) continue;
    const problems = checkSentence(sentence);
    if (problems.length > 0) failed.set(sentence.id, problems);
    else ok.push(sentence.id);
  }

  for (const id of missing) {
    failed.set(id, [`#${id}: 응답에 아예 없다`]);
  }

  return { ok, failed, global };
}
