import type {
  Crack,
  Direction,
  Entity,
  GameEvent,
  GameState,
  LeaningLadder,
  Limit,
  MoveResult,
  Point,
  Stage,
  TramSpot,
} from './types'

type Lift = Extract<Entity, { type: 'lift' }>
type Tram = Extract<Entity, { type: 'tram' }>

// 늪에서 나가기 전에 제자리에서 버둥거리는 수
export const STRUGGLES = 2

const OFFSETS: Record<Direction, Point> = {
  up: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
}

const same = (a: Point, b: Point) => a.x === b.x && a.y === b.y

// 보스 제약에 막혀 제자리에 선다. 이동 수를 쓰지 않는다
const limitBlocked = (state: GameState, direction: Direction, limit: Limit): MoveResult => ({
  state,
  events: [
    { type: 'blocked', direction },
    { type: 'limit', limit },
  ],
})

const step = (p: Point, direction: Direction) => ({
  x: p.x + OFFSETS[direction].x,
  y: p.y + OFFSETS[direction].y,
})

const hasBox = (state: GameState, p: Point) => state.boxes.some((box) => same(box, p))

const doors = (stage: Stage) => stage.entities.filter((e) => e.type === 'door')

const lifts = (stage: Stage) => stage.entities.filter((e) => e.type === 'lift')

const warps = (stage: Stage) => stage.entities.filter((e) => e.type === 'warp')

const trams = (stage: Stage) => stage.entities.filter((e): e is Tram => e.type === 'tram')

// 발판이 지금 서 있는 칸이면 그 발판
const tramAt = (state: GameState, p: Point): Tram | null => {
  if (state.trams.length === 0) return null

  return trams(state.stage).find((tram, i) => same(tram.cells[state.trams[i].at], p)) ?? null
}

// 발판이 지금 서 있는 칸이면 그 윗면 높이
const tramLevelAt = (state: GameState, p: Point): number | null => tramAt(state, p)?.level ?? null

// 어느 발판이든 오가는 길에 든 칸
const onTramPath = (stage: Stage, p: Point) =>
  trams(stage).some((tram) => tram.cells.some((cell) => same(cell, p)))

// 짝 칸이면 같은 id를 가진 나머지 한 칸, 아니면 null
const warpExit = (stage: Stage, p: Point): Point | null => {
  const here = warps(stage).find((w) => same(w, p))
  const pair = here && warps(stage).find((w) => w.id === here.id && !same(w, p))
  return pair ? { x: pair.x, y: pair.y } : null
}

// 밟힌 버섯이 시드는 판에서는 버섯을 다 밟아야 구멍에서 끝난다
const clearedAt = (state: GameState, p: Point) =>
  same(p, state.stage.goal) && !(state.stage.rules?.mushroomWither && state.mushrooms.length > 0)

const isPressed = (state: GameState, p: Point) => same(state.player, p) || hasBox(state, p)

const isSwitchOn = (state: GameState, target: string) =>
  state.stage.entities.some(
    (e) => e.type === 'switch' && e.target === target && isPressed(state, e),
  )

// 연결된 스위치가 하나라도 눌렸거나 문 위에 무언가 있으면 열림
export const isDoorOpen = (state: GameState, id: string) =>
  isSwitchOn(state, id) ||
  doors(state.stage).some((door) => door.id === id && isPressed(state, door))

// 연결된 스위치가 하나라도 눌려 있으면 한 층 올라간다. 위에 선 큐브와 상자는 따라 오르내린다
export const isLiftRaised = (state: GameState, id: string) => isSwitchOn(state, id)

// 필드 밖은 undefined, 바닥 없는 칸은 -1, 올라간 발판은 한 층 높다
const rawHeight = (state: GameState, p: Point): number | undefined => {
  const h = state.heights[p.y]?.[p.x]
  if (h === undefined) return undefined

  const tramLevel = tramLevelAt(state, p)
  if (tramLevel !== null) return tramLevel

  const lift = state.stage.entities.find((e): e is Lift => e.type === 'lift' && same(e, p))
  return lift && isLiftRaised(state, lift.id) ? h + 1 : h
}

const floorAt = (state: GameState, p: Point) => {
  const h = rawHeight(state, p)
  return h === undefined || h < 0 ? null : h
}

const isClosedDoor = (state: GameState, p: Point) =>
  doors(state.stage).some((door) => same(door, p) && !isDoorOpen(state, door.id))

