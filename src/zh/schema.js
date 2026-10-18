// zh 응답 JSON 스키마. output_config.format으로 강제한다.
//
// 문장부호 토큰에는 py·pron이 없다(화면에서 미리 채워지는 칸이 된다).
// 그래서 token의 required는 w 하나뿐이다.

export const zhSchema = {
  type: 'object',
  properties: {
    lang: { type: 'string', enum: ['zh'] },
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
                      py: { type: 'array', items: { type: 'string' } },
                      pron: { type: 'array', items: { type: 'string' } },
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
