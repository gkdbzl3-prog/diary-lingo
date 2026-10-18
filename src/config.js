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
      hardMax: 50,
    },
  },

  // 검증에 실패한 문장만 다시 물어보는 횟수
  maxRetries: 2,
};
