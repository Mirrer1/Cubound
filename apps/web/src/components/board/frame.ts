import { standHeight } from '@/game/rules'
import type { Direction, GameEvent, GameState, Point } from '@/game/types'

const SECONDS = {
  moved: 0.24,
  pushed: 0.26,
  fell: 0.32,
  climbed: 0.3,
  blocked: 0.2,
  placed: 0.22,
}
const TILT = 0.24

const easeIn = (t: number) => t * t
const easeOut = (t: number) => 1 - (1 - t) ** 2
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

// 연달아 이동할 때 앞뒤 이동과 이어지는 쪽은 멈추지 않고 굴러간다
export interface Chain {
  in: boolean // 앞 이동에서 바로 이어짐
  out: boolean // 다음 입력이 기다림
}

const NO_CHAIN: Chain = { in: false, out: false }

// 0에서 멈춰 있다가 0.5에서 속도 1로 이어지는 앞쪽 절반 곡선
const startHalf = (t: number) => -4 * t ** 3 + 4 * t ** 2

// 앞쪽 절반은 앞 이동과의 이어짐만, 뒤쪽 절반은 다음 입력만 보고 정해 도중에 입력이 와도 튀지 않는다
export const moveEase = (t: number, chain: Chain) =>
  t < 0.5 ? (chain.in ? t : startHalf(t)) : chain.out ? t : 1 - startHalf(1 - t)

export const directionBetween = (from: Point, to: Point): Direction =>
  to.x > from.x ? 'right' : to.x < from.x ? 'left' : to.y > from.y ? 'down' : 'up'

export const durationOf = (events: GameEvent[]) =>
  Math.max(
    0,
    ...events.map((e) => (e.type in SECONDS ? SECONDS[e.type as keyof typeof SECONDS] : 0)),
  )

export interface CubeFrame {
  x: number
  y: number
  level: number
  direction: Direction
  angle: number
  cell: Point // 그리기 순서를 맞출 칸
}

const movementOf = (events: GameEvent[]) =>
  events.find((e) => e.type === 'moved' || e.type === 'fell' || e.type === 'climbed') as
    Extract<GameEvent, { type: 'moved' | 'fell' | 'climbed' }> | undefined

// 앞쪽 칸에 그려야 뒤쪽 칸 블록에 덮이지 않는다
const frontOf = (a: Point, b: Point) => (a.x + a.y >= b.x + b.y ? a : b)

export const playerFrame = (
  prev: GameState | null,
  game: GameState,
  events: GameEvent[],
  t: number,
  chain: Chain = NO_CHAIN,
): CubeFrame => {
  const { player } = game
  const still = {
    ...player,
    level: standHeight(game, player),
    direction: 'right' as Direction,
    angle: 0,
    cell: player,
  }
  if (t >= 1) return still

  const movement = movementOf(events)
  if (prev && movement) {
    const p = moveEase(t, chain)
    const fromLevel = standHeight(prev, movement.from)
    const toLevel = standHeight(game, movement.to)
    const level =
      movement.type === 'fell'
        ? p < 0.55
          ? fromLevel
          : lerp(fromLevel, toLevel, easeIn((p - 0.55) / 0.45))
        : movement.type === 'climbed'
          ? lerp(fromLevel, toLevel, easeOut(Math.min(1, p / 0.6)))
          : fromLevel

    return {
      x: lerp(movement.from.x, movement.to.x, p),
      y: lerp(movement.from.y, movement.to.y, p),
      level,
      direction: directionBetween(movement.from, movement.to),
      angle: (Math.PI / 2) * p,
      cell: frontOf(movement.from, movement.to),
    }
  }

  const blocked = events.find((e) => e.type === 'blocked')
  if (blocked?.type === 'blocked') {
    return { ...still, direction: blocked.direction, angle: Math.sin(Math.PI * t) * TILT }
  }

  return still
}

export interface BoxFrame {
  x: number
  y: number
  level: number
  to: Point
  cell: Point
}

export const movingBox = (
  prev: GameState | null,
  events: GameEvent[],
  t: number,
  chain: Chain = NO_CHAIN,
): BoxFrame | null => {
  const push = events.find((e) => e.type === 'pushed')
  if (!prev || t >= 1 || push?.type !== 'pushed') return null

  const p = moveEase(t, chain)
  const fromLevel = prev.heights[push.from.y][push.from.x]
  const toLevel =
    push.result === 'filled'
      ? fromLevel - 1
      : push.result === 'fell'
        ? prev.heights[push.to.y][push.to.x]
        : fromLevel
  const level = p < 0.6 ? fromLevel : lerp(fromLevel, toLevel, easeIn((p - 0.6) / 0.4))

  return {
    x: lerp(push.from.x, push.to.x, p),
    y: lerp(push.from.y, push.to.y, p),
    level,
    to: push.to,
    cell: frontOf(push.from, push.to),
  }
}
