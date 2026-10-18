import { config } from '../config.js';
import { composeSystemPrompt } from '../prompt.js';

export function buildSystemPrompt() {
  const { targetMin, targetMax, hardMax } = config.lines.zh;

  return composeSystemPrompt({
    lang: 'zh',
    sections: {
      attach: '병음·한글 발음·해석을',

      lines: `## 줄(line) 나누기
각 문장을 의미 덩어리(끊어 읽기 단위)로 여러 줄로 나눕니다. 화면에서 이 줄이 그대로 한 행이 됩니다.
- 문장부호와 절 경계에서 먼저 자릅니다. 단어나 구 중간에서는 절대 자르지 않습니다.
- 한 줄은 문장부호를 포함해 ${targetMin}~${targetMax}자를 목표로 하고, ${hardMax}자를 넘기면 안 됩니다.
- 짧은 문장은 한 줄로 둡니다. 다음 문장과 합치지 않습니다.
- lines의 토큰을 전부 이어 붙이면 그 문장의 text와 글자 하나까지 똑같아야 합니다. 공백을 넣지 마세요.`,

      content: `## 토큰
- 단어(词) 단위로 자릅니다. 문장부호는 그 자체로 토큰 하나입니다.
- 단어 토큰: w(한자), py(병음 배열), pron(한글 발음 배열). **py와 pron의 길이는 w의 글자 수와 정확히 같아야 합니다.**
  예) { "w": "风潮", "py": ["fēng", "cháo"], "pron": ["펑", "차오"] }
- 문장부호 토큰: w만 넣고 py·pron은 아예 빼세요. 예) { "w": "，" }
- 아랍 숫자는 글자 하나하나에 읽는 법을 붙입니다. 화면에서 숫자도 한 글자가 한 칸입니다.
  예) { "w": "2023", "py": ["èr", "líng", "èr", "sān"], "pron": ["얼", "링", "얼", "싼"] }`,

      reading: `## 병음
- 성조 부호로 적습니다(ā á ǎ à).
- 不·一의 성조 변화는 반영합니다: 不是 bú shì, 一种 yì zhǒng.
- 3성 연속 변화는 반영하지 않고 원래 성조로 적습니다: 很好 hěn hǎo.
- 경성은 부호 없이 적습니다: 的 de, 了 le, 着 zhe.`,

      pron: `## 한글 발음
외래어 표기법이 아니라 **실제로 들리는 소리**에 가깝게 적습니다. 1·4성의 무기음(b d g z zh j)은 된소리로 적는 경향을 따릅니다. 완벽히 일관될 필요는 없습니다.
- 最近跟着这股风潮 / Zuìjìn gēnzhe zhè gǔ fēngcháo / 쮀이진 껀저 쪄 구 펑차오
- 我也渐渐对手账感兴趣了 / wǒ yě jiànjiàn duì shǒuzhàng gǎn xìngqù le / 워 예 지앤지앤 뛔이 쇼우장 간 싱취 러
- 但我好像还是更喜欢 / dàn wǒ hǎoxiàng háishi gèng xǐhuan / 딴 워 하오샹 하이쓰 껑 시환`,

      glossExample: `예시 (한 문장을 네 줄로):
  最近跟着这股风潮，      → "요즘 이 유행을 따라"
  我也渐渐对手账感兴趣了， → "나도 점점 다이어리에 관심이 생겼고"
  但我好像还是更喜欢       → "그래도 난 아무래도 더 좋아하는 것 같아"
  那种没人会翻看的日记本。  → "아무도 들춰 보지 않는 그런 일기장을"`,

      notesReading: '성조 부호 병음',
      highlightTitle: '连 A 都 …',
    },
  });
}
