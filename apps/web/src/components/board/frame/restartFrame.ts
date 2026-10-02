import { easeIn } from './curveFrame'

// 재시작할 때 큐브와 상자가 처음 자리 위에서 내려앉는 연출
const RESTART = { fall: 0.38, stagger: 0.06, steps: 2, lift: 1.5, fadeIn: 6 }

// 늦게 출발하는 단계 수의 상한, 화면 밖 상자가 전체를 늘리지 않는 값
const stepsOf = (boxes: number) => Math.min(boxes, RESTART.steps)

export const restartDuration = (boxes: number) => RESTART.fall + stepsOf(boxes) * RESTART.stagger

export interface DropFrame {
  lift: number // 처음 자리보다 높이 뜬 층 수
  opacity: number
}

// order는 큐브가 0, 상자가 1부터, 뒤 순서일수록 늦은 출발
export const restartDrop = (t: number, order: number, boxes: number): DropFrame => {
  const elapsed = t * restartDuration(boxes) - stepsOf(order) * RESTART.stagger
  const p = Math.min(1, Math.max(0, elapsed / RESTART.fall))

  return { lift: RESTART.lift * (1 - easeIn(p)), opacity: Math.min(1, p * RESTART.fadeIn) }
}
