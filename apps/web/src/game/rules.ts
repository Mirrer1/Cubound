import type { Direction, GameEvent, GameState, MoveResult, Point, Stage } from './types'

const OFFSETS: Record<Direction, Point> = {
  up: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
}

const same = (a: Point, b: Point) => a.x === b.x && a.y === b.y

const step = (p: Point, direction: Direction) => ({
  x: p.x + OFFSETS[direction].x,
  y: p.y + OFFSETS[direction].y,
})

// 필드 밖은 undefined, 바닥 없는 칸은 -1
const rawHeight = (state: GameState, { x, y }: Point): number | undefined => state.heights[y]?.[x]

const floorAt = (state: GameState, p: Point) => {
  const h = rawHeight(state, p)
  return h === undefined || h < 0 ? null : h
}

const hasBox = (state: GameState, p: Point) => state.boxes.some((box) => same(box, p))

// 상자 위에 서 있으면 한 층 높다
const standHeight = (state: GameState, p: Point) =>
  (floorAt(state, p) ?? 0) + (hasBox(state, p) ? 1 : 0)

export const createState = (stage: Stage): GameState => ({
  stage,
  heights: stage.heights,
  boxes: stage.entities.filter((e) => e.type === 'box').map(({ x, y }) => ({ x, y })),
  player: stage.start,
  moves: 0,
  cleared: false,
})

const walk = (state: GameState, to: Point, toHeight: number, pre: GameEvent[] = []): MoveResult => {
  const from = state.player
  const drop = standHeight(state, from) - toHeight
  const cleared = same(to, state.stage.goal)

  return {
    state: { ...state, player: to, moves: state.moves + 1, cleared },
    events: [
      ...pre,
      drop > 0 ? { type: 'fell', from, to, drop } : { type: 'moved', from, to },
      ...(cleared ? [{ type: 'cleared' } as const] : []),
    ],
  }
}

const pushBox = (state: GameState, box: Point, direction: Direction): MoveResult | null => {
  const target = step(box, direction)
  const targetHeight = rawHeight(state, target)
  const boxFloor = floorAt(state, box) ?? 0

  if (targetHeight === undefined || targetHeight > boxFloor) return null
  if (hasBox(state, target) || same(target, state.stage.goal)) return null

  const others = state.boxes.filter((b) => !same(b, box))
  const filled = targetHeight < 0

  const next: GameState = filled
    ? {
        ...state,
        boxes: others,
        heights: state.heights.map((row, y) =>
          y === target.y ? row.map((h, x) => (x === target.x ? boxFloor : h)) : row,
        ),
      }
    : { ...state, boxes: [...others, target] }

  const result = filled ? 'filled' : targetHeight < boxFloor ? 'fell' : 'slid'
  return walk(next, box, boxFloor, [{ type: 'pushed', from: box, to: target, result }])
}

export const move = (state: GameState, direction: Direction): MoveResult => {
  if (state.cleared) return { state, events: [] }

  const blocked: MoveResult = { state, events: [{ type: 'blocked', direction }] }
  const from = state.player
  const to = step(from, direction)
  const fromHeight = standHeight(state, from)
  const toFloor = floorAt(state, to)

  if (toFloor === null) return blocked

  if (!hasBox(state, to)) return toFloor > fromHeight ? blocked : walk(state, to, toFloor)

  if (toFloor + 1 <= fromHeight) return walk(state, to, toFloor + 1)
  if (toFloor > fromHeight) return blocked

  const pushed = pushBox(state, to, direction)
  if (pushed) return pushed

  return {
    state: { ...state, player: to, moves: state.moves + 1 },
    events: [{ type: 'climbed', from, to }],
  }
}
