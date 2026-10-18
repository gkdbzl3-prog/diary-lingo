// en 응답 JSON 스키마. output_config.format으로 강제한다.
//
// 영어는 토큰이 없다. 줄 단위로 text·pron·gloss만 받는다.

export const enSchema = {
  type: 'object',
  properties: {
    lang: { type: 'string', enum: ['en'] },
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
                text: { type: 'string' },
                pron: { type: 'string' },
                gloss: { type: 'string' },
              },
              required: ['text', 'pron', 'gloss'],
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
