import type { Direction } from '@/game/types'

const KEY_DIRECTIONS: Record<string, Direction> = {
  ArrowUp: 'up',
  ArrowRight: 'right',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  w: 'up',
  d: 'right',
  s: 'down',
  a: 'left',
}

const SWIPE_MIN_DISTANCE = 28
// 손을 뗄 때 받는 짧게 튕긴 스와이프의 최소 거리, 탭의 흔들림보다 큰 값
const FLICK_MIN_DISTANCE = 20
// 축에 가까운 스와이프가 작은 흔들림에 뒤집히지 않는 최소 축 거리, 네 방향의 경계가 화면 가로세로축인 탓
const SWIPE_MIN_AXIS = 12
// 손을 뗄 때까지 기다리는 축에서 15도 안쪽, 엄지가 처지며 출발한 흔들림일 수 있는 범위
const SWIPE_MIN_SLOPE = Math.tan((15 * Math.PI) / 180)

export const directionFromKey = (key: string): Direction | null =>
  KEY_DIRECTIONS[key] ?? KEY_DIRECTIONS[key.toLowerCase()] ?? null

// 화면 가로세로축 기준으로 대칭인 아이소메트릭 네 축, 밀어낸 방향의 부호로 가르는 방향
// 미는 중에는 또렷할 때만 판정, 손을 뗄 때는 기울기가 얕아도 판정
export const directionFromSwipe = (dx: number, dy: number, ended = false): Direction | null => {
  const distance = Math.hypot(dx, dy)
  if (distance < (ended ? FLICK_MIN_DISTANCE : SWIPE_MIN_DISTANCE)) return null

  const minor = Math.min(Math.abs(dx), Math.abs(dy))
  const major = Math.max(Math.abs(dx), Math.abs(dy))
  const unsure = minor < SWIPE_MIN_AXIS || minor < major * SWIPE_MIN_SLOPE
  if (unsure && !ended) return null
  if (dx > 0) return dy < 0 ? 'up' : 'right'
  return dy > 0 ? 'down' : 'left'
}

export const isRestartKey = (key: string) => key === 'r' || key === 'R'

export const isTouchDevice = () => window.matchMedia('(pointer: coarse)').matches