export const isIce = (state: GameState, { x, y }: Point) => state.stage.ice?.[y]?.[x] === '#'

const isSwamp = (state: GameState, p: Point) => state.swamps.some((cell) => same(cell, p))

export const isMushroom = (state: GameState, p: Point) =>
  state.mushrooms.some((cell) => same(cell, p))

// 밟혀 튕긴 버섯은 시드는 판에서만 사라진다
const wither = (state: GameState, sprung: Point[]) =>
  state.stage.rules?.mushroomWither
    ? state.mushrooms.filter((cell) => !sprung.some((s) => same(s, cell)))
    : state.mushrooms

// 깊어지는 늪에서는 빠진 횟수만큼 버둥이 는다. 지금 선 늪이 몇 번째로 빠진 것이냐로 센다
const strugglesNeeded = (state: GameState) =>
  state.stage.rules?.swampDeepen ? STRUGGLES + state.sinks - 1 : STRUGGLES

// 늪에 선 큐브는 정해진 수를 버둥거린 뒤에야 나갈 수 있다
const struggling = (state: GameState) =>
  isSwamp(state, state.player) && state.struggles < strugglesNeeded(state)

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

// 보스 밀기 제한이 없으면 null
export const pushesLeft = (state: GameState) => {
  const limit = state.stage.rules?.pushLimit
  return limit === undefined ? null : Math.max(limit - state.pushes, 0)
}

// 보스 올라가기 제한이 없으면 null
export const climbsLeft = (state: GameState) => {
  const limit = state.stage.rules?.climbLimit
  return limit === undefined ? null : Math.max(limit - state.climbs, 0)
}

// 보스 타는 횟수 제한이 없으면 null
export const ridesLeft = (state: GameState) => {
  const limit = state.stage.rules?.rideLimit
  return limit === undefined ? null : Math.max(limit - state.rides, 0)
}

// 깊어지는 늪이 아니면 null. 늪에 빠진 횟수다
export const sinkCount = (state: GameState) => (state.stage.rules?.swampDeepen ? state.sinks : null)

// 밟힌 버섯이 시드는 판이 아니면 null. 아직 밟지 않은 버섯 수다
export const capsLeft = (state: GameState) =>
  state.stage.rules?.mushroomWither ? state.mushrooms.length : null

// 보스 방향 제한이 없으면 null
export const dirLeft = (state: GameState) => {
  const limit = state.stage.rules?.dirLimit
  return limit === undefined ? null : Math.max(limit.count - state.dirUses, 0)
}

export const readCracks = (stage: Stage): Crack[] =>
  (stage.cracks ?? []).flatMap((row, y) =>
    [...row].flatMap((c, x) => (c === '.' ? [] : [{ x, y, left: Number(c) }])),
  )

export const readSwamps = (stage: Stage): Point[] =>
  (stage.swamp ?? []).flatMap((row, y) => [...row].flatMap((c, x) => (c === '#' ? [{ x, y }] : [])))

export const readMushrooms = (stage: Stage): Point[] =>
  (stage.mushroom ?? []).flatMap((row, y) =>
    [...row].flatMap((c, x) => (c === '#' ? [{ x, y }] : [])),
  )

