import test from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate as tick } from 'node:timers/promises';
import { createDiary, retranslateDiary } from '../web/src/api.js';

const encoder = new TextEncoder();
const wire = (message) => encoder.encode(`data: ${JSON.stringify(message)}\n\n`);

test('createDiary delivers fragmented UTF-8 previews before the saved result', async (t) => {
  let controller;
  const body = new ReadableStream({start(c){controller=c;}});
  t.mock.method(globalThis,'fetch', async () => new Response(body,{headers:{'content-type':'text/event-stream'}}));
  const previews=[];
  let finished=false;
  const work = createDiary('산책했다.',['en'],event=>previews.push(event)).then(d=>{finished=true;return d;});
  const preview={type:'language',lang:'en',doc:{id:'diary-1',title:'산책',langs:{en:{sentences:[{id:1}]}}}};
  const bytes=wire(preview);
  for (const byte of bytes) controller.enqueue(Uint8Array.of(byte));
  await tick();
  assert.equal(finished,false);
  assert.deepEqual(previews,[preview]);
  const doc={...preview.doc,warnings:[]};
  controller.enqueue(wire({type:'done',doc}));
  controller.close();
  assert.deepEqual(await work,doc);
});

test('retranslation reports an interrupted stream instead of accepting a preview as saved', async (t) => {
  t.mock.method(globalThis,'fetch', async () => new Response(new ReadableStream({start(c){
    c.enqueue(wire({type:'language',lang:'en',doc:{id:'diary-1'}})); c.close();
  }}),{headers:{'content-type':'text/event-stream'}}));
  await assert.rejects(retranslateDiary('diary-1','산책',['en'],()=>{}),/끊겼/);
});

test('server-side save failure after preview rejects the request', async (t) => {
  t.mock.method(globalThis,'fetch', async () => new Response(new ReadableStream({start(c){
    c.enqueue(wire({type:'language',lang:'en',doc:{id:'diary-1'}}));
    c.enqueue(wire({type:'error',error:'저장 실패'}));c.close();
  }}),{headers:{'content-type':'text/event-stream'}}));
  await assert.rejects(createDiary('산책',['en'],()=>{}),/저장 실패/);
});

test('JSON validation errors and older JSON servers remain compatible', async (t) => {
  const mock = t.mock.method(globalThis,'fetch',async()=>Response.json({error:'본문 없음'},{status:400}));
  await assert.rejects(createDiary('',['en'],()=>{}),/본문 없음/);
  mock.mock.mockImplementation(async()=>Response.json({id:'diary-1',langs:{en:{}}},{status:201}));
  assert.equal((await createDiary('산책',['en'],()=>{})).id,'diary-1');
});
