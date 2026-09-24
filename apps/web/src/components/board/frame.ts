import { STRUGGLES, isLiftRaised, standHeight } from '@/game/rules'
import type { Direction, Entity, GameEvent, GameState, Point, Stage } from '@/game/types'

const SECONDS = {
  moved: 0.24,
  pushed: 0.26,
  fell: 0.32,
  climbed: 0.3,
  blocked: 0.2,
  placed: 0.22,
  tram: 0.24,
}
// 미끄러짐은 칸 수에 상관없이 속도가 같아야 상자와 큐브가 나란히 간다. max는 아주 긴 미끄러짐만 잡는다
const SLIDE = { perCell: 0.1, max: 0.9 }
const TILT = 0.24

// 짝 칸으로 가라앉는 시간, 짝인 칸에서 솟아오르는 시간, 잠기는 층 수
const WARP = { sink: 0.2, rise: 0.2, depth: 0.6 }

// 늪에 가라앉고 버둥거리고 뽑혀 나오는 시간, 밀려 들어간 상자가 잠기는 시간
// over는 버둥에 그 수의 자리보다 더 솟는 몫으로 제일 깊은 곳에서 마지막 버둥까지가 7px이라 3px 솟는다
// peak는 솟는 데 쓰는 몫, fill은 잠긴 상자 위로 땅이 드러나는 지점
// lead는 상자가 칸에 닿기 전에 미리 가라앉는 시간으로 닿는 순간 이미 진흙에 밀려 들어가 보인다
const SWAMP = {
  sink: 0.28,
  struggle: 0.3,
  rise: 0.2,
  box: 0.36,
  lead: 0.09,
  over: 0.4285,
  peak: 0.42,
  fill: 0.5,
}

const easeIn = (t: number) => t * t
const easeOut = (t: number) => 1 - (1 - t) ** 2
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

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

// 기다리는 구간이 섞일 수 있어 길이를 이벤트와 따로 둔다
interface Segment {
  event: PathEvent
  seconds: number
}

const segmentsOf = (path: PathEvent[]): Segment[] =>
  path.map((event) => ({ event, seconds: secondsOf(event) }))

const totalSeconds = (segments: Segment[]) => segments.reduce((sum, s) => sum + s.seconds, 0)

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

const same = (a: Point, b: Point) => a.x === b.x && a.y === b.y

// 상자가 멈추면서 그 칸을 메우거나 아래층으로 떨어지는 마지막 구간
const boxLanding = (events: GameEvent[]) => {
  const landing = boxPath(events).at(-1)
  return landing?.type === 'pushed' && landing.result !== 'slid' ? landing : null
}

// 큐브가 가는 마지막 한 칸. 여러 칸 미끄러졌으면 그 앞에서 끊는다
const lastTile = (event: PathEvent): { before: PathEvent | null; tile: PathEvent } => {
  const cells = Math.abs(event.to.x - event.from.x) + Math.abs(event.to.y - event.from.y)
  if (event.type !== 'slid' || cells < 2) return { before: null, tile: event }

  const edge = {
    x: event.to.x - Math.sign(event.to.x - event.from.x),
    y: event.to.y - Math.sign(event.to.y - event.from.y),
  }
  return { before: { ...event, to: edge }, tile: { ...event, from: edge } }
}

// 상자가 메우는 중인 칸에 큐브가 올라서면 빈 공간 위에 뜬다. 멈춰 세우면 걸리는 느낌이 나서 다가가는 속도만 늦춘다
const playerSegments = (events: GameEvent[]): Segment[] => {
  const path = playerPath(events)
  const landing = boxLanding(events)
  const last = path.at(-1)
  if (!landing || !last || !same(last.to, landing.to)) return segmentsOf(path)

  const { before, tile } = lastTile(last)
  const approach = segmentsOf([...path.slice(0, -1), ...(before ? [before] : [])])
  const reach = totalSeconds(approach)
  const settle = totalSeconds(segmentsOf(boxPath(events)))
  const slower = reach > 0 && settle > reach ? settle / reach : 1

  return [...approach.map((s) => ({ ...s, seconds: s.seconds * slower })), ...segmentsOf([tile])]
}

