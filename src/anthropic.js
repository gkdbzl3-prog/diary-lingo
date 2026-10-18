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
export async function askForJson({ system, context, request, schema }) {
  const params = {
    model: config.model,
    max_tokens: config.maxTokens,
    system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: context, cache_control: { type: 'ephemeral' } },
          { type: 'text', text: request },
        ],
      },
    ],
    output_config: {
      effort: config.effort,
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
    throw new Error(`max_tokens(${config.maxTokens})에 걸려 응답이 잘렸다. 묶음을 줄여야 한다.`);
  }

  let payload;
  try {
    payload = JSON.parse(text);
  } catch (err) {
    throw new Error(`JSON 파싱 실패: ${err.message}\n응답 앞부분: ${text.slice(0, 400)}`);
  }

  return { payload, usage: message.usage };
}

async function send(params, withFallback) {
  const anthropic = getClient();

  if (!withFallback) {
    const stream = anthropic.messages.stream(params);
    return stream.finalMessage();
  }

  // 안전 분류기 거절에 대비한 서버 측 폴백. 계정에서 베타가 막혀 있으면 끄고 재시도한다.
  try {
    const stream = anthropic.beta.messages.stream({
      ...params,
      betas: [FALLBACK_BETA],
      fallbacks: 'default',
    });
    return await stream.finalMessage();
  } catch (err) {
    if (err?.status === 400) {
      if (config.serverFallback) {
        console.warn(`  ! 서버 폴백 베타를 쓸 수 없어 끄고 다시 보낸다 (${err.message})`);
        config.serverFallback = false;
      }
      const stream = anthropic.messages.stream(params);
      return stream.finalMessage();
    }
    throw err;
  }
}
