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
// 네 방향의 경계가 화면 가로세로축이라 축에 가까운 스와이프는 작은 흔들림에 방향이 뒤집힌다
const SWIPE_MIN_AXIS = 12
// 이만큼 밀도록 축에 가까우면 흔들림이 아니라 뜻한 방향이라 보고 더 기다리지 않는다
const SWIPE_SURE_DISTANCE = 56

export const directionFromKey = (key: string): Direction | null =>
  KEY_DIRECTIONS[key] ?? KEY_DIRECTIONS[key.toLowerCase()] ?? null

// 아이소메트릭 네 축은 화면 가로세로축 기준으로 대칭이라 밀어낸 방향의 부호만으로 갈린다.
// 미는 중에는 어느 쪽인지 또렷할 때만 판정하고 손을 뗄 때는 기울기가 얕아도 받는다
export const directionFromSwipe = (dx: number, dy: number, ended = false): Direction | null => {
  const distance = Math.hypot(dx, dy)
  if (distance < SWIPE_MIN_DISTANCE) return null

  const unsure = Math.min(Math.abs(dx), Math.abs(dy)) < SWIPE_MIN_AXIS
  if (unsure && !ended && distance < SWIPE_SURE_DISTANCE) return null
  if (dx > 0) return dy < 0 ? 'up' : 'right'
  return dy > 0 ? 'down' : 'left'
}

export const isRestartKey = (key: string) => key === 'r' || key === 'R'

export const isTouchDevice = () => window.matchMedia('(pointer: coarse)').matches
