import test from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate as tick } from 'node:timers/promises';
import { config } from '../src/config.js';
import { getClient } from '../src/anthropic.js';
import { translate } from '../src/translate.js';

const deferred = () => {
  let resolve;
  const promise = new Promise((r) => { resolve = r; });
  return { promise, resolve };
};

test('starts both chunks before either finishes, then merges out-of-order results by id', async (t) => {
  // Keep the actual scheduler, prompts, JSON parser and sentence validation; replace only the API.
  process.env.ANTHROPIC_API_KEY = 'test-placeholder';
  const previousFallback = config.serverFallback;
  config.serverFallback = false;
  t.after(() => { config.serverFallback = previousFallback; });
  const pending = [];
  t.mock.method(getClient().messages, 'stream', (params) => {
    const request = params.messages[0].content.at(-1).text;
    const ids = [...request.matchAll(/^#(\d+):/gm)].map((m) => Number(m[1]));
    const gate = deferred();
    pending.push({ ids, gate });
    return { finalMessage: () => gate.promise };
  });
  const work = translate({
    lang: 'en', log: () => {},
    sentences: Array.from({ length: 11 }, (_, i) => ({ id: i + 1, p: 1, ko: '산책했다.' })),
  });
  const finish = ({ ids, gate }) => gate.resolve({
    content: [{ type: 'text', text: JSON.stringify({
      lang: 'en', sentences: ids.map((id) => ({
        id, text: 'I walked.', lines: [{ text: 'I walked.', pron: '아이 워크트', gloss: '산책했다.' }],
      })), notes: { vocab: [], highlights: [] },
    }) }], stop_reason: 'end_turn', usage: { input_tokens: 10, output_tokens: 20 },
  });
  await tick();
  const startedTogether = pending.length;
  // Drain even the old serial implementation so the failure is an assertion, not a hanging promise.
  if (pending[1]) finish(pending[1]);
  finish(pending[0]);
  await tick();
  if (pending[1]) finish(pending[1]);
  const result = await work;
  assert.equal(startedTogether, 2, 'the second chunk must not wait for the first');
  assert.deepEqual(result.sentences.map((s) => s.id), [1,2,3,4,5,6,7,8,9,10,11]);
  assert.deepEqual(result.failedIds, []);
});

test('long diaries keep the concurrency bound and preserve other chunks when one fails', async (t) => {
  process.env.ANTHROPIC_API_KEY = 'test-placeholder';
  const previousFallback = config.serverFallback;
  config.serverFallback = false;
  t.after(() => { config.serverFallback = previousFallback; });
  const pending = [];
  let active = 0, peak = 0;
  t.mock.method(getClient().messages, 'stream', (params) => {
    const ids = [...params.messages[0].content.at(-1).text.matchAll(/^#(\d+):/gm)].map((m) => Number(m[1]));
    const gate = deferred();
    active++; peak = Math.max(peak,active);
    pending.push({ids,gate});
    return {finalMessage:async()=>{
      await gate.promise; active--;
      if (ids.includes(1)) throw new Error('upstream failed');
      return {content:[{type:'text',text:JSON.stringify({sentences:ids.map(id=>({id,text:'I walked.',lines:[{text:'I walked.',pron:'발음',gloss:'산책'}]})),notes:{vocab:[],highlights:[]}})}],stop_reason:'end_turn',usage:{input_tokens:10,output_tokens:20}};
    }};
  });
  const work = translate({lang:'en',log:()=>{},sentences:Array.from({length:31},(_,i)=>({id:i+1,p:1,ko:'산책했다.'}))});
  await tick();
  assert.equal(pending.length,3);
  pending[0].gate.resolve();
  await tick();
  assert.equal(pending.length,4);
  for(const p of pending)p.gate.resolve();
  const translated=await work;
  assert.equal(peak,3);
  assert.deepEqual(translated.failedIds,[1,2,3,4,5,6,7,8]);
  assert.deepEqual(translated.sentences.map(s=>s.id),[9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31]);
});
