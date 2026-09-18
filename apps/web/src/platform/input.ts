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

export const directionFromKey = (key: string): Direction | null =>
  KEY_DIRECTIONS[key] ?? KEY_DIRECTIONS[key.toLowerCase()] ?? null

// 아이소메트릭 네 축은 화면 가로세로축 기준으로 대칭이라 밀어낸 방향의 부호만으로 갈린다
export const directionFromSwipe = (dx: number, dy: number): Direction | null => {
  if (Math.hypot(dx, dy) < SWIPE_MIN_DISTANCE) return null
  if (dx > 0) return dy < 0 ? 'up' : 'right'
  return dy > 0 ? 'down' : 'left'
}

export const isRestartKey = (key: string) => key === 'r' || key === 'R'

export const isTouchDevice = () => window.matchMedia('(pointer: coarse)').matches
