async function json(res) {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `${res.status} ${res.statusText}`);
  }
  return res.json();
}

export const listDiaries = () => fetch('/api/diaries').then(json).then((d) => d.diaries);
export const getDiary = (id) => fetch(`/api/diaries/${id}`).then(json);
/** Receive finished languages immediately; resolve only after the server saves the diary. */
async function translateDiary(url, method, text, langs, onProgress) {
  const res = await fetch(url, {
    method,
    headers: { 'content-type': 'application/json', accept: 'text/event-stream' },
    body: JSON.stringify({ text, langs }),
  });
  if (!res.ok || !res.headers.get('content-type')?.includes('text/event-stream')) return json(res);
  if (!res.body) throw new Error('번역 연결이 끊겼다. 일기 목록에서 저장 여부를 확인해 주세요.');
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const frames = buffer.split('\n\n');
      buffer = frames.pop() ?? '';
      for (const frame of frames) {
        const data = frame.split('\n').filter((line) => line.startsWith('data:')).map((line) => line.slice(5).trimStart()).join('\n');
        if (!data) continue; // Heartbeat comments keep long translations connected.
        const event = JSON.parse(data);
        if (event.type === 'error') throw new Error(event.error);
        if (event.type === 'done') return event.doc;
        onProgress?.(event);
      }
    }
    throw new Error('번역 연결이 끊겼다. 일기 목록에서 저장 여부를 확인해 주세요.');
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

export const createDiary = (text, langs, onProgress) =>
  translateDiary('/api/diaries', 'POST', text, langs, onProgress);
export const saveTyping = (id, lang, typing) =>
  fetch(`/api/diaries/${id}/typing`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ lang, typing }),
  }).then(json);

/** 원문을 고쳐 다시 번역한다. id는 그대로 두고 타이핑한 내용은 버린다. */
export const retranslateDiary = (id, text, langs, onProgress) =>
  translateDiary(`/api/diaries/${id}`, 'PUT', text, langs, onProgress);

/** 일기를 지운다. 되돌릴 수 없다. */
export const deleteDiary = (id) =>
  fetch(`/api/diaries/${id}`, { method: 'DELETE' }).then(json);

/**
 * 하단 Q&A. 지난 문답에 이어서 묻는다. 답은 한국어로 온다.
 * 답을 다 기다리면 10초 넘게 빈 화면이라 글자가 오는 대로 받는다(SSE).
 * @param {(text: string) => void} onDelta
 * @returns {Promise<{turns: object[], truncated: boolean}>}
 */
export async function askQa(id, lang, question, onDelta) {
  const res = await fetch(`/api/diaries/${id}/qa`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ lang, question }),
  });

  // 스트림이 열리기 전에 막힌 경우(400·404 등)는 평범한 JSON으로 온다.
  if (!res.ok || !res.body) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `${res.status} ${res.statusText}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let result = null;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split('\n\n');
    buffer = chunks.pop() ?? '';

    for (const chunk of chunks) {
      const line = chunk.replace(/^data: /, '').trim();
      if (line === '') continue;
      const message = JSON.parse(line);
      if (message.error) throw new Error(message.error);
      if (message.delta) onDelta?.(message.delta);
      else if (message.done) result = message;
    }
  }

  if (!result) throw new Error('답이 중간에 끊겼다');
  return result;
}

export const clearQa = (id, lang) =>
  fetch(`/api/diaries/${id}/qa?lang=${lang}`, { method: 'DELETE' }).then(json);

/** 옆에 두는 작은 사전. 긁어 붙여 넣은 말의 뜻을 찾는다. */
export const lookupTerm = (lang, term) =>
  fetch('/api/lookup', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ lang, term }),
  }).then(json);

/** 이 기기 코드. 쿠키가 HttpOnly라 화면은 서버에 물어본다. */
export const getMe = () => fetch('/api/me').then(json);

/** 다른 기기에서 쓰던 코드로 갈아탄다. 저장된 것이 있는 코드만 받는다. */
export const switchDevice = (device) =>
  fetch('/api/me', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ device }),
  }).then(json);
