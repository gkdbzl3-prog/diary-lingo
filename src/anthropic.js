import Anthropic from '@anthropic-ai/sdk';
import { config } from './config.js';

const FALLBACK_BETA = 'server-side-fallback-2026-07-01';

let client;
export function getClient() {
  if (!client) client = new Anthropic();
  return client;
}

/**
 * JSON 스키마를 강제해서 한 번 호출한다.
 * 출력이 길 수 있으므로 스트리밍으로 받는다.
 *
 * prompt caching: system(언어별 규칙)과 context(일기 전체)에 캐시 구간을 끊는다.
 * 묶음마다 달라지는 request는 그 뒤에 와야 한다. 캐시는 앞에서부터 글자 하나까지
 * 같아야 먹으므로, 요청 범위 같은 건 context에 섞지 않는다.
 * 기본 TTL은 5분이고, 캐시를 읽을 때마다 시계가 다시 돌아가므로 묶음이 이어지는
 * 동안에는 계속 살아 있다.
 *
 * @param {object} args
 * @param {string} args.system 언어별 규칙
 * @param {string} args.context 일기 전체 (묶음과 무관하게 똑같아야 한다)
 * @param {string} args.request 이번 묶음 요청
 * @param {object} args.schema 응답 JSON 스키마
 */
export async function askForJson({ system, context, request, schema, model, effort, maxTokens }) {
  // context는 선택이다. 사전처럼 맥락 없이 낱말만 묻는 경우도 있다.
  const content = [];
  if (context) content.push({ type: 'text', text: context, cache_control: { type: 'ephemeral' } });
  content.push({ type: 'text', text: request });

  const params = {
    model: model ?? config.model,
    max_tokens: maxTokens ?? config.maxTokens,
    system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content }],
    output_config: {
      effort: effort ?? config.effort,
      format: { type: 'json_schema', schema },
    },
  };

  const message = await send(params, config.serverFallback);

  const text = message.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('');

  if (message.stop_reason === 'refusal') {
    throw new Error(`모델이 요청을 거절했다: ${JSON.stringify(message.stop_details)}`);
  }
  if (message.stop_reason === 'max_tokens') {
    throw new Error(`max_tokens(${params.max_tokens})에 걸려 응답이 잘렸다. 묶음을 줄여야 한다.`);
  }

  let payload;
  try {
    payload = JSON.parse(text);
  } catch (err) {
    throw new Error(`JSON 파싱 실패: ${err.message}\n응답 앞부분: ${text.slice(0, 400)}`);
  }

  return { payload, usage: message.usage };
}

/**
 * @param {object} params
 * @param {boolean} withFallback
 * @param {(text: string) => void} [onDelta] 글자가 오는 대로 넘겨준다(Q&A 스트리밍용)
 */
async function send(params, withFallback, onDelta) {
  const anthropic = getClient();

  const run = (client, extra) => {
    const stream = client.messages.stream({ ...params, ...extra });
    if (onDelta) stream.on('text', onDelta);
    return stream.finalMessage();
  };

  if (!withFallback) return run(anthropic);

  // 안전 분류기 거절에 대비한 서버 측 폴백. 계정에서 베타가 막혀 있으면 끄고 재시도한다.
  try {
    return await run(anthropic.beta, { betas: [FALLBACK_BETA], fallbacks: 'default' });
  } catch (err) {
    if (err?.status === 400) {
      if (config.serverFallback) {
        console.warn(`  ! 서버 폴백 베타를 쓸 수 없어 끄고 다시 보낸다 (${err.message})`);
        config.serverFallback = false;
      }
      return run(anthropic);
    }
    throw err;
  }
}

/**
 * 맥락을 캐시에 올려 두고 글로 답을 받는다. Q&A용.
 *
 * 맥락(일기 원문 + 번역 + notes)은 질문이 몇 개가 되든 똑같으므로 첫 user 메시지
 * 맨 앞에 두고 캐시 구간을 끊는다. 질문은 그 뒤에 온다.
 * 대화가 길어지면 앞선 문답도 그대로 프리픽스가 되므로 꼬리에도 캐시를 건다.
 *
 * @param {object} args
 * @param {string} args.system
 * @param {string} args.context 질문이 바뀌어도 글자 하나까지 같아야 한다
 * @param {{role: 'user'|'assistant', text: string}[]} args.turns 첫 항목은 user
 * @param {(text: string) => void} [args.onDelta] 글자가 오는 대로 넘겨준다
 */
export async function askText({ system, context, turns, onDelta }) {
  const messages = turns.map((turn, i) => {
    if (turn.role !== 'user') return { role: 'assistant', content: turn.text };
    if (i > 0) return { role: 'user', content: turn.text };
    return {
      role: 'user',
      content: [
        { type: 'text', text: context, cache_control: { type: 'ephemeral' } },
        { type: 'text', text: turn.text },
      ],
    };
  });

  const params = {
    model: config.model,
    max_tokens: config.qaMaxTokens,
    system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
    messages,
    // 마지막 블록에 자동으로 캐시를 걸어 다음 질문 때 지난 문답을 다시 읽는다.
    cache_control: { type: 'ephemeral' },
    output_config: { effort: config.qaEffort },
  };

  const message = await send(params, config.serverFallback, onDelta);

  if (message.stop_reason === 'refusal') {
    throw new Error(`모델이 요청을 거절했다: ${JSON.stringify(message.stop_details)}`);
  }

  const text = message.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('')
    .trim();

  if (text === '') throw new Error('답이 비어 있다');

  return { text, usage: message.usage, truncated: message.stop_reason === 'max_tokens' };
}
