// ja 응답 JSON 스키마. output_config.format으로 강제한다.
//
// 토큰은 문절 단위이고 kana·pron은 문절을 통째로 적은 문자열이다(zh처럼 배열이 아니다).
// 문장부호는 앞 문절에 붙이는 게 규칙이지만, 모델이 문장부호만 있는 토큰을 보내도
// 스키마에서 막지 않고 검증에서 봐준다. 그래서 required는 w 하나뿐이다.

export const jaSchema = {
  type: 'object',
  properties: {
    lang: { type: 'string', enum: ['ja'] },
    sentences: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          text: { type: 'string' },
          lines: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                tokens: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      w: { type: 'string' },
                      kana: { type: 'string' },
                      pron: { type: 'string' },
                    },
                    required: ['w'],
                    additionalProperties: false,
                  },
                },
                gloss: { type: 'string' },
              },
              required: ['tokens', 'gloss'],
              additionalProperties: false,
            },
          },
        },
        required: ['id', 'text', 'lines'],
        additionalProperties: false,
      },
    },
    notes: {
      type: 'object',
      properties: {
        vocab: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              expr: { type: 'string' },
              reading: { type: 'string' },
              meaning: { type: 'string' },
              sid: { type: 'integer' },
            },
            required: ['expr', 'reading', 'meaning', 'sid'],
            additionalProperties: false,
          },
        },
        highlights: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              body: { type: 'string' },
              sid: { type: 'integer' },
            },
            required: ['title', 'body', 'sid'],
            additionalProperties: false,
          },
        },
      },
      required: ['vocab', 'highlights'],
      additionalProperties: false,
    },
  },
  required: ['lang', 'sentences', 'notes'],
  additionalProperties: false,
};