export const createState = (stage: Stage): GameState => ({
  stage,
  heights: stage.heights,
  boxes: stage.entities.filter((e) => e.type === 'box').map(({ x, y }) => ({ x, y })),
  cracks: readCracks(stage),
  trams: trams(stage).map(({ id, cells, dir, x, y }) => ({
    id,
    at: cells.findIndex((cell) => same(cell, { x, y })),
    dir,
  })),
  swamps: readSwamps(stage),
  mushrooms: readMushrooms(stage),
  struggles: 0,
  sinks: 0,
  ladders: stage.entities.filter((e) => e.type === 'ladder').map(({ x, y }) => ({ x, y })),
  leaningLadders: [],
  carrying: false,
  player: stage.start,
  moves: 0,
  pushes: 0,
  climbs: 0,
  rides: 0,
  dirUses: 0,
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
  const stop = landed ?? rest
  const events = [...pre, event]

  if (!same(rest, to)) events.push({ type: 'slid', subject: 'player', from: to, to: rest })
  if (landed) {
    const drop = (floorAt(state, rest) ?? 0) - (floorAt(state, landed) ?? 0)
    events.push({ type: 'fell', from: rest, to: landed, drop })
  }

  // 상자 위에 올라선 큐브는 짝 칸을 밟지 않은 것으로 보고, 나올 칸이 상자로 막히면 그대로 선다
  const exit = warpExit(state.stage, stop)
  const warped = exit && !hasBox(state, stop) && !hasBox(state, exit) ? exit : null
  const at = warped ?? stop
  if (warped) events.push({ type: 'warped', from: stop, to: warped })

  // 걸어 들어가든 떨어져 내려앉든 늪 칸에 닿은 이동이 빠진 것이다
  const next: GameState = {
    ...state,
    player: at,
    moves: state.moves + 1,
    struggles: 0,
    sinks: state.sinks + (isSwamp(state, at) ? 1 : 0),
    cleared: clearedAt(state, at),
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

// 밟혀 튕긴 큐브가 내려설 자리와 지나며 밟은 버섯들. 첫 칸에서 못 뛰면 null
const hop = (
  state: GameState,
  from: Point,
  direction: Direction,
): { to: Point; height: number; sprung: Point[] } | null => {
  const sprung: Point[] = []
  let at = from

  for (;;) {
    const level = floorAt(state, at) ?? 0
    // 못 뛰면 연쇄가 멈춘 버섯 칸에 그대로 선다
    const stopped = sprung.length > 0 ? { to: at, height: level, sprung } : null
    // 사이 칸은 높이를 보지 않아 벽도 구덩이도 넘는다
    const to = step(step(at, direction), direction)
    const floor = floorAt(state, to)
    if (floor === null || isClosedDoor(state, to)) return stopped

    const height = floor + (hasBox(state, to) ? 1 : 0)
    if (height > level + 1) return stopped

    sprung.push(at)
    if (!isMushroom(state, to)) return { to, height, sprung }
    at = to
  }
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

const spring = (
  state: GameState,
  { to, height, sprung }: { to: Point; height: number; sprung: Point[] },
  direction: Direction,
) => walk({ ...state, mushrooms: wither(state, sprung) }, to, height, direction)

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
    if (climbsLeft(state) === 0) return limitBlocked(state, direction, 'climbs')

    const climbing: GameState = { ...state, climbs: state.climbs + 1 }
    return arrive(climbing, to, direction, { type: 'climbed', from, to, via: 'ladder' })
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
  // 발판이 떠난 길 칸을 상자가 메우면 발판이 다시 지날 수 없다
  if (floor < 0 && onTramPath(state.stage, p)) return null
  if (
    hasBox(state, p) ||
    state.ladders.some((l) => same(l, p)) ||
    state.leaningLadders.some((l) => same(l, p)) ||
    same(p, state.stage.goal) ||
    isClosedDoor(state, p)
  )
    return null

  return floor
}

// 밀려 든 상자가 버섯에 튕겨 내려설 자리와 지나며 밟은 버섯들. 내릴 자리가 없으면 null
const hopBox = (
  state: GameState,
  from: Point,
  direction: Direction,
): { to: Point; floor: number; level: number; sprung: Point[] } | null => {
  const sprung: Point[] = []
  let at = from

  for (;;) {
    const level = floorAt(state, at) ?? 0
    const to = step(step(at, direction), direction)
    const floor = boxLanding(state, to, level)
    if (floor === null) return null

    sprung.push(at)
    if (!isMushroom(state, to)) return { to, floor, level, sprung }
    at = to
  }
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
  const first = step(box, direction)
  const entry = boxLanding(state, first, boxFloor)
  if (entry === null) return null

  // 버섯에 밀려 든 상자는 두 칸 날아가고 내릴 자리가 없으면 아예 안 밀린다
  const onMushroom = isMushroom(state, first)
  const flight = onMushroom ? hopBox(state, first, direction) : null
  if (onMushroom && flight === null) return null

  const target = flight?.to ?? first
  const landing = flight?.floor ?? entry
  const launch = flight?.level ?? boxFloor

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

  const stop = landed?.to ?? rest
  const sank = isSwamp(state, stop)
  if (sank) events.push({ type: 'sank', at: stop })

  const others = state.boxes.filter((b) => !same(b, box))
  const filled = landing < 0 ? target : landed?.result === 'filled' ? landed.to : null
  const fillHeight = landing < 0 ? launch : landing

  // 미끄러짐과 낙하까지 한 번의 밀기로 센다
  const pushing: GameState = {
    ...state,
    pushes: state.pushes + 1,
    mushrooms: wither(state, flight?.sprung ?? []),
  }
  const next: GameState = sank
    ? { ...pushing, boxes: others, swamps: state.swamps.filter((cell) => !same(cell, stop)) }
    : filled
      ? {
          ...pushing,
          boxes: others,
          heights: state.heights.map((row, y) =>
            y === filled.y ? row.map((h, x) => (x === filled.x ? fillHeight : h)) : row,
          ),
        }
      : { ...pushing, boxes: [...others, stop] }

  return walk(next, box, boxFloor, direction, events)
}

const moveOnce = (state: GameState, direction: Direction): MoveResult => {
  const blocked: MoveResult = { state, events: [{ type: 'blocked', direction }] }
  const from = state.player
  const to = step(from, direction)
  const fromHeight = standHeight(state, from)
  const toFloor = floorAt(state, to)

  // 버섯에 올라선 큐브는 튕겨 나가는 수밖에 없다
  if (isMushroom(state, from)) {
    const hopped = hop(state, from, direction)
    return hopped ? spring(state, hopped, direction) : blocked
  }

  if (toFloor === null || isClosedDoor(state, to)) return blocked

  if (!hasBox(state, to)) {
    if (toFloor <= fromHeight) {
      const hopped = isMushroom(state, to) ? hop(state, to, direction) : null
      return hopped ? spring(state, hopped, direction) : walk(state, to, toFloor, direction)
    }
    return climbOrPlaceLadder(state, to, direction) ?? blocked
  }

  if (toFloor + 1 <= fromHeight) return walk(state, to, toFloor + 1, direction)
  if (toFloor > fromHeight) return blocked

  const outOfPushes = pushesLeft(state) === 0
  const pushed = outOfPushes ? null : pushBox(state, to, direction)
  if (pushed) return pushed

  const pre: GameEvent[] = outOfPushes ? [{ type: 'limit', limit: 'pushes' }] : []
  if (climbsLeft(state) === 0) {
    const stopped = limitBlocked(state, direction, 'climbs')
    return { state, events: [...pre, ...stopped.events] }
  }

  const climbing: GameState = { ...state, climbs: state.climbs + 1 }
  return arrive(climbing, to, direction, { type: 'climbed', from, to, via: 'box' }, pre)
}

// 칸을 딛고 있는 것. 상자 위에 선 큐브는 칸을 딛지 않는다
const restingOn = (state: GameState, p: Point) =>
  hasBox(state, p) ? 'box' : same(state.player, p) ? 'player' : null

// 기대 놓은 사다리는 발을 딛고 서 있어 그 칸이 다 닳아도 무너지지 않는다. 사다리가 허공에 남지 않는다
const holdsLadder = (state: GameState, p: Point) => state.leaningLadders.some((l) => same(l, p))

// 딛고 있던 것이 바뀐 무너지는 칸의 남은 횟수를 줄인다. 다 쓰고 비면 바닥 없는 칸이 된다
const crumble = (before: GameState, after: GameState): MoveResult => {
  if (after.cracks.length === 0) return { state: after, events: [] }

  const events: GameEvent[] = []
  const heights = [...after.heights]

  const cracks = after.cracks.map((crack) => {
    const was = restingOn(before, crack)
    const now = restingOn(after, crack)
    if (crack.left < 0 || was === null || was === now) return crack

    const left = Math.max(crack.left - 1, 0)
    const gone = left === 0 && now === null && !holdsLadder(after, crack)
    const { x, y } = crack
    events.push({ type: 'cracked', at: { x, y }, left, gone })
    if (gone) heights[y] = heights[y].map((h, i) => (i === x ? -1 : h))

    return { x, y, left: gone ? -1 : left }
  })

  if (events.length === 0) return { state: after, events }
  return { state: { ...after, cracks, heights }, events }
}

// 이동 한 번마다 발판이 길을 한 칸 가고 끝에 닿으면 방향을 뒤집는다. 위에 있던 큐브와 상자는 같이 간다
// 발판이 다음 수에 갈 자리. 길 끝에 닿아 있으면 방향을 뒤집는다
export const nextTramSpot = (cells: Point[], spot: TramSpot): TramSpot => {
  const ahead = spot.at + spot.dir
  const dir = ahead < 0 || ahead >= cells.length ? ((spot.dir * -1) as 1 | -1) : spot.dir
  return { id: spot.id, at: spot.at + dir, dir }
}

const rideTrams = (state: GameState): MoveResult => {
  if (state.trams.length === 0) return { state, events: [] }

  const events: GameEvent[] = []
  const list = trams(state.stage)
  let player = state.player
  let boxes = state.boxes

  const moved = state.trams.map((spot, i) => {
    const { cells } = list[i]
    const next = nextTramSpot(cells, spot)
    const from = { x: cells[spot.at].x, y: cells[spot.at].y }
    const to = { x: cells[next.at].x, y: cells[next.at].y }

    events.push({ type: 'tram', id: spot.id, from, to })
    if (same(player, from)) player = to
    boxes = boxes.map((box) => (same(box, from) ? to : box))

    return next
  })

  return { state: { ...state, player, boxes, trams: moved }, events }
}

// 다른 발판에 내려선 이동이면 새로 탄 것으로 센다. 타고 실려 가는 동안은 자리가 그대로라 세지 않는다
const boardsTram = (before: GameState, after: GameState) => {
  const to = tramAt(after, after.player)
  return to !== null && to !== tramAt(before, before.player)
}

// 이동으로 센 수마다 무너지는 칸이 닳고 발판이 한 칸 가고 문과 엘리베이터 발판이 따라 바뀐다
const tick = (before: GameState, after: GameState, events: GameEvent[]): MoveResult => {
  const { state: crumbled, events: crackEvents } = crumble(before, after)
  const { state: moved, events: tramEvents } = rideTrams(crumbled)

  const doorEvents: GameEvent[] = doors(before.stage)
    .map((door) => ({
      id: door.id,
      before: isDoorOpen(before, door.id),
      after: isDoorOpen(moved, door.id),
    }))
    .filter((change) => change.before !== change.after)
    .map(({ id, after: open }) => ({ type: 'door', id, open }))

  const liftEvents: GameEvent[] = lifts(before.stage)
    .filter((lift) => isLiftRaised(before, lift.id) !== isLiftRaised(moved, lift.id))
    .map((lift) => ({ type: 'lift', id: lift.id, up: isLiftRaised(moved, lift.id) }))

  return {
    state: moved,
    events: [
      ...events,
      ...crackEvents,
      ...tramEvents,
      ...doorEvents,
      ...liftEvents,
      ...(moved.cleared ? [{ type: 'cleared' } as const] : []),
    ],
  }
}

export const move = (state: GameState, direction: Direction): MoveResult => {
  if (state.cleared) return { state, events: [] }
  if (movesLeft(state) === 0) return limitBlocked(state, direction, 'moves')

  // 버둥은 방향이 없는 수라 방향 제한을 보지 않고 상자와 사다리도 건드리지 않는다
  if (struggling(state)) {
    const struggled: GameState = {
      ...state,
      moves: state.moves + 1,
      struggles: state.struggles + 1,
    }
    return tick(state, struggled, [{ type: 'struggled', at: state.player }])
  }

  const limitedDir = state.stage.rules?.dirLimit?.dir === direction
  if (limitedDir && dirLeft(state) === 0) return limitBlocked(state, direction, 'dir')

  const result = moveOnce(state, direction)
  // 타는 횟수를 다 쓰면 올라타는 이동만 막는다
  const boarded = boardsTram(state, result.state)
  if (boarded && ridesLeft(state) === 0) return limitBlocked(state, direction, 'rides')

  // 발판 위에서 막힌 이동은 타고 가겠다는 뜻이고 발판 길 쪽으로 막힌 이동은 기다리겠다는 뜻이라 제자리에 서서 이동 1회로 센다
  const forTram =
    result.state === state &&
    (tramLevelAt(state, state.player) !== null ||
      onTramPath(state.stage, step(state.player, direction)))
  if (result.state === state && !forTram) return result

  const acted: MoveResult = forTram
    ? { state: { ...state, moves: state.moves + 1 }, events: [] }
    : boarded
      ? { ...result, state: { ...result.state, rides: result.state.rides + 1 } }
      : result

  // 이동 수로 세는 수면 그 방향을 쓴 것이다
  const spent: GameState = limitedDir
    ? { ...acted.state, dirUses: acted.state.dirUses + 1 }
    : acted.state

  return tick(state, spent, acted.events)
}
