// 써 보면서 조정하는 상수들. 화면·프롬프트·검증이 모두 여기를 본다.

export const config = {
  // 모델은 환경변수로 덮어쓸 수 있다.
  model: process.env.DIARY_LINGO_MODEL ?? 'claude-opus-5-5',

  // 생각 깊이. low | medium | high | xhigh | max
  effort: process.env.DIARY_LINGO_EFFORT ?? 'high',

  // 토큰이 길어질 수 있어 스트리밍으로 받는다.
  maxTokens: 32000,

  // 안전 분류기가 요청을 거절했을 때 서버가 알아서 다른 모델로 넘겨 준다.
  // 베타 기능이라 계정에서 막히면 자동으로 끄고 한 번 더 시도한다.
  serverFallback: true,

  // 프롬프트에 그대로 들어가는 문자열. 나중에 유저별로 바꿀 수 있게 둔다.
  learnerLevel:
    '중국어 HSK 4~5급, 일본어 JLPT N2~N1 학습자. ' +
    '원문의 감성을 살린 자연스러운 표현으로 번역. 아웃풋 연습이 목적.',

  // 언어마다 덧붙이는 난이도. 공통 문자열 뒤에 한 줄로 붙는다.
  // 중국어·일본어는 비워 둬서 지금까지 나오던 결과가 그대로 유지된다.
  learnerLevelByLang: {
    zh: '',
    ja: '',
    en:
      '영어는 상급자용으로 씁니다. 교과서체를 피하고 원어민이 실제로 쓰는 표현·숙어·' +
      '분사구문·도치를 꺼리지 말고, 단어도 한 단계 높여 고르세요. ' +
      '쉽게 풀어 쓰지 말고 원문의 결을 살린 문장으로 쓰세요.',
  },

  // 줄(line) 길이. 끊어 읽기 단위를 얼마나 길게 둘지.
  lines: {
    zh: {
      // 문장부호 포함 글자 수
      targetMin: 8,
      targetMax: 12,
      hardMax: 14,
    },
    ja: {
      // 요미가나 기준, 공백·문장부호 제외
      hardMax: 24,
    },
    en: {
      // 영어는 한 줄이 길어도 읽힌다. 50자는 너무 자주 끊겼다.
      hardMax: 70,
    },
  },

  // 한 호출에 보낼 문장 수 상한. 전체를 이 수 이하로 고르게 쪼갠다
  // (문장 11개면 6+5처럼 나뉜다. 마지막 묶음만 유난히 작아지는 걸 막는다).
  chunkMax: 10,

  // 언어 하나 안에서 동시에 보낼 묶음 수. 첫 묶음부터 병렬로 시작한다.
  chunkConcurrency: 3,

  // 검증에 실패한 문장만 다시 물어보는 횟수
  maxRetries: 2,

  // Q&A. 답은 한 문단쯤이라 번역보다 짧고 얕게 가도 된다.
  // effort low와 medium을 재 봤더니 걸리는 시간도 답 품질도 비슷했고,
  // 긴 질문에서는 low가 먼저 입을 뗀다. 깊게 가고 싶으면 medium으로 올린다.
  qaMaxTokens: 8000,
  qaEffort: process.env.DIARY_LINGO_QA_EFFORT ?? 'low',

  // 사전. 낱말 하나를 찾는 일이라 "바로" 떠야 한다.
  // 그래서 번역·Q&A와 달리 작고 빠른 모델을 쓴다. 바꾸려면 환경변수로.
  lookupModel: process.env.DIARY_LINGO_LOOKUP_MODEL ?? 'claude-haiku-5-5',
  lookupEffort: process.env.DIARY_LINGO_LOOKUP_EFFORT ?? 'low',
  lookupMaxTokens: 2000,
};
