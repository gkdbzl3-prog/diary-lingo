// 엔터를 치면 다음 줄 입력으로 넘어간다. 문장이 바뀌어도 이어진다.
//
// 줄 입력들을 DOM 순서로 모으는 쪽이 부모에서 번호를 내려주는 쪽보다 낫다.
// 언어마다 입력 모양이 다르고(중국어는 숨긴 input, 나머지는 한 줄 input),
// 문장 수도 제각각이기 때문이다.

export const TYPING_INPUT = { 'data-typing-input': '' };

export function focusNextInput(current) {
  const inputs = [...document.querySelectorAll('[data-typing-input]')];
  const at = inputs.indexOf(current);
  if (at < 0) return;

  const next = inputs[at + 1];
  if (!next) return;

  next.focus();
  // 숨긴 input은 화면에 거의 안 보이므로 그 줄 전체를 가운데로 올린다.
  (next.closest('.line') ?? next).scrollIntoView({ block: 'center', behavior: 'smooth' });
}