// 칸이 아주 무너지는 순간만 이동보다 길게 둔다. 한 단계 닳는 변화는 이동 길이에 맞춰 끝난다
const CRUMBLE_SECONDS = 0.36

// 미끄러져 지나온 칸에 남는 서리 자국이 옅어지는 시간
const FROST_FADE = 0.2

interface Stamp {
  p: Point
  at: number // 미끄러지며 그 칸을 떠난 시각
}

// 미끄러짐이 멈추는 칸은 그 위에 큐브나 상자가 서 있어 자국을 두지 않는다
const slideStamps = (segments: Segment[]): Stamp[] => {
  const stamps: Stamp[] = []
  let start = 0
  for (const { event, seconds } of segments) {
    if (event.type === 'slid') {
      const cells = Math.abs(event.to.x - event.from.x) + Math.abs(event.to.y - event.from.y)
      const step = {
        x: (event.to.x - event.from.x) / cells,
        y: (event.to.y - event.from.y) / cells,
      }
      for (let i = 0; i < cells; i += 1) {
        stamps.push({
          p: { x: event.from.x + step.x * i, y: event.from.y + step.y * i },
          at: start + (seconds * i) / cells,
        })
      }
    }
    start += seconds
  }
  return stamps
}

const frostStamps = (events: GameEvent[]) => [
  ...slideStamps(playerSegments(events)),
  ...slideStamps(segmentsOf(boxPath(events))),
]

// 큐브나 상자가 그 칸에 닿는 시각과 그 칸을 떠나는 시각
const touchAt = (events: GameEvent[], p: Point) => {
  let arrive: number | null = null
  let leave: number | null = null
  for (const segments of [playerSegments(events), segmentsOf(boxPath(events))]) {
    let start = 0
    for (const { event, seconds } of segments) {
      if (leave === null && same(event.from, p)) leave = start
      if (same(event.to, p)) arrive = start + seconds
      start += seconds
    }
  }
  return { arrive, leave }
}

// 스위치가 눌리거나 풀린 뒤 문과 발판이 따라 움직이는 시간
const SWITCH_SECONDS = 0.16

// 눌림은 구간 끝에서, 풀림은 구간 시작에서 일어난다. 가장 늦은 때에 맞춰 연출할 시간을 남긴다
const switchEnd = (events: GameEvent[]) => {
  const linked = events.filter(
    (e): e is Extract<GameEvent, { type: 'door' | 'lift' }> =>
      e.type === 'door' || e.type === 'lift',
  )
  if (linked.length === 0) return 0

  const pressed = linked.some((e) => (e.type === 'door' ? e.open : e.up))
  const latest = (segments: Segment[]) =>
    totalSeconds(segments) - (pressed ? 0 : (segments.at(-1)?.seconds ?? 0))

  return (
    Math.max(latest(playerSegments(events)), latest(segmentsOf(boxPath(events)))) + SWITCH_SECONDS
  )
}

// 들고 있던 사다리가 손으로 옮겨지는 시간
const LADDER_SECONDS = 0.16

// 큐브가 사다리 칸에 닿는 시각. 이 이동에서 집지 않으면 null
const pickUpAt = (events: GameEvent[]) => {
  const picked = events.find((e) => e.type === 'pickedUp')
  return picked?.type === 'pickedUp' ? touchAt(events, picked.at).arrive : null
}

const pickUpEnd = (events: GameEvent[]) => {
  const at = pickUpAt(events)
  return at === null ? 0 : at + LADDER_SECONDS
}

// 큐브가 짝 칸에 닿는 시각. 이 이동에서 순간이동하지 않으면 null
const warpAt = (events: GameEvent[]) => {
  const warped = events.find((e) => e.type === 'warped')
  return warped?.type === 'warped' ? touchAt(events, warped.from).arrive : null
}

const warpEnd = (events: GameEvent[]) => {
  const at = warpAt(events)
  return at === null ? 0 : at + WARP.sink + WARP.rise
}

