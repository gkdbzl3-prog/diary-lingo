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
 * body: { text, langs?: ['zh'] }
 */
app.post('/api/diaries', async (req, res) => {
  const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
  if (text === '') {
    res.status(400).json({ error: '일기 본문이 비어 있다' });
    return;
  }

  const langs = Array.isArray(req.body?.langs) && req.body.langs.length > 0 ? req.body.langs : ['zh'];
  const unknown = langs.filter((l) => !SUPPORTED.includes(l));
  if (unknown.length > 0) {
    res.status(400).json({ error: `모르는 언어: ${unknown.join(', ')}` });
    return;
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    res.status(500).json({ error: 'ANTHROPIC_API_KEY가 없다' });
    return;
  }

  const { sentences } = splitKoreanDiary(text);
  const id = nextId();
  const doc = {
    id,
    title: titleOf(text),
    createdAt: new Date().toISOString(),
    text,
    ko: { sentences },
    langs: {},
  };

  try {
    const settled = await Promise.allSettled(
      langs.map(async (lang) => [lang, await translate({ lang, sentences })]),
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
