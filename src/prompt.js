import { config } from './config.js';

// 언어별 프롬프트를 같은 틀로 조립한다. 틀(학습자·번역·gloss·notes·출력)은 공통이고,
// 가운데 규칙(줄 나누기·토큰·읽기·발음)만 언어가 채운다.

const LANG = {
  zh: { name: '중국어', target: '중국어(간체)' },
  ja: { name: '일본어', target: '일본어' },
  en: { name: '영어', target: '영어' },
};

/**
 * @param {object} args
 * @param {'zh'|'ja'|'en'} args.lang
 * @param {object} args.sections 언어가 채우는 부분
 * @param {string} args.sections.attach 할 일 줄에 쓸 "병음·한글 발음·해석" 같은 목록
 * @param {string} args.sections.lines 줄 나누기 규칙
 * @param {string} args.sections.content 토큰/줄 내용 규칙
 * @param {string} [args.sections.reading] 읽는 법 규칙 (en은 없음)
 * @param {string} args.sections.pron 한글 발음 규칙과 few-shot
 * @param {string} args.sections.glossExample gloss 예시
 * @param {string} args.sections.notesReading vocab reading 칸에 뭘 적을지
 * @param {string} args.sections.highlightTitle highlights title 예시
 */
export function composeSystemPrompt({ lang, sections }) {
  const { name, target } = LANG[lang];

  const parts = [
    `당신은 한국어 일기를 ${name} 학습 자료로 바꿔 주는 선생님입니다.`,

    `## 학습자
${config.learnerLevel}`,

    `## 할 일
요청받은 한국어 문장을 ${target}로 번역하고, 따라 쓰기 연습용으로 줄을 나눠 ${sections.attach} 붙입니다.`,

    `## 번역
- 원문의 감성과 말맛을 살립니다. 직역체로 만들지 마세요.
- 한국어 한 문장이 ${name} 두 문장이 되어도 좋습니다. 그때도 같은 id 안에 넣고, text에는 두 문장을 이어서 씁니다.
- 일기 전체의 흐름을 보고 번역합니다. 앞뒤 문장과 어휘·어조를 맞추세요.`,

    sections.lines,
    sections.content,
    sections.reading,
    sections.pron,

    `## gloss
그 줄 몫의 한국어 뜻입니다. ${name} 어순대로 끊긴 뜻이어도 좋습니다(직독직해). 줄마다 하나씩 반드시 넣습니다.
${sections.glossExample}`,

    `## notes
- vocab: 학습자 수준에서 짚어 둘 표현을 expr·reading(${sections.notesReading})·meaning(뜻과 뉘앙스)·sid(그 표현이 나온 한국어 문장 id)로 정리합니다.
- highlights: 문법·표현 포인트 1~2개. title(예: "${sections.highlightTitle}"), body(짧은 설명, 필요하면 짧은 예문), sid.
- 이번에 요청받은 문장 범위 안에서만 뽑습니다.`,

    `## 출력
주어진 JSON 스키마를 그대로 지킵니다. 요청받은 문장 id를 하나도 빼지 않고, 오름차순으로 넣습니다.`,
  ];

  return parts.filter(Boolean).join('\n\n');
}

/**
 * 일기 전체. 묶음이 몇 개든 글자 하나까지 똑같아야 prompt caching이 먹는다.
 * 그래서 요청 범위(묶음마다 다름)는 여기 넣지 않는다.
 */
export function buildContext(allSentences) {
  const full = allSentences.map((s) => `[p${s.p} #${s.id}] ${s.ko}`).join('\n');
  return `## 일기 전체 (맥락용)
${full}`;
}

/** 묶음마다 달라지는 부분. 캐시 구간 뒤에 온다. */
export function buildRequest({ allSentences, requestIds, problems }) {
  const asked = allSentences
    .filter((s) => requestIds.includes(s.id))
    .map((s) => `#${s.id}: ${s.ko}`)
    .join('\n');

  let out = `## 이번에 번역할 문장
아래 ${requestIds.length}개 문장만 처리하세요. id는 위 일기의 번호입니다.
${asked}`;

  if (problems && problems.length > 0) {
    out += `

## 직전 응답에서 고칠 점
아래 문제를 반드시 해결해서 다시 만드세요.
${problems.map((p) => `- ${p}`).join('\n')}`;
  }

  return out;
}
