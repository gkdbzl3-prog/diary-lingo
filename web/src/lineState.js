// 구절 진행 표시.
//
// **채점이 아니다.** 맞게 썼는지는 보지 않는다. 칸(또는 글자 수)이 찼는지만 본다.
// CLAUDE.md의 "채점하지 않는다. 맞음/틀림 색 표시는 없다"를 지키면서
// "한 구절을 마무리했다"만 알려 주기 위해서다.
//
// 안 친 줄은 표시가 없고, 치는 중이면 빨강, 다 채우면 초록이다.
// 하나라도 지우면 다시 빨강으로 돌아온다.

/**
 * @param {number} filled 채운 칸 수(zh) 또는 친 글자 수(ja·en)
 * @param {number} total 채워야 할 칸 수 또는 원문 글자 수
 * @returns {'' | 'line-partial' | 'line-done'}
 */
export function lineState(filled, total) {
  if (filled <= 0) return '';
  return filled >= total ? 'line-done' : 'line-partial';
}
