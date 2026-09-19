import type {
  Direction,
  Entity,
  GameEvent,
  GameState,
  LeaningLadder,
  MoveResult,
  Point,
  Stage,
} from './types'

type Lift = Extract<Entity, { type: 'lift' }>

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

const hasBox = (state: GameState, p: Point) => state.boxes.some((box) => same(box, p))

const doors = (stage: Stage) => stage.entities.filter((e) => e.type === 'door')

const lifts = (stage: Stage) => stage.entities.filter((e) => e.type === 'lift')

const isPressed = (state: GameState, p: Point) => same(state.player, p) || hasBox(state, p)

const isSwitchOn = (state: GameState, target: string) =>
  state.stage.entities.some(
    (e) => e.type === 'switch' && e.target === target && isPressed(state, e),
  )

// 연결된 스위치가 하나라도 눌렸거나 문 위에 무언가 있으면 열림
export const isDoorOpen = (state: GameState, id: string) =>
  isSwitchOn(state, id) ||
  doors(state.stage).some((door) => door.id === id && isPressed(state, door))

// 발판 위에 큐브나 상자가 있으면 스위치와 상관없이 직전 높이를 지킨다
const isRaised = (state: GameState, lift: Lift) =>
  isPressed(state, lift) ? state.raisedLifts.includes(lift.id) : isSwitchOn(state, lift.id)

export const isLiftRaised = (state: GameState, id: string) => {
  const lift = lifts(state.stage).find((l) => l.id === id)
  return lift !== undefined && isRaised(state, lift)
}

// 필드 밖은 undefined, 바닥 없는 칸은 -1, 올라간 발판은 한 층 높다
const rawHeight = (state: GameState, p: Point): number | undefined => {
  const h = state.heights[p.y]?.[p.x]
  if (h === undefined) return undefined

  const lift = state.stage.entities.find((e): e is Lift => e.type === 'lift' && same(e, p))
  return lift && isRaised(state, lift) ? h + 1 : h
}

const floorAt = (state: GameState, p: Point) => {
  const h = rawHeight(state, p)
  return h === undefined || h < 0 ? null : h
}

const isClosedDoor = (state: GameState, p: Point) =>
  doors(state.stage).some((door) => same(door, p) && !isDoorOpen(state, door.id))

export const isIce = (state: GameState, { x, y }: Point) => state.stage.ice?.[y]?.[x] === '#'

// 상자 위에 올라선 큐브는 얼음 바닥을 밟지 않은 것으로 본다
const onIce = (state: GameState, p: Point) => isIce(state, p) && !hasBox(state, p)

// 상자 위에 서 있으면 한 층 높다
export const standHeight = (state: GameState, p: Point) =>
  (floorAt(state, p) ?? 0) + (hasBox(state, p) ? 1 : 0)

// 보스 이동 제한이 없으면 null
export const movesLeft = (state: GameState) => {
  const limit = state.stage.rules?.moveLimit
  return limit === undefined ? null : Math.max(limit - state.moves, 0)
}

export const createState = (stage: Stage): GameState => ({
  stage,
  heights: stage.heights,
  boxes: stage.entities.filter((e) => e.type === 'box').map(({ x, y }) => ({ x, y })),
  ladders: stage.entities.filter((e) => e.type === 'ladder').map(({ x, y }) => ({ x, y })),
  leaningLadders: [],
  raisedLifts: [],
  carrying: false,
  player: stage.start,
  moves: 0,
  cleared: false,
})

// 얼음에 올라선 큐브가 멈출 칸까지 같은 방향으로 이어서 간다
const slidePlayer = (
  state: GameState,
  from: Point,
  direction: Direction,
): { rest: Point; landed: Point | null } => {
  const level = floorAt(state, from) ?? 0
  let at = from

  for (;;) {
    if (!onIce(state, at) || same(at, state.stage.goal)) return { rest: at, landed: null }

    const next = step(at, direction)
    const floor = floorAt(state, next)
    if (floor === null || floor > level || hasBox(state, next) || isClosedDoor(state, next)) {
      return { rest: at, landed: null }
    }
    if (floor < level) return { rest: at, landed: next }
    at = next
  }
}