type TramEvent = Extract<GameEvent, { type: 'tram' }>

const tramMoves = (events: GameEvent[]) => events.filter((e): e is TramEvent => e.type === 'tram')

// 이 이동에서 큐브나 상자가 새로 올라선 발판이 있는지
const boarded = (events: GameEvent[]) => {
  const warped = events.find((e) => e.type === 'warped')
  const arrivals = [
    playerPath(events).at(-1)?.to,
    boxPath(events).at(-1)?.to,
    warped?.type === 'warped' ? warped.to : undefined,
  ]
  return arrivals.some(
    (at) => at !== undefined && tramMoves(events).some((tram) => same(tram.from, at)),
  )
}

// 발판이 출발하는 시각. 새로 올라타는 것이 있는 이동에서만 그것이 자리에 앉기를 기다린다
const tramStart = (events: GameEvent[]) => {
  if (tramMoves(events).length === 0) return null
  if (!boarded(events)) return 0

  return Math.max(
    totalSeconds(playerSegments(events)),
    totalSeconds(segmentsOf(boxPath(events))),
    warpEnd(events),
  )
}

const tramEnd = (events: GameEvent[]) => {
  const at = tramStart(events)
  return at === null ? 0 : at + SECONDS.tram
}

// 늪 연출에 더 드는 시간. lead는 이동 앞쪽, tail은 뒤쪽에 붙는다
export interface SwampTime {
  lead: number // 뽑혀 나오기를 기다리는 시간
  tail: number // 가라앉기를 기다리는 시간
}

const NO_SWAMP: SwampTime = { lead: 0, tail: 0 }

const inSwamp = (state: GameState, p: Point) => state.swamps.some((cell) => same(cell, p))

// 늪에 빠지거나 늪에서 나오는 이동에 더 드는 시간. 제자리에 선 이동은 버둥이라 길이를 따로 둔다
export const swampTime = (prev: GameState | null, game: GameState): SwampTime => {
  if (!prev || same(prev.player, game.player)) return NO_SWAMP

  return {
    lead: inSwamp(prev, prev.player) ? SWAMP.rise : 0,
    tail: inSwamp(game, game.player) ? SWAMP.sink : 0,
  }
}

// 늪에 밀려 들어간 상자가 다 잠기는 시각. 밀기가 끝나기 전부터 가라앉아 진흙에 밀려 들어가 보인다
const sinkEnd = (events: GameEvent[]) =>
  events.some((e) => e.type === 'sank')
    ? totalSeconds(segmentsOf(boxPath(events))) - SWAMP.lead + SWAMP.box
    : 0

export const durationOf = (events: GameEvent[], swamp: SwampTime = NO_SWAMP) =>
  swamp.lead +
  Math.max(
    0,
    totalSeconds(playerSegments(events)) + swamp.tail,
    totalSeconds(segmentsOf(boxPath(events))),
    switchEnd(events),
    pickUpEnd(events),
    warpEnd(events),
    tramEnd(events),
    sinkEnd(events),
    ...events.map((e) => (e.type === 'blocked' || e.type === 'placed' ? SECONDS[e.type] : 0)),
    ...events.map((e) => (e.type === 'cracked' && e.gone ? CRUMBLE_SECONDS : 0)),
    ...events.map((e) => (e.type === 'struggled' ? SWAMP.struggle : 0)),
    ...frostStamps(events).map((stamp) => stamp.at + FROST_FADE),
  )

// 이동이 시작한 뒤로 흐른 시간. 늪에서 뽑혀 나오기를 기다리는 동안은 0보다 작다
const elapsedAt = (events: GameEvent[], swamp: SwampTime, t: number) =>
  t * durationOf(events, swamp) - swamp.lead

// cells 중 한 칸이 pressed 상태가 되는 시각. 이 이동에서 닿지 않는 칸뿐이면 null
const pressedAt = (events: GameEvent[], cells: Point[], pressed: boolean) => {
  const times = cells
    .map((p) => (pressed ? touchAt(events, p).arrive : touchAt(events, p).leave))
    .filter((at): at is number => at !== null)

  return times.length === 0 ? null : Math.min(...times)
}

