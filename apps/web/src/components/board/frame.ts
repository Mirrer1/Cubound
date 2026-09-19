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
// 미끄러짐은 칸 수에 상관없이 속도가 같아야 상자와 큐브가 나란히 간다. max는 아주 긴 미끄러짐만 잡는다
const SLIDE = { perCell: 0.09, max: 0.9 }
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

// 미끄러지면 한 이동이 여러 구간으로 이어진다
type PathEvent = Extract<GameEvent, { type: 'moved' | 'fell' | 'climbed' | 'slid' | 'pushed' }>

const secondsOf = (event: PathEvent) =>
  event.type === 'slid'
    ? Math.min(
        SLIDE.max,
        SLIDE.perCell * (Math.abs(event.to.x - event.from.x) + Math.abs(event.to.y - event.from.y)),
      )
    : SECONDS[event.type]

const totalSeconds = (path: PathEvent[]) => path.reduce((sum, event) => sum + secondsOf(event), 0)

const playerPath = (events: GameEvent[]) =>
  events.filter(
    (e): e is PathEvent =>
      e.type === 'moved' ||
      e.type === 'fell' ||
      e.type === 'climbed' ||
      (e.type === 'slid' && e.subject === 'player'),
  )

const boxPath = (events: GameEvent[]) =>
  events.filter(
    (e): e is PathEvent => e.type === 'pushed' || (e.type === 'slid' && e.subject === 'box'),
  )

export const durationOf = (events: GameEvent[]) =>
  Math.max(
    0,
    totalSeconds(playerPath(events)),
    totalSeconds(boxPath(events)),
    ...events.map((e) => (e.type === 'blocked' || e.type === 'placed' ? SECONDS[e.type] : 0)),
  )

// 미끄러져 멈춘 이동은 다음 입력과 이어 붙이지 않는다
const slideChain = (events: GameEvent[], chain: Chain): Chain =>
  events.some((e) => e.type === 'slid') ? { in: chain.in, out: false } : chain

interface Step {
  event: PathEvent
  index: number
  p: number
}

// 경과 시간이 들어 있는 구간. 큐브와 상자가 각자 제 길이에 맞춰 늘어나 한 이동 안에서 같이 끝난다
const stepAt = (path: PathEvent[], seconds: number, chain: Chain): Step | null => {
  let start = 0
  for (const [index, event] of path.entries()) {
    const span = secondsOf(event)
    const last = index === path.length - 1
    if (seconds < start + span || last) {
      const local = Math.min(1, Math.max(0, (seconds - start) / span))
      return {
        event,
        index,
        p: moveEase(local, { in: index > 0 || chain.in, out: !last || chain.out }),
      }
    }
    start += span
  }
  return null
}

export interface CubeFrame {
  x: number
  y: number
  level: number
  direction: Direction
  angle: number
  cell: Point // 그리기 순서를 맞출 칸
}

const levelAfter = (level: number, event: PathEvent) =>
  event.type === 'fell' ? level - event.drop : event.type === 'climbed' ? level + 1 : level

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

  const path = playerPath(events)
  const step = stepAt(path, t * totalSeconds(path), slideChain(events, chain))
  if (prev && step) {
    const { event, index, p } = step
    const fromLevel = path.slice(0, index).reduce(levelAfter, standHeight(prev, prev.player))
    const toLevel = levelAfter(fromLevel, event)
    const level =
      event.type === 'fell'
        ? p < 0.55
          ? fromLevel
          : lerp(fromLevel, toLevel, easeIn((p - 0.55) / 0.45))
        : event.type === 'climbed'
          ? lerp(fromLevel, toLevel, easeOut(Math.min(1, p / 0.6)))
          : fromLevel

    return {
      x: lerp(event.from.x, event.to.x, p),
      y: lerp(event.from.y, event.to.y, p),
      level,
      direction: directionBetween(event.from, event.to),
      // 얼음 위에서는 구르지 않고 그대로 미끄러진다
      angle: event.type === 'slid' ? 0 : (Math.PI / 2) * p,
      cell: frontOf(event.from, event.to),
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

const boxLevelAfter = (prev: GameState, level: number, event: PathEvent) =>
  event.type !== 'pushed'
    ? level
    : event.result === 'filled'
      ? level - 1
      : event.result === 'fell'
        ? prev.heights[event.to.y][event.to.x]
        : level

export const movingBox = (
  prev: GameState | null,
  events: GameEvent[],
  t: number,
  chain: Chain = NO_CHAIN,
): BoxFrame | null => {
  const path = boxPath(events)
  const step = stepAt(path, t * totalSeconds(path), slideChain(events, chain))
  if (!prev || t >= 1 || !step) return null

  const { event, index, p } = step
  const start = prev.heights[path[0].from.y][path[0].from.x]
  const fromLevel = path
    .slice(0, index)
    .reduce((level, passed) => boxLevelAfter(prev, level, passed), start)
  const toLevel = boxLevelAfter(prev, fromLevel, event)
  const level =
    event.type === 'slid' || p < 0.6 ? fromLevel : lerp(fromLevel, toLevel, easeIn((p - 0.6) / 0.4))

  return {
    x: lerp(event.from.x, event.to.x, p),
    y: lerp(event.from.y, event.to.y, p),
    level,
    to: path[path.length - 1].to,
    cell: frontOf(event.from, event.to),
  }
}

// 재시작할 때 큐브와 상자가 처음 자리 위에서 내려앉는다
const RESTART = { fall: 0.38, stagger: 0.06, steps: 2, lift: 1.5, fadeIn: 6 }

// 늦게 출발하는 단계 수는 묶어서 화면 밖 상자가 전체를 늘리지 않게 한다
const stepsOf = (boxes: number) => Math.min(boxes, RESTART.steps)

export const restartDuration = (boxes: number) => RESTART.fall + stepsOf(boxes) * RESTART.stagger

export interface DropFrame {
  lift: number // 처음 자리보다 높이 뜬 층 수
  opacity: number
}

// order는 큐브가 0, 상자가 1부터. 뒤 순서일수록 늦게 출발한다
export const restartDrop = (t: number, order: number, boxes: number): DropFrame => {
  const elapsed = t * restartDuration(boxes) - stepsOf(order) * RESTART.stagger
  const p = Math.min(1, Math.max(0, elapsed / RESTART.fall))

  return { lift: RESTART.lift * (1 - easeIn(p)), opacity: Math.min(1, p * RESTART.fadeIn) }
}