// 얼음에서 이어 미끄러진 뒤 빈손이면 바닥의 사다리나 타고 내려온 사다리를 줍는다
const arrive = (
  state: GameState,
  to: Point,
  direction: Direction,
  event: GameEvent,
  pre: GameEvent[] = [],
): MoveResult => {
  const from = state.player
  // 떨어져 내려온 칸에서는 미끄러지지 않아 낙하가 언제나 미끄러짐을 끝낸다
  const slide =
    event.type === 'fell' ? { rest: to, landed: null } : slidePlayer(state, to, direction)
  const { rest, landed } = slide
  const at = landed ?? rest
  const events = [...pre, event]

  if (!same(rest, to)) events.push({ type: 'slid', subject: 'player', from: to, to: rest })
  if (landed) {
    const drop = (floorAt(state, rest) ?? 0) - (floorAt(state, landed) ?? 0)
    events.push({ type: 'fell', from: rest, to: landed, drop })
  }

  const next: GameState = {
    ...state,
    player: at,
    moves: state.moves + 1,
    cleared: same(at, state.stage.goal),
  }
  if (state.carrying) return { state: next, events }

  const pickedUp: GameEvent = { type: 'pickedUp', at }

  if (state.ladders.some((l) => same(l, at))) {
    const ladders = state.ladders.filter((l) => !same(l, at))
    return { state: { ...next, ladders, carrying: true }, events: [...events, pickedUp] }
  }

  const climbedDown = (l: LeaningLadder) => same(l, at) && same(step(l, l.direction), from)
  if (state.leaningLadders.some(climbedDown)) {
    const leaningLadders = state.leaningLadders.filter((l) => !climbedDown(l))
    return { state: { ...next, leaningLadders, carrying: true }, events: [...events, pickedUp] }
  }

  return { state: next, events }
}

const walk = (
  state: GameState,
  to: Point,
  toHeight: number,
  direction: Direction,
  pre: GameEvent[] = [],
) => {
  const from = state.player
  const drop = standHeight(state, from) - toHeight
  const event: GameEvent = drop > 0 ? { type: 'fell', from, to, drop } : { type: 'moved', from, to }
  return arrive(state, to, direction, event, pre)
}

// 한 층 높은 칸 앞에서 기대 놓인 사다리로 오르거나 들고 있던 사다리를 놓는다
const climbOrPlaceLadder = (
  state: GameState,
  to: Point,
  direction: Direction,
): MoveResult | null => {
  const from = state.player
  const toFloor = floorAt(state, to)
  if (hasBox(state, from) || toFloor !== standHeight(state, from) + 1) return null

  if (state.leaningLadders.some((l) => same(l, from) && l.direction === direction)) {
    return arrive(state, to, direction, { type: 'climbed', from, to, via: 'ladder' })
  }

  if (!state.carrying) return null

  const ladder = { ...from, direction }
  return {
    state: {
      ...state,
      carrying: false,
      leaningLadders: [...state.leaningLadders, ladder],
      moves: state.moves + 1,
    },
    events: [{ type: 'placed', ladder }],
  }
}

// 상자가 들어갈 수 있는 칸이면 그 높이를 돌려준다. 바닥 없는 칸은 -1로 들어가 메운다
const boxLanding = (state: GameState, p: Point, level: number): number | null => {
  const floor = rawHeight(state, p)
  if (floor === undefined || floor > level) return null
  if (
    hasBox(state, p) ||
    state.ladders.some((l) => same(l, p)) ||
    same(p, state.stage.goal) ||
    isClosedDoor(state, p)
  )
    return null

  return floor
}

