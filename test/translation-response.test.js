import test from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate as tick } from 'node:timers/promises';
import { respondWithTranslations } from '../src/translation-response.js';

const result = { sentences: [{ id: 1, text: 'A walk.' }], notes: { vocab: [], highlights: [] }, failedIds: [], errors: [], chunkCount: 1 };
const document = () => ({ id: 'diary-test', text: '산책했다.', ko: { sentences: [{ id: 1, p: 1, ko: '산책했다.' }] }, langs: {} });
function harness(stream = true, saveError = false) {
  const writes = [], events = [];
  const req = {
    get: () => stream ? 'text/event-stream' : 'application/json',
    store: { writeDiary: async (doc) => {
      if (saveError) throw new Error('save failed');
      writes.push(structuredClone(doc));
    } },
  };
  const res = {
    headers: {}, code: 200, destroyed: false, writableEnded: false,
    setHeader(k,v) { this.headers[k] = v; }, flushHeaders() {},
    write(s) { if(s.startsWith('data: ')) events.push(JSON.parse(s.slice(6))); },
    end() { this.writableEnded = true; }, status(n) { this.code=n; return this; },
    json(body) { this.body=body; this.end(); },
  };
  return { req, res, writes, events };
}

test('a finished language arrives before slow languages and before final persistence', async () => {
  const h = harness();
  let finishSlow;
  const slow = new Promise((resolve) => { finishSlow = resolve; });
  const work = respondWithTranslations(h.req, h.res, document(), ['zh','en'], {
    translateLanguage: async ({lang}) => lang === 'zh' ? slow : result,
  });
  await tick();
  assert.equal(h.events.length, 1);
  assert.equal(h.events[0].type, 'language');
  assert.equal(h.events[0].lang, 'en');
  assert.deepEqual(Object.keys(h.events[0].doc.langs), ['en']);
  assert.equal(h.writes.length, 0);
  finishSlow(result);
  await work;
  assert.deepEqual(h.events.map(e=>e.type), ['language','language','done']);
  assert.equal(h.writes.length, 1);
  assert.deepEqual(Object.keys(h.writes[0].langs).sort(), ['en','zh']);
});

test('an empty language is reported while another succeeds and is saved', async () => {
  const h = harness();
  await respondWithTranslations(h.req,h.res,document(),['zh','en'], {
    translateLanguage: async ({lang}) => lang === 'en' ? result : { ...result, sentences: [], failedIds: [1], errors: ['401'] },
  });
  assert.deepEqual(Object.keys(h.writes[0].langs), ['en']);
  assert.equal(h.events.at(-1).type, 'done');
  assert.match(h.events.at(-1).doc.warnings[0], /401/);
});

test('all-failed translations never overwrite an existing diary', async () => {
  const h = harness();
  await respondWithTranslations(h.req,h.res,document(),['en'], {
    translateLanguage: async () => { throw new Error('upstream unavailable'); },
  });
  assert.equal(h.writes.length,0);
  assert.equal(h.events.at(-1).type,'error');
  assert.match(h.events.at(-1).error,/upstream unavailable/);
  assert.equal(h.res.writableEnded,true);
});

test('a preview is never marked saved when persistence fails', async () => {
  const h = harness(true,true);
  await respondWithTranslations(h.req,h.res,document(),['en'], { translateLanguage: async () => result });
  assert.deepEqual(h.events.map(e=>e.type), ['language','error']);
  assert.match(h.events.at(-1).error,/save failed/);
});

test('non-streaming clients retain JSON response and 201/502 status codes', async () => {
  const h = harness(false);
  await respondWithTranslations(h.req,h.res,document(),['en'], { status:201, translateLanguage: async () => result });
  assert.equal(h.res.code,201);
  assert.equal(h.res.body.langs.en.sentences.length,1);
  const failed = harness(false);
  await respondWithTranslations(failed.req,failed.res,document(),['en'], {
    translateLanguage: async () => ({...result,sentences:[],failedIds:[1]}),
  });
  assert.equal(failed.res.code,502);
  assert.equal(failed.writes.length,0);
});

test('disconnecting the preview stream still saves the completed translation', async () => {
  const h = harness();
  h.res.destroyed=true;
  await respondWithTranslations(h.req,h.res,document(),['en'], { translateLanguage: async () => result });
  assert.equal(h.writes.length,1);
  assert.equal(h.events.length,0);
});
