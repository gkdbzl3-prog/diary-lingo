import path from 'node:path';
import express from 'express';
import { splitKoreanDiary } from './sentences.js';
import { translate } from './translate.js';
import { ask } from './qa.js';
import { lookup } from './lookup.js';
import { SUPPORTED } from './langs.js';
import { config } from './config.js';
import { backend, storeFor, titleOf } from './store.js';
import { device, isValidDevice, setDeviceCookie } from './device.js';

const PORT = Number(process.env.PORT ?? 3000);
const app = express();

app.use(express.json({ limit: '1mb' }));

// 기기 코드를 붙인다. 일기는 전부 이 코드 밑에 저장되고, 남은 다른 코드를 받는다.
app.use(device);
// 요청마다 제 기기 몫만 보는 저장소를 쥐여 준다.
app.use((req, res, next) => {
  req.store = storeFor(req.device);
  next();
});

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    model: config.model,
    langs: SUPPORTED,
    hasKey: Boolean(process.env.ANTHROPIC_API_KEY),
    store: backend,
  });
});

/**
 * 이 기기 코드를 알려 준다. 쿠키가 HttpOnly라 화면은 이걸로 받아 간다.
 * 코드를 잃으면 그 일기를 못 찾으므로 화면 맨 아래에 적어 둔다.
 */
app.get('/api/me', async (req, res) => {
  res.json({ device: req.device, hasDiaries: await req.store.exists() });
});

/**
 * 다른 기기에서 쓰던 코드로 갈아탄다. 폰과 노트북에서 같은 일기를 보려는 용도다.
 * body: { device }
 *
 * 없는 코드로 갈아타면 빈 화면이 뜨고 쓰던 코드는 잃는다. 오타가 그대로 사고가 되므로
 * 저장된 것이 있는 코드만 받는다.
 */
app.put('/api/me', async (req, res) => {
  const wanted = String(req.body?.device ?? '').trim().toLowerCase();
  if (!isValidDevice(wanted)) {
    res.status(400).json({ error: '기기 코드는 32자리 영문 소문자와 숫자다' });
    return;
  }
  if (wanted === req.device) {
    res.json({ device: req.device, changed: false });
    return;
  }
  if (!(await storeFor(wanted).exists())) {
    res.status(404).json({ error: '그 코드로 저장된 일기가 없다. 코드를 다시 확인해라' });
    return;
  }
  setDeviceCookie(req, res, wanted);
  res.json({ device: wanted, changed: true });
});

app.get('/api/diaries', async (req, res) => {
  res.json({ diaries: await req.store.listDiaries() });
});

app.get('/api/diaries/:id', async (req, res) => {
  const { id } = req.params;
  if (!(await req.store.hasDiary(id))) {
    res.status(404).json({ error: `일기를 찾을 수 없다: ${id}` });
    return;
  }
  res.json(await req.store.readDiary(id));
});

