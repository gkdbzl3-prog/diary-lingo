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
