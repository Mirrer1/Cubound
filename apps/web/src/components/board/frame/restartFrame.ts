import { smooth } from './curveFrame'

// 재시작할 때 큐브와 상자가 처음 자리 위에서 내려앉는 연출
// spread는 얼음 돌끼리 나눠 갖는 출발 간격 전체
const RESTART = { fall: 0.44, stagger: 0.06, steps: 2, lift: 1.5, fadeIn: 6, spread: 0.18 }

// 늦게 출발하는 단계 수의 상한, 화면 밖 상자가 전체를 늘리지 않는 값
const stepsOf = (boxes: number) => Math.min(boxes, RESTART.steps)

export const restartDuration = (boxes: number, stones = 0) =>
  RESTART.fall + stepsOf(boxes) * RESTART.stagger + (stones > 1 ? RESTART.spread : 0)

// 처음 모습으로 돌아가는 진행도, 큐브가 내려앉는 곡선
export const restartPhase = (t: number, boxes: number, stones = 0) =>
  smooth(Math.min(1, Math.max(0, (t * restartDuration(boxes, stones)) / RESTART.fall)))

export interface DropFrame {
  lift: number // 처음 자리보다 높이 뜬 층 수
  opacity: number
}

// order는 큐브가 0, 상자가 1부터, 뒤 순서일수록 늦은 출발, rank는 얼음 돌 사이 순서 0~1
export const restartDrop = (
  t: number,
  order: number,
  boxes: number,
  stones = 0,
  rank = 0,
): DropFrame => {
  const elapsed =
    t * restartDuration(boxes, stones) - stepsOf(order) * RESTART.stagger - rank * RESTART.spread
  const p = Math.min(1, Math.max(0, elapsed / RESTART.fall))

  return { lift: RESTART.lift * (1 - smooth(p)), opacity: Math.min(1, p * RESTART.fadeIn) }
}