app.delete('/api/diaries/:id', async (req, res) => {
  const { id } = req.params;
  if (!(await req.store.hasDiary(id))) {
    res.status(404).json({ error: `일기를 찾을 수 없다: ${id}` });
    return;
  }
  try {
    await req.store.removeDiary(id);
    res.json({ ok: true, id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * 언어별로 병렬 번역해서 doc.langs에 채운다.
 * @returns {string[]} 실패한 언어 설명 목록
 */
async function fillTranslations(doc, langs) {
  const settled = await Promise.allSettled(
    langs.map(async (lang) => [lang, await translate({ lang, sentences: doc.ko.sentences })]),
  );

  const failed = [];
  settled.forEach((entry, i) => {
    if (entry.status === 'rejected') {
      failed.push(`${langs[i]}: ${entry.reason?.message ?? entry.reason}`);
      return;
    }
    const [lang, result] = entry.value;
    // 한 문장도 못 건지면 빈 껍데기가 남는다. 그대로 저장하면 화면이 조용히 비어 보이고
    // (langs에 키가 있으니 "모두 실패" 검사도 통과한다) 왜인지도 알 수 없다.
    // 사유를 들고 실패로 올려서 날님이 빈 화면 대신 까닭을 보게 한다.
    if (result.sentences.length === 0) {
      const why = result.errors.length > 0 ? `\n${result.errors.join('\n')}` : '';
      failed.push(`${lang}: 문장 ${result.failedIds.length}개 전부 실패${why}`);
      return;
    }
    doc.langs[lang] = {
      meta: {
        model: config.model,
        effort: config.effort,
        chunkCount: result.chunkCount,
        failedIds: result.failedIds,
        // 일부만 실패했을 때 까닭을 일기에 남겨 둔다. 나중에 되짚을 단서가 된다.
        errors: result.errors,
      },
      sentences: result.sentences,
      notes: result.notes,
    };
  });

  return failed;
}

/** 본문과 언어 목록을 검사한다. @returns {string|null} 문제 설명 */
function checkBody(text, langs) {
  if (text === '') return '일기 본문이 비어 있다';
  const unknown = langs.filter((l) => !SUPPORTED.includes(l));
  if (unknown.length > 0) return `모르는 언어: ${unknown.join(', ')}`;
  if (!process.env.ANTHROPIC_API_KEY) return 'ANTHROPIC_API_KEY가 없다';
  return null;
}

const bodyText = (req) => (typeof req.body?.text === 'string' ? req.body.text.trim() : '');
const bodyLangs = (req) =>
  Array.isArray(req.body?.langs) && req.body.langs.length > 0 ? req.body.langs : SUPPORTED;

/**
 * 타이핑 중인 내용 임시저장. 화면의 "임시저장" 버튼이 부른다.
 * body: { lang, typing }
 */
app.put('/api/diaries/:id/typing', async (req, res) => {
  const { id } = req.params;
  if (!(await req.store.hasDiary(id))) {
    res.status(404).json({ error: `일기를 찾을 수 없다: ${id}` });
    return;
  }
  const lang = req.body?.lang;
  if (!SUPPORTED.includes(lang)) {
    res.status(400).json({ error: `모르는 언어: ${lang}` });
    return;
  }
  if (typeof req.body?.typing !== 'object' || req.body.typing === null) {
    res.status(400).json({ error: 'typing이 없다' });
    return;
  }

  try {
    const doc = await req.store.saveTyping(id, lang, req.body.typing);
    res.json({ ok: true, typingUpdatedAt: doc.typingUpdatedAt });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * 옆에 두는 작은 사전. 긁어 붙여 넣은 말의 뜻을 바로 돌려준다.
 * 일기와 상관없이 쓸 수 있어서 일기 id를 받지 않는다.
 * body: { lang, term }
 */
app.post('/api/lookup', async (req, res) => {
  const lang = req.body?.lang;
  const term = typeof req.body?.term === 'string' ? req.body.term.trim() : '';

  if (!SUPPORTED.includes(lang)) {
    res.status(400).json({ error: `모르는 언어: ${lang}` });
    return;
  }
  if (term === '') {
    res.status(400).json({ error: '찾을 말이 비어 있다' });
    return;
  }
  if (term.length > 80) {
    res.status(400).json({ error: '사전은 낱말이나 짧은 구만 찾는다 (80자까지)' });
    return;
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    res.status(500).json({ error: 'ANTHROPIC_API_KEY가 없다' });
    return;
  }

  try {
    res.json(await lookup({ lang, term }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * 하단 Q&A. 일기 원문과 해당 언어 번역을 맥락으로 넣고 한국어로 답을 받는다.
 * 지난 문답에 이어서 묻고, 문답은 일기에 함께 저장한다.
 * body: { lang, question }
 */
app.post('/api/diaries/:id/qa', async (req, res) => {
  const { id } = req.params;
  if (!(await req.store.hasDiary(id))) {
    res.status(404).json({ error: `일기를 찾을 수 없다: ${id}` });
    return;
  }

  const lang = req.body?.lang;
  const question = typeof req.body?.question === 'string' ? req.body.question.trim() : '';

  if (!SUPPORTED.includes(lang)) {
    res.status(400).json({ error: `모르는 언어: ${lang}` });
    return;
  }
  if (question === '') {
    res.status(400).json({ error: '질문이 비어 있다' });
    return;
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    res.status(500).json({ error: 'ANTHROPIC_API_KEY가 없다' });
    return;
  }

  const doc = await req.store.readDiary(id);
  if (!doc.langs?.[lang]) {
    res.status(400).json({ error: `이 일기에는 ${lang} 번역이 없다` });
    return;
  }
  const history = doc.qa?.[lang] ?? [];

  // 답을 다 기다리면 10초 넘게 빈 화면이다. 글자가 오는 대로 흘려보낸다(SSE).
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const emit = (payload) => res.write(`data: ${JSON.stringify(payload)}\n\n`);

  try {
    const { text, usage, truncated } = await ask({
      doc,
      lang,
      history,
      question,
      onDelta: (delta) => emit({ delta }),
    });

    console.log(
      `[qa ${id} ${lang}] 입력 ${usage.input_tokens}` +
        ` / 캐시 쓰기 ${usage.cache_creation_input_tokens ?? 0}` +
        ` 읽기 ${usage.cache_read_input_tokens ?? 0}` +
        ` / 출력 ${usage.output_tokens}`,
    );

    const turns = [
      ...history,
      { role: 'user', text: question, at: new Date().toISOString() },
      { role: 'assistant', text, at: new Date().toISOString() },
    ];
    await req.store.saveQa(id, lang, turns);
    emit({ done: true, turns, truncated });
  } catch (err) {
    emit({ error: err.message });
  } finally {
    res.end();
  }
});

/** 그 언어의 문답을 통째로 지운다. */
app.delete('/api/diaries/:id/qa', async (req, res) => {
  const { id } = req.params;
  if (!(await req.store.hasDiary(id))) {
    res.status(404).json({ error: `일기를 찾을 수 없다: ${id}` });
    return;
  }
  const lang = req.query?.lang;
  if (!SUPPORTED.includes(lang)) {
    res.status(400).json({ error: `모르는 언어: ${lang}` });
    return;
  }
  try {
    await req.store.saveQa(id, lang, []);
    res.json({ turns: [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * 일기를 올리면 문장을 나누고 언어별로 번역해서 저장한다.
 * body: { text, langs?: ['zh','ja','en'] }
 */
app.post('/api/diaries', async (req, res) => {
  const text = bodyText(req);
  const langs = bodyLangs(req);

  const problem = checkBody(text, langs);
  if (problem) {
    res.status(problem.startsWith('ANTHROPIC') ? 500 : 400).json({ error: problem });
    return;
  }

  const { sentences } = splitKoreanDiary(text);
  const doc = {
    id: await req.store.nextId(),
    title: titleOf(text),
    createdAt: new Date().toISOString(),
    text,
    ko: { sentences },
    langs: {},
  };

  try {
    const failed = await fillTranslations(doc, langs);
    if (Object.keys(doc.langs).length === 0) {
      res.status(502).json({ error: `번역이 모두 실패했다\n${failed.join('\n')}` });
      return;
    }
    await req.store.writeDiary(doc);
    res.status(201).json({ ...doc, warnings: failed });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * 원문을 고쳐서 다시 번역한다. id와 만든 시각은 그대로 둔다.
 * 문장이 달라지므로 타이핑한 내용은 버린다(줄 나눔이 바뀌어 되살려도 어긋난다).
 * body: { text, langs? }
 */
app.put('/api/diaries/:id', async (req, res) => {
  const { id } = req.params;
  if (!(await req.store.hasDiary(id))) {
    res.status(404).json({ error: `일기를 찾을 수 없다: ${id}` });
    return;
  }

  const text = bodyText(req);
  const langs = bodyLangs(req);

  const problem = checkBody(text, langs);
  if (problem) {
    res.status(problem.startsWith('ANTHROPIC') ? 500 : 400).json({ error: problem });
    return;
  }

  const previous = await req.store.readDiary(id);
  const { sentences } = splitKoreanDiary(text);
  // 문장과 번역이 달라지므로 타이핑과 문답은 맥락이 어긋난다. 둘 다 버린다.
  const doc = {
    id: previous.id,
    title: titleOf(text),
    createdAt: previous.createdAt,
    updatedAt: new Date().toISOString(),
    text,
    ko: { sentences },
    langs: {},
  };

  try {
    const failed = await fillTranslations(doc, langs);
    if (Object.keys(doc.langs).length === 0) {
      res.status(502).json({ error: `번역이 모두 실패했다\n${failed.join('\n')}` });
      return;
    }
    await req.store.writeDiary(doc);
    res.json({ ...doc, warnings: failed });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 빌드한 프론트가 있으면 같이 띄운다. 개발 중에는 vite가 /api만 이쪽으로 넘긴다.
const dist = path.resolve('web/dist');
app.use(express.static(dist, { fallthrough: true }));
app.get(/^(?!\/api\/).*/, (req, res, next) => {
  res.sendFile(path.join(dist, 'index.html'), (err) => {
    if (err) next();
  });
});

app.listen(PORT, () => {
  console.log(`diary-lingo 서버: http://localhost:${PORT} (모델 ${config.model})`);
});