// 얼음에 올라선 상자가 멈출 칸까지 같은 방향으로 이어서 간다
const slideBox = (
  state: GameState,
  from: Point,
  direction: Direction,
  level: number,
): { rest: Point; landed: { to: Point; result: 'fell' | 'filled' } | null } => {
  let at = from

  for (;;) {
    if (!isIce(state, at)) return { rest: at, landed: null }

    const next = step(at, direction)
    const floor = boxLanding(state, next, level)
    if (floor === null) return { rest: at, landed: null }
    if (floor < level)
      return { rest: at, landed: { to: next, result: floor < 0 ? 'filled' : 'fell' } }
    at = next
  }
}

const pushBox = (state: GameState, box: Point, direction: Direction): MoveResult | null => {
  const boxFloor = floorAt(state, box) ?? 0
  const target = step(box, direction)
  const landing = boxLanding(state, target, boxFloor)
  if (landing === null) return null

  const slide = landing < 0 ? null : slideBox(state, target, direction, landing)
  const rest = slide?.rest ?? target
  const landed = slide?.landed ?? null

  const events: GameEvent[] = [
    {
      type: 'pushed',
      from: box,
      to: target,
      result: landing < 0 ? 'filled' : landing < boxFloor ? 'fell' : 'slid',
    },
  ]
  if (!same(rest, target)) events.push({ type: 'slid', subject: 'box', from: target, to: rest })
  if (landed) events.push({ type: 'pushed', from: rest, to: landed.to, result: landed.result })

  const others = state.boxes.filter((b) => !same(b, box))
  const filled = landing < 0 ? target : landed?.result === 'filled' ? landed.to : null
  const fillHeight = landing < 0 ? boxFloor : landing

  const next: GameState = filled
    ? {
        ...state,
        boxes: others,
        heights: state.heights.map((row, y) =>
          y === filled.y ? row.map((h, x) => (x === filled.x ? fillHeight : h)) : row,
        ),
      }
    : { ...state, boxes: [...others, landed?.to ?? rest] }

  return walk(next, box, boxFloor, direction, events)
}

const moveOnce = (state: GameState, direction: Direction): MoveResult => {
  const blocked: MoveResult = { state, events: [{ type: 'blocked', direction }] }
  const from = state.player
  const to = step(from, direction)
  const fromHeight = standHeight(state, from)
  const toFloor = floorAt(state, to)

  if (toFloor === null || isClosedDoor(state, to)) return blocked

  if (!hasBox(state, to)) {
    if (toFloor <= fromHeight) return walk(state, to, toFloor, direction)
    return climbOrPlaceLadder(state, to, direction) ?? blocked
  }

  if (toFloor + 1 <= fromHeight) return walk(state, to, toFloor + 1, direction)
  if (toFloor > fromHeight) return blocked

  const pushed = pushBox(state, to, direction)
  if (pushed) return pushed

  return arrive(state, to, direction, { type: 'climbed', from, to, via: 'box' })
}

const settleLifts = (state: GameState): GameState => {
  const all = lifts(state.stage)
  if (all.length === 0) return state

  const raised = all.filter((lift) => isRaised(state, lift)).map((lift) => lift.id)
  return { ...state, raisedLifts: raised }
}

export const move = (state: GameState, direction: Direction): MoveResult => {
  if (state.cleared) return { state, events: [] }
  if (movesLeft(state) === 0) return { state, events: [{ type: 'blocked', direction }] }

  const result = moveOnce(state, direction)
  if (result.state === state) return result

  const moved = settleLifts(result.state)

  const doorEvents: GameEvent[] = doors(state.stage)
    .map((door) => ({
      id: door.id,
      before: isDoorOpen(state, door.id),
      after: isDoorOpen(moved, door.id),
    }))
    .filter(({ before, after }) => before !== after)
    .map(({ id, after }) => ({ type: 'door', id, open: after }))

  const liftEvents: GameEvent[] = lifts(state.stage)
    .filter((lift) => isRaised(state, lift) !== isRaised(moved, lift))
    .map((lift) => ({ type: 'lift', id: lift.id, up: isRaised(moved, lift) }))

  return {
    state: moved,
    events: [
      ...result.events,
      ...doorEvents,
      ...liftEvents,
      ...(moved.cleared ? [{ type: 'cleared' } as const] : []),
    ],
  }
}
