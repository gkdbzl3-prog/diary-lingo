import { config } from './config.js';
import { askForJson } from './anthropic.js';
import { LANGS } from './langs.js';

// 옆에 두는 작은 사전. 긁어 붙여 넣으면 바로 뜻이 뜬다.
//
// 낱말 하나를 찾는 일이라 "바로" 떠야 하므로 번역·Q&A보다 작고 빠른 모델을 쓴다
// (config.lookupModel). 맥락(일기)은 넣지 않는다 — 사전이지 해설이 아니고,
// 맥락을 넣으면 그만큼 느려진다.

const READING = {
  zh: '성조 부호 병음',
  ja: '히라가나 요미가나',
  en: '한글 발음',
};

// 한글 발음 규칙은 타이핑 화면과 결을 맞춰야 한다. 안 넣으면 手帳이 "테쵸"로 온다.
const PRON_RULES = {
  zh:
    '1·4성의 무기음(b d g z zh j)은 된소리로 적는 경향을 따릅니다(最近 쮀이진, 对 뛔이).\n' +
    '  2·3성은 예사소리로 둡니다(博 보, 好 하오). 완벽히 일관될 필요는 없습니다.',
  ja:
    '**장음은 반드시 `-`를 넣습니다.** 요미가나에서 ー, おう·おお, ゅう, ょう, えい처럼\n' +
    '  모음이 길어지는 자리가 모두 장음입니다. 빠뜨리기 쉬우니 한 번 더 확인하세요.\n' +
    '    手帳 てちょう → 테쵸-   (테쵸 ✗)\n' +
    '    日記帳 にっきちょう → 닛키쵸-   (닛키쵸 ✗)\n' +
    '    東京 とうきょう → 토-쿄-   (토쿄 ✗)\n' +
    '    先生 せんせい → 센세-   (센세이 ✗)\n' +
    '  촉음은 받침으로 옮기고(乗って 놋테), ん도 받침으로 적습니다(最近 사이킨).\n' +
    '  **한국에서 굳어진 표기를 쓰지 마세요.** 아는 말일수록 그쪽으로 끌려갑니다.\n' +
    '    東京은 \'도쿄\'가 아니라 토-쿄-, 大阪은 \'오사카\'가 아니라 오-사카,\n' +
    '    手帳은 \'테초\'가 아니라 테쵸-입니다. 요미가나를 한 글자씩 짚어 가며 적으세요.',
  en: '미국식으로, 연음과 플랩을 반영합니다(getting 게딩, but I 버라이).',
};

// 스키마 안에도 발음 규칙을 적는다. 프롬프트의 규칙만으로는 아는 낱말(東京, 手帳)에서
// 굳어진 한국어 표기로 끌려가는데, 필드 설명에 적어 두면 그 자리에서 한 번 더 걸린다.
// pron을 쓰기 전에 읽기를 쪼개 적게 한다. 화면에는 쓰지 않는 작업 칸이다.
const PRON_SPLIT = {
  zh: '병음을 음절마다 `/`로 끊고 성조 번호를 적는다. 예: zui4/jin4',
  ja:
    '요미가나를 모라마다 `/`로 끊고, 장음이 되는 자리에 `(장음)`을 적는다. ' +
    '예: て/ちょ/う(장음) → 뒤의 う가 ちょ를 늘인다. 예: と/う(장음)/きょ/う(장음)',
  en: '강세 음절을 대문자로, 음절마다 `/`로 끊는다. 예: BAT/terd',
};

const PRON_FIELD = {
  zh: '한글 발음. 1·4성 무기음은 된소리(最近 쮀이진), 2·3성은 예사소리(博 보).',
  ja:
    '한글 발음. 장음은 반드시 `-`를 넣는다: ょう·ゅう·おう·えい·ー가 모두 장음이다. ' +
    '手帳 테쵸-, 東京 토-쿄-, 学校 갓코-, 先生 센세-. ' +
    '한국에서 굳어진 표기(도쿄, 오사카, 테초)를 쓰면 안 된다 — 요미가나를 한 글자씩 짚어 적는다.',
  en: '한글 발음. 미국식, 연음과 플랩 반영(getting 게딩).',
};

export const makeLookupSchema = (lang) => ({
  type: 'object',
  properties: {
    term: { type: 'string', description: '사전형(기본형)으로 고친 표제어' },
    reading: { type: 'string' },
    // pron 앞에 두는 작업 칸. 아는 낱말일수록 굳어진 한국어 표기(도쿄, 테초)로
    // 끌려가는데, 읽기를 한 번 쪼개 놓고 쓰면 규칙대로 간다.
    readingSplit: { type: 'string', description: PRON_SPLIT[lang] },
    pron: { type: 'string', description: PRON_FIELD[lang] },
    pos: { type: 'string' },
    meanings: { type: 'array', items: { type: 'string' } },
    note: { type: 'string' },
    examples: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          text: { type: 'string' },
          ko: { type: 'string' },
        },
        required: ['text', 'ko'],
        additionalProperties: false,
      },
    },
  },
  required: ['term', 'reading', 'readingSplit', 'pron', 'pos', 'meanings', 'note', 'examples'],
  additionalProperties: false,
});

export function buildSystemPrompt(lang) {
  const label = LANGS[lang].label;

  return `당신은 ${label} 사전입니다. 낱말이나 짧은 구를 받으면 뜻을 정리해 돌려줍니다.

## 학습자
${config.learnerLevel}

## 규칙
- 짧게 씁니다. 사전 항목이지 해설이 아닙니다.
- term: 받은 말을 사전형(기본형)으로 고쳐 적습니다. 활용형이 오면 기본형으로 바꿉니다.
- reading: ${READING[lang]}. 영어는 한글 발음을 그대로 적습니다.
- pron: 한글 발음. 외래어 표기법이 아니라 **실제로 들리는 소리**에 가깝게 적습니다.
  ${PRON_RULES[lang]}
- pos: 품사를 한국어로 짧게 (명사, 동사, 형용사, 부사, 성어, 관용구 …).
- meanings: 뜻 1~3개. 각 15자 안팎으로 짧게. 가장 흔한 뜻을 먼저.
- note: 뉘앙스나 주의할 점 한 줄. 없으면 빈 문자열.
- examples: 짧은 예문 1~2개. text는 ${label}, ko는 한국어 뜻.
- 받은 말이 ${label}이 아니거나 뜻을 모르면 meanings를 빈 배열로 두고
  note에 왜 그런지 한 줄 적습니다. 지어내지 마세요.`;
}

/**
 * @param {object} args
 * @param {'zh'|'ja'|'en'} args.lang
 * @param {string} args.term 긁어 붙여 넣은 말
 */
export async function lookup({ lang, term }) {
  if (!LANGS[lang]) throw new Error(`모르는 언어: ${lang}`);

  const { payload } = await askForJson({
    system: buildSystemPrompt(lang),
    request: `다음 말을 찾아 주세요: ${term}`,
    schema: makeLookupSchema(lang),
    model: config.lookupModel,
    effort: config.lookupEffort,
    maxTokens: config.lookupMaxTokens,
  });

  return payload;
}
