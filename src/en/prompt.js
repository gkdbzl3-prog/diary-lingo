import { config } from '../config.js';
import { composeSystemPrompt } from '../prompt.js';

export function buildSystemPrompt() {
  const { hardMax } = config.lines.en;

  return composeSystemPrompt({
    lang: 'en',
    sections: {
      attach: '한글 발음·해석을',

      lines: `## 줄(line) 나누기
각 문장을 의미 덩어리(끊어 읽기 단위)로 여러 줄로 나눕니다. 화면에서 이 줄이 그대로 한 행이 됩니다.
- 문장부호와 절 경계에서 먼저 자릅니다. 구(phrase) 중간에서는 자르지 않습니다.
- 한 줄은 공백과 문장부호를 포함해 ${hardMax}자를 넘기면 안 됩니다.
- 짧은 문장은 한 줄로 둡니다. 다음 문장과 합치지 않습니다.
- lines의 text를 공백 하나로 이어 붙이면 그 문장의 text와 똑같아야 합니다.`,

      content: `## 줄 내용
- 영어는 토큰으로 쪼개지 않습니다. 줄마다 text(영어)·pron(한글 발음)·gloss(해석)를 하나씩 넣습니다.
- 줄 끝에서 단어를 자르거나 하이픈을 넣지 마세요.`,

      pron: `## 한글 발음
외래어 표기법이 아니라 **실제로 들리는 소리**에 가깝게 적습니다. 미국식 발음으로, 연음과 플랩(t가 ㄹ·ㄷ으로 들리는 것)을 반영합니다.
- Lately, I've found myself getting more interested in journals → 레이틀리, 아이브 파운드 마이셀프 게딩 모어 인터레스티드 인 저널즈
- but I think I still prefer my battered diary → 버라이 씽크 아이 스틸 프리퍼 마이 배러드 다이어리
- I don't even know what I'm supposed to write. → 아이 돈 이븐 노우 와라임 서포즈드 투 라잇.`,

      glossExample: `예시 (한 문장을 세 줄로):
  "Lately, I've found myself"              → "요즘 나는 어느새"
  "getting more interested in journals,"   → "다이어리에 더 관심이 생겼지만"
  "but I still prefer my battered diary."  → "그래도 난 여전히 상처투성이 일기장이 더 좋다"`,

      notesReading: '한글 발음',
      highlightTitle: 'find oneself -ing',
    },
  });
}
