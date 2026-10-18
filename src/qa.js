import { config } from './config.js';
import { askText } from './anthropic.js';
import { LANGS } from './langs.js';

// 하단 Q&A. 일기 원문과 해당 언어 번역 결과를 맥락으로 넣고 답은 한국어로 받는다.
//
// 맥락은 질문이 몇 개가 되든 똑같으므로 prompt caching으로 재사용한다.
// 그래서 맥락에 질문이나 시각 같은 걸 섞으면 안 된다.

export function buildSystemPrompt(lang) {
  const label = LANGS[lang].label;

  return `당신은 한국어 일기로 만든 ${label} 학습 자료를 두고, 학습자의 질문에 답하는 선생님입니다.

## 학습자
${config.learnerLevel}

## 답하는 방식
- **한국어로 답합니다.**
- 짧고 분명하게 씁니다. "좋은 질문입니다" 같은 인사말이나 군더더기는 쓰지 마세요.
- 예문은 ${label}로 쓰고 바로 뒤에 한국어 뜻을 붙입니다.
- 아래 자료의 문장을 가리킬 때는 #번호로 씁니다.
- 자료에 없는 것을 물어도 아는 대로 답합니다. 다만 자료와 어긋나는 점이 있으면 짚어 줍니다.
- **${label}에 대해서만 답합니다.** 묻지 않은 다른 언어(중국어·일본어·영어)를 끌어와
  비교하거나 예로 들지 마세요. 한국어 원문을 가리키는 건 괜찮습니다.
- 확실하지 않으면 확실하지 않다고 씁니다. 지어내지 마세요.
- 마크다운은 목록과 굵게 정도만 씁니다. 표는 쓰지 마세요.`;
}

/** 질문이 바뀌어도 글자 하나까지 같아야 캐시가 먹는다. 질문은 여기 넣지 않는다. */
export function buildContext({ doc, lang }) {
  const translated = doc.langs?.[lang];
  const parts = [];

  parts.push(
    `## 일기 원문 (한국어)\n${(doc.ko?.sentences ?? [])
      .map((s) => `[p${s.p} #${s.id}] ${s.ko}`)
      .join('\n')}`,
  );

  parts.push(
    `## ${LANGS[lang].label} 번역\n${(translated?.sentences ?? [])
      .map((s) => `#${s.id} ${s.text}`)
      .join('\n')}`,
  );

  const vocab = translated?.notes?.vocab ?? [];
  if (vocab.length > 0) {
    parts.push(
      `## 어휘·표현\n${vocab
        .map((v) => `- ${v.expr} (${v.reading}): ${v.meaning} [#${v.sid}]`)
        .join('\n')}`,
    );
  }

  const highlights = translated?.notes?.highlights ?? [];
  if (highlights.length > 0) {
    parts.push(
      `## 문법 포인트\n${highlights.map((h) => `- ${h.title}: ${h.body} [#${h.sid}]`).join('\n')}`,
    );
  }

  return parts.join('\n\n');
}

/**
 * 지난 문답에 이어서 한 번 더 묻는다.
 * @param {object} args
 * @param {object} args.doc 일기 문서
 * @param {'zh'|'ja'|'en'} args.lang
 * @param {{role:'user'|'assistant', text:string}[]} args.history 지난 문답
 * @param {string} args.question
 * @param {(text: string) => void} [args.onDelta] 글자가 오는 대로 넘겨준다
 */
export async function ask({ doc, lang, history, question, onDelta }) {
  if (!LANGS[lang]) throw new Error(`모르는 언어: ${lang}`);
  if (!doc.langs?.[lang]) throw new Error(`이 일기에는 ${LANGS[lang].label} 번역이 없다`);

  const turns = [...history.map((t) => ({ role: t.role, text: t.text })), { role: 'user', text: question }];
  if (turns[0].role !== 'user') throw new Error('대화는 질문으로 시작해야 한다');

  const { text, usage, truncated } = await askText({
    system: buildSystemPrompt(lang),
    context: buildContext({ doc, lang }),
    turns,
    onDelta,
  });

  return { text, usage, truncated };
}
