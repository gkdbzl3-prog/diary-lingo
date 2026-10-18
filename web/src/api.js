async function json(res) {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `${res.status} ${res.statusText}`);
  }
  return res.json();
}

export const listDiaries = () => fetch('/api/diaries').then(json).then((d) => d.diaries);
export const getDiary = (id) => fetch(`/api/diaries/${id}`).then(json);
export const createDiary = (text, langs) =>
  fetch('/api/diaries', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text, langs }),
  }).then(json);
export const saveTyping = (id, lang, typing) =>
  fetch(`/api/diaries/${id}/typing`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ lang, typing }),
  }).then(json);

/** 원문을 고쳐 다시 번역한다. id는 그대로 두고 타이핑한 내용은 버린다. */
export const retranslateDiary = (id, text, langs) =>
  fetch(`/api/diaries/${id}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text, langs }),
  }).then(json);

/** 일기를 지운다. 되돌릴 수 없다. */
export const deleteDiary = (id) =>
  fetch(`/api/diaries/${id}`, { method: 'DELETE' }).then(json);