// 스위치와 엮인 문과 발판의 진행도 0~1. 눌림이 바뀌지 않는 이동은 이동 전체에 걸쳐 섞는다
export const switchProgress = (
  events: GameEvent[],
  cells: Point[],
  pressed: boolean,
  t: number,
  swamp: SwampTime = NO_SWAMP,
) => {
  const at = pressedAt(events, cells, pressed)
  return at === null
    ? t
    : Math.min(1, Math.max(0, (elapsedAt(events, swamp, t) - at) / SWITCH_SECONDS))
}

// 스위치 자신이 눌리고 풀리는 시간. 닿아서 생기는 일이라 멀리 있는 문과 발판보다 짧다
const PRESS_SECONDS = 0.06

// 스위치는 접촉이 바뀌는 순간에 맞춘다. 눌림은 닿는 때에 끝나고 풀림은 떠나는 때에 시작한다
export const pressProgress = (
  events: GameEvent[],
  p: Point,
  pressed: boolean,
  t: number,
  swamp: SwampTime = NO_SWAMP,
) => {
  const { arrive, leave } = touchAt(events, p)
  const at = pressed ? arrive : leave
  if (at === null) return t

  const start = pressed ? at - PRESS_SECONDS : at
  return Math.min(1, Math.max(0, (elapsedAt(events, swamp, t) - start) / PRESS_SECONDS))
}

// 사다리를 집어 드는 진행도 0~1. 집지 않는 이동은 이동 전체에 걸쳐 섞는다
export const pickUpProgress = (events: GameEvent[], t: number, swamp: SwampTime = NO_SWAMP) => {
  const at = pickUpAt(events)
  return at === null
    ? t
    : Math.min(1, Math.max(0, (elapsedAt(events, swamp, t) - at) / LADDER_SECONDS))
}

// 발판이 다음 칸으로 가는 진행도 0~1. 발판이 가지 않는 이동은 1
export const tramProgress = (events: GameEvent[], t: number, swamp: SwampTime = NO_SWAMP) => {
  const at = tramStart(events)
  if (at === null) return 1

  return Math.min(1, Math.max(0, (elapsedAt(events, swamp, t) - at) / SECONDS.tram))
}

export const switchCells = (stage: Stage, target: string): Point[] =>
  stage.entities.filter((e) => e.type === 'switch' && e.target === target)

// 칸 하나의 자국 진하기 0~1. 겹치면 진한 쪽을 쓴다
export const frostAt = (events: GameEvent[], p: Point, t: number, swamp: SwampTime = NO_SWAMP) => {
  if (!events.some((e) => e.type === 'slid')) return 0

  const elapsed = elapsedAt(events, swamp, t)
  return frostStamps(events)
    .filter((stamp) => same(stamp.p, p))
    .reduce(
      (deepest, stamp) =>
        Math.max(deepest, elapsed < stamp.at ? 0 : 1 - (elapsed - stamp.at) / FROST_FADE),
      0,
    )
}

// 빠진 큐브가 잠기는 깊이와 둘레에 걸리는 진흙 테. 제일 깊은 자리에서 마지막 버둥 자리까지다
const MUD_SINK = { deepest: 13, risen: 6 }
const MUD_COLLAR = { deepest: 0.72, risen: 0.66 }

export const swampSink = (risen: number) => lerp(MUD_SINK.deepest, MUD_SINK.risen, risen)

export const swampCollar = (risen: number) => lerp(MUD_COLLAR.deepest, MUD_COLLAR.risen, risen)

// 깊어지는 늪은 빠진 횟수만큼 버둥이 는다
const strugglesFor = (state: GameState) =>
  state.stage.rules?.swampDeepen ? STRUGGLES + state.sinks - 1 : STRUGGLES

// 버둥을 몇 수 하든 마지막 버둥에서 1이 되게 고르게 올라온다
const risenIn = (state: GameState) => state.struggles / strugglesFor(state)

