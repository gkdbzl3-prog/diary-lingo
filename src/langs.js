// 언어 모듈 등록소. 언어를 더하려면 폴더 하나와 여기 한 줄만 추가한다.

import { zhSchema } from './zh/schema.js';
import { buildSystemPrompt as zhSystem } from './zh/prompt.js';
import { checkSentence as zhCheck } from './zh/validate.js';

import { jaSchema } from './ja/schema.js';
import { buildSystemPrompt as jaSystem } from './ja/prompt.js';
import { checkSentence as jaCheck } from './ja/validate.js';

import { enSchema } from './en/schema.js';
import { buildSystemPrompt as enSystem } from './en/prompt.js';
import { checkSentence as enCheck } from './en/validate.js';

export const LANGS = {
  zh: { lang: 'zh', label: '중국어', schema: zhSchema, buildSystemPrompt: zhSystem, checkSentence: zhCheck },
  ja: { lang: 'ja', label: '일본어', schema: jaSchema, buildSystemPrompt: jaSystem, checkSentence: jaCheck },
  en: { lang: 'en', label: '영어', schema: enSchema, buildSystemPrompt: enSystem, checkSentence: enCheck },
};

export const SUPPORTED = Object.keys(LANGS);
