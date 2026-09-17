import type { Direction } from '@/game/types'

const KEY_DIRECTIONS: Record<string, Direction> = {
  ArrowUp: 'up',
  ArrowRight: 'right',
  ArrowDown: 'down',
  ArrowLeft: 'left',
}

export const directionFromKey = (key: string): Direction | null => KEY_DIRECTIONS[key] ?? null

export const isRestartKey = (key: string) => key === 'r' || key === 'R'

export const isTouchDevice = () => window.matchMedia('(pointer: coarse)').matches