// 버둥은 다음 자리보다 살짝 더 솟았다가 도로 잠긴다
const struggleRise = (from: number, to: number, p: number) =>
  p < SWAMP.peak
    ? lerp(from, to + SWAMP.over, easeOut(p / SWAMP.peak))
    : lerp(to + SWAMP.over, to, moveEase((p - SWAMP.peak) / (1 - SWAMP.peak), NO_CHAIN))

export interface SwampFrame {
  cell: Point // 잠긴 칸
  risen: number // 올라온 정도. 0이면 제일 깊고 1이면 마지막 버둥 자리다
  deep: number // 잠긴 정도 0~1
}

// 늪에 잠긴 큐브의 깊이. 잠긴 큐브가 없으면 null
export const swampFrame = (
  prev: GameState | null,
  game: GameState,
  events: GameEvent[],
  t: number,
): SwampFrame | null => {
  const swamp = swampTime(prev, game)
  const elapsed = elapsedAt(events, swamp, t)

  // 나오는 이동은 걷기 전에 뽑혀 올라오고 다 올라오면 늪을 벗어난 것이다
  if (prev && elapsed < 0) {
    const p = clamp01((elapsed + swamp.lead) / swamp.lead)
    return { cell: prev.player, risen: risenIn(prev), deep: 1 - easeIn(p) }
  }
  if (!inSwamp(game, game.player)) return null

  // 들어가는 이동은 큐브가 칸에 닿은 뒤부터 가라앉는다
  if (swamp.tail > 0) {
    const walked = totalSeconds(playerSegments(events))
    return {
      cell: game.player,
      risen: risenIn(game),
      deep: easeIn(clamp01((elapsed - walked) / swamp.tail)),
    }
  }
  if (prev && events.some((e) => e.type === 'struggled')) {
    const p = clamp01(elapsed / SWAMP.struggle)
    return {
      cell: game.player,
      risen: struggleRise(risenIn(prev), risenIn(game), p),
      deep: 1,
    }
  }

  return { cell: game.player, risen: risenIn(game), deep: 1 }
}

export interface BoxSinkFrame {
  at: Point // 상자가 가라앉는 칸
  deep: number // 잠긴 정도 0~1
  filled: number // 메운 자리가 드러난 정도 0~1
}

// 늪에 밀려 들어간 상자가 잠기는 정도. 가라앉는 상자가 없으면 null
export const boxSink = (events: GameEvent[], swamp: SwampTime, t: number): BoxSinkFrame | null => {
  const sank = events.find((e) => e.type === 'sank')
  if (sank?.type !== 'sank') return null

  // 다 잠기는 때에서 거꾸로 세야 연출이 끝나는 프레임에서 꼭 1이 된다
  const p = clamp01(1 - (sinkEnd(events) - elapsedAt(events, swamp, t)) / SWAMP.box)

  return { at: sank.at, deep: easeIn(p), filled: clamp01((p - SWAMP.fill) / (1 - SWAMP.fill)) }
}

// 미끄러져 멈춘 이동은 다음 입력과 이어 붙이지 않는다
const slideChain = (events: GameEvent[], chain: Chain): Chain =>
  events.some((e) => e.type === 'slid') ? { in: chain.in, out: false } : chain

interface Step {
  event: PathEvent
  index: number
  p: number
}

