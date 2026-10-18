import path from 'node:path';
import express from 'express';
import { splitKoreanDiary } from './sentences.js';
import { translate } from './translate.js';
import { SUPPORTED } from './langs.js';
import { config } from './config.js';
import {
  hasDiary,
  listDiaries,
  nextId,
  readDiary,
  removeDiary,
  saveTyping,
  titleOf,
  writeDiary,
} from './store.js';

const PORT = Number(process.env.PORT ?? 3000);
const app = express();

app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (req, res) => {
  res.json({ ok: true, model: config.model, langs: SUPPORTED, hasKey: Boolean(process.env.ANTHROPIC_API_KEY) });
});

app.get('/api/diaries', (req, res) => {
  res.json({ diaries: listDiaries() });
});

app.get('/api/diaries/:id', (req, res) => {
  const { id } = req.params;
  if (!hasDiary(id)) {
    res.status(404).json({ error: `일기를 찾을 수 없다: ${id}` });
    return;
  }
  res.json(readDiary(id));
});

app.delete('/api/diaries/:id', (req, res) => {
  const { id } = req.params;
  if (!hasDiary(id)) {
    res.status(404).json({ error: `일기를 찾을 수 없다: ${id}` });
    return;
  }
  try {
    removeDiary(id);
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
    doc.langs[lang] = {
      meta: {
        model: config.model,
        effort: config.effort,
        chunkCount: result.chunkCount,
        failedIds: result.failedIds,
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
app.put('/api/diaries/:id/typing', (req, res) => {
  const { id } = req.params;
  if (!hasDiary(id)) {
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
    const doc = saveTyping(id, lang, req.body.typing);
    res.json({ ok: true, typingUpdatedAt: doc.typingUpdatedAt });
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
    id: nextId(),
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
    writeDiary(doc);
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
  if (!hasDiary(id)) {
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

  const previous = readDiary(id);
  const { sentences } = splitKoreanDiary(text);
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
    writeDiary(doc);
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
