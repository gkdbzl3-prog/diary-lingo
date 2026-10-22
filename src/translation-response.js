import { translate } from './translate.js';
import { config } from './config.js';

/** Send completed languages as previews; only the final done event confirms persistence. */
export async function respondWithTranslations(req, res, doc, langs, {
  status = 200, translateLanguage = translate,
} = {}) {
  const streaming = req.get('accept')?.includes('text/event-stream');
  const send = (message) => {
    if (streaming && !res.destroyed && !res.writableEnded) {
      res.write(`data: ${JSON.stringify(message)}\n\n`);
    }
  };
  let heartbeat;
  if (streaming) {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();
    heartbeat = setInterval(() => {
      if (!res.destroyed && !res.writableEnded) res.write(': translating\n\n');
    }, 15000);
    heartbeat.unref?.();
  }
  const fail = (code, error) => {
    if (streaming) send({ type: 'error', error });
    else res.status(code).json({ error });
  };
  try {
    const settled = await Promise.allSettled(langs.map(async (lang) => {
      try {
        const result = await translateLanguage({ lang, sentences: doc.ko.sentences });
        if (result.sentences.length === 0) {
          throw new Error(`문장 ${result.failedIds.length}개 전부 실패${result.errors?.length ? `\n${result.errors.join('\n')}` : ''}`);
        }
        doc.langs[lang] = {
          meta: {
            model: config.model, effort: config.effort, chunkCount: result.chunkCount,
            failedIds: result.failedIds, errors: result.errors,
          },
          sentences: result.sentences, notes: result.notes,
        };
        send({ type: 'language', lang, doc });
      } catch (err) {
        const message = `${lang}: ${err.message ?? err}`;
        send({ type: 'warning', lang, message });
        throw new Error(message);
      }
    }));
    const warnings = settled.filter((r) => r.status === 'rejected').map((r) => r.reason.message);
    if (Object.keys(doc.langs).length === 0) {
      fail(502, `번역이 모두 실패했다\n${warnings.join('\n')}`);
      return;
    }
    // Keep the previous diary intact until translation finishes. A disconnected browser
    // does not cancel persistence; the saved result can be reopened from the diary list.
    await req.store.writeDiary(doc);
    const result = { ...doc, warnings };
    if (streaming) send({ type: 'done', doc: result });
    else res.status(status).json(result);
  } catch (err) {
    fail(500, err.message ?? String(err));
  } finally {
    clearInterval(heartbeat);
    if (streaming && !res.destroyed && !res.writableEnded) res.end();
  }
}