// 경과 시간이 들어 있는 구간. 큐브와 상자가 각자 제 길이에 맞춰 늘어나 한 이동 안에서 같이 끝난다
const stepAt = (segments: Segment[], seconds: number, chain: Chain): Step | null => {
  let start = 0
  for (const [index, { event, seconds: span }] of segments.entries()) {
    const last = index === segments.length - 1
    if (seconds < start + span || last) {
      const local = span === 0 ? 1 : Math.min(1, Math.max(0, (seconds - start) / span))
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

// 미끄러짐 전체를 하나로 보고 앞에서 눌렸다가 뒤에서 풀린다. 이어진 구간 사이에서 풀리면 끊겨 보인다
const SQUASH = { rise: 0.15, fall: 0.25 }

const squashAt = (q: number) =>
  q <= 0 || q >= 1
    ? 0
    : q < SQUASH.rise
      ? easeOut(q / SQUASH.rise)
      : Math.min(1, easeIn((1 - q) / SQUASH.fall))

// 이어지는 미끄러짐 구간 전체의 시작과 끝 시각
const slideSpan = (segments: Segment[]) => {
  let start = 0
  let from = -1
  let to = -1
  for (const { event, seconds } of segments) {
    if (event.type === 'slid') {
      if (from < 0) from = start
      to = start + seconds
    }
    start += seconds
  }
  return from < 0 ? null : { from, to }
}

export interface CubeFrame {
  x: number
  y: number
  level: number
  direction: Direction
  angle: number
  cell: Point // 그리기 순서를 맞출 칸
  squash: number // 진행 방향으로 눌린 정도. 0이면 평소 모양
  fade: number // 진하기. 1이면 평소, 0이면 안 보임
}

const levelAfter = (level: number, event: PathEvent) =>
  event.type === 'fell' ? level - event.drop : event.type === 'climbed' ? level + 1 : level

// 앞쪽 칸에 그려야 뒤쪽 칸 블록에 덮이지 않는다
const frontOf = (a: Point, b: Point) => (a.x + a.y >= b.x + b.y ? a : b)

// 발판과 그 위에 탄 것이 같은 칸에 그려져야 서로 덮이는 순서가 맞는다
export const slidingCell = (from: Point, to: Point, p: number) =>
  p <= 0 ? from : p >= 1 ? to : frontOf(from, to)

// at 칸을 실어 옮기는 발판, 없으면 null
const carryOf = (events: GameEvent[], at: Point | null) =>
  at === null ? null : (tramMoves(events).find((tram) => same(tram.from, at)) ?? null)

// 발판에 실려 간 칸 거리
const carriedBy = (carry: TramEvent, p: number) => ({
  x: (carry.to.x - carry.from.x) * p,
  y: (carry.to.y - carry.from.y) * p,
})

// 그 칸의 발판이 오르내리는 진행도. 발판 칸이 아니면 이동 전체에 걸쳐 섞는다
const ridePhase = (game: GameState, events: GameEvent[], p: Point, t: number, swamp: SwampTime) => {
  const lift = game.stage.entities.find(
    (e): e is Extract<Entity, { type: 'lift' }> => e.type === 'lift' && same(e, p),
  )
  return lift === undefined
    ? t
    : switchProgress(
        events,
        switchCells(game.stage, lift.id),
        isLiftRaised(game, lift.id),
        t,
        swamp,
      )
}

// 큐브가 제 힘으로 간 몫만 그린 프레임. 발판에 실린 몫은 playerFrame이 더한다
const pathFrame = (
  prev: GameState | null,
  game: GameState,
  events: GameEvent[],
  t: number,
  chain: Chain,
): CubeFrame => {
  const { player } = game
  const endLevel = standHeight(game, player)
  const still = {
    ...player,
    level: endLevel,
    direction: 'right' as Direction,
    angle: 0,
    cell: player,
    squash: 0,
    fade: 1,
  }
  if (t >= 1) return still

  const segments = playerSegments(events)
  const startLevel = prev ? standHeight(prev, prev.player) : endLevel
  const pathLevel = segments.reduce((level, s) => levelAfter(level, s.event), startLevel)
  const swamp = swampTime(prev, game)
  // 이동 경로로 설명되지 않는 높이 차이는 발판이 오르내린 몫이라 칸과 같은 속도로 따라간다
  const riding = (endLevel - pathLevel) * ridePhase(game, events, player, t, swamp)
  // 연출이 이동보다 길 수 있어 큐브는 제 길을 다 가면 그 자리에서 기다린다
  const elapsed = elapsedAt(events, swamp, t)

  const warped = events.find((e) => e.type === 'warped')
  const warpStart = warpAt(events)
  // 순간이동은 길을 다 간 뒤에 일어나서 가라앉는 동안 들어간 칸에, 솟는 동안 나온 칸에 그린다
  if (warped?.type === 'warped' && warpStart !== null && elapsed >= warpStart) {
    const sinking = elapsed < warpStart + WARP.sink
    const p = sinking
      ? (elapsed - warpStart) / WARP.sink
      : Math.min(1, (elapsed - warpStart - WARP.sink) / WARP.rise)
    const cell = sinking ? warped.from : warped.to
    const last = segments.at(-1)
    // 들어갈 때는 점점 빨라지고 나올 때는 점점 느려져야 이동과 이어진다
    const deep = sinking ? easeIn(p) : 1 - easeOut(p)

    return {
      ...cell,
      level: (sinking ? pathLevel + riding : endLevel) - WARP.depth * deep,
      direction: last ? directionBetween(last.event.from, last.event.to) : still.direction,
      angle: 0,
      cell,
      squash: 0,
      fade: 1 - deep,
    }
  }

  // 늪에 가라앉는 동안은 걸음이 끝나 들어간 칸에 서 있다. 그 칸에 그려야 진흙에 가려진다
  if (swamp.tail > 0 && elapsed >= totalSeconds(segments)) return still

  // 늪에서 뽑혀 나오기를 기다리는 동안은 떠나기 전 칸에 그대로 선다
  const step = elapsed < 0 ? null : stepAt(segments, elapsed, slideChain(events, chain))
  if (prev && step) {
    const span = slideSpan(segments)
    const { event, index, p } = step
    const fromLevel = segments
      .slice(0, index)
      .reduce((level, s) => levelAfter(level, s.event), startLevel)
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
      level: level + riding,
      direction: directionBetween(event.from, event.to),
      // 얼음 위에서는 구르지 않고 그대로 미끄러진다
      angle: event.type === 'slid' ? 0 : (Math.PI / 2) * p,
      cell: frontOf(event.from, event.to),
      squash: span ? squashAt((elapsed - span.from) / (span.to - span.from)) : 0,
      fade: 1,
    }
  }

  const blocked = events.find((e) => e.type === 'blocked')
  if (blocked?.type === 'blocked') {
    return { ...still, direction: blocked.direction, angle: Math.sin(Math.PI * t) * TILT }
  }

  // 제 힘으로 가지 않은 이동은 떠나기 전 칸에 서 있는다
  const hold = prev ? prev.player : player
  return { ...still, x: hold.x, y: hold.y, cell: hold, level: startLevel + riding }
}

export const playerFrame = (
  prev: GameState | null,
  game: GameState,
  events: GameEvent[],
  t: number,
  chain: Chain = NO_CHAIN,
): CubeFrame => {
  const frame = pathFrame(prev, game, events, t, chain)
  const warped = events.find((e) => e.type === 'warped')
  // 큐브가 제 길을 다 가고 선 칸. 그 자리가 발판이면 이어서 실려 간다
  const rest =
    warped?.type === 'warped' ? warped.to : (playerPath(events).at(-1)?.to ?? prev?.player ?? null)
  const carry = prev && t < 1 ? carryOf(events, rest) : null
  if (carry === null) return frame

  const p = tramProgress(events, t, swampTime(prev, game))
  const shift = carriedBy(carry, p)

  return {
    ...frame,
    x: frame.x + shift.x,
    y: frame.y + shift.y,
    cell: p <= 0 ? frame.cell : slidingCell(carry.from, carry.to, p),
  }
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
  game: GameState,
  events: GameEvent[],
  t: number,
  chain: Chain = NO_CHAIN,
): BoxFrame | null => {
  const path = boxPath(events)
  const segments = segmentsOf(path)
  const swamp = swampTime(prev, game)
  // 상자가 제자리에 앉으면 바로 사라져 메운 바닥이 드러난다. 큐브는 그 뒤에 그 칸으로 간다
  const elapsed = elapsedAt(events, swamp, t)
  const carry = carryOf(events, path.at(-1)?.to ?? null)
  const ride = carry === null ? 0 : tramProgress(events, t, swamp)
  const settled = elapsed >= totalSeconds(segments) && (carry === null || ride >= 1)
  // 늪에 밀려 들어간 상자는 밀기가 끝난 자리에서 다 잠길 때까지 남는다
  const sinking = boxSink(events, swamp, t)
  if (!prev || (settled && (sinking === null || sinking.deep >= 1))) return null

  const step = stepAt(segments, elapsed, slideChain(events, chain))
  if (!step) return null

  const { event, index, p } = step
  const to = carry ? carry.to : path[path.length - 1].to
  // 발판이나 올라간 승강 발판 위의 상자는 칸 높이가 아니라 딛고 선 높이에서 출발한다
  const start = standHeight(prev, path[0].from) - 1
  const fromLevel = path
    .slice(0, index)
    .reduce((level, passed) => boxLevelAfter(prev, level, passed), start)
  const toLevel = boxLevelAfter(prev, fromLevel, event)
  const level =
    event.type === 'slid' || p < 0.6 ? fromLevel : lerp(fromLevel, toLevel, easeIn((p - 0.6) / 0.4))
  // 도착 칸에 서는 높이에서 상자 한 층을 뺀 값이 상자가 앉을 높이다. 발판이 오르내린 몫이 여기서 드러난다
  const endLevel = path.reduce((level, passed) => boxLevelAfter(prev, level, passed), start)
  const riding = (standHeight(game, to) - 1 - endLevel) * ridePhase(game, events, to, t, swamp)
  const shift = carry ? carriedBy(carry, ride) : { x: 0, y: 0 }

  return {
    x: lerp(event.from.x, event.to.x, p) + shift.x,
    y: lerp(event.from.y, event.to.y, p) + shift.y,
    level: level + riding,
    to,
    // 잠기는 상자는 멈춘 자리에 있어 그 칸에 그려야 진흙에 가려진다
    cell:
      sinking && settled
        ? to
        : carry && ride > 0
          ? slidingCell(carry.from, carry.to, ride)
          : frontOf(event.from, event.to),
  }
}

// 단계가 오르는 앞부분과 가라앉아 사라지는 뒷부분. 가라앉음은 이동 연출을 거의 다 쓴다
const CRUMBLE = { deepen: 0.9, fallFrom: 0.12, drop: 1.6, shadow: 0.9 }

// 닳은 단계마다의 내려앉은 화면 거리와 옆면 두께
const CRACK_SINK = [0, 8, 15]
const CRACK_THICKNESS = [13, 9, 5]

export interface CrackFrame {
  stage: number // 닳은 단계 0~2. 오를수록 얇아지고 내려앉는다
  broken: number // 네 조각으로 갈라져 벌어진 정도. 무너질 때만 0을 넘는다
  fall: number // 아래로 내려간 층 수
  opacity: number
  shadow: number // 무너진 자리에 깔리는 그림자 진하기
}

// left는 앞으로 견디는 횟수. -1은 바닥 없는 칸이다
const stageOf = (left: number) => (left > 1 ? 0 : left === 1 ? 1 : 2)

// 단계 사이 값은 앞뒤 단계를 섞는다
export const atStage = (steps: number[], stage: number) => {
  const i = Math.min(steps.length - 2, Math.max(0, Math.floor(stage)))
  return lerp(steps[i], steps[i + 1], stage - i)
}

export const crackSink = (stage: number) => atStage(CRACK_SINK, stage)

export const crackThickness = (stage: number) => atStage(CRACK_THICKNESS, stage)

// before와 after는 이동 앞뒤의 left
export const crackFrame = (before: number, after: number, t: number): CrackFrame => {
  const stage = lerp(stageOf(before), stageOf(after), easeOut(Math.min(1, t / CRUMBLE.deepen)))
  const falling = before >= 0 && after < 0
  const p = falling ? Math.min(1, Math.max(0, (t - CRUMBLE.fallFrom) / (1 - CRUMBLE.fallFrom))) : 0

  return {
    stage,
    // 갈라짐은 초반에 거의 다 벌어지고 그 뒤로는 떨어지기만 한다
    broken: falling ? easeOut(Math.min(1, p / 0.45)) : 0,
    fall: CRUMBLE.drop * easeIn(p),
    opacity: 1 - p * p,
    shadow: CRUMBLE.shadow * easeOut(p) * (1 - p ** 4),
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
