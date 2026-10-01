import { type TopTilt, tiltOnTop } from './cube'
import { TILE, isoDelta, toScreen } from '@/game/iso'
import {
  STRUGGLES,
  isLiftRaised,
  nextTramSpot,
  readMushrooms,
  standHeight,
  windLeft,
} from '@/game/rules'
import type {
  Direction,
  Entity,
  GameEvent,
  GameState,
  Lifted,
  Point,
  Stage,
  TramSpot,
  VineSpot,
} from '@/game/types'

const SECONDS = {
  moved: 0.24,
  pushed: 0.26,
  filled: 0.34, // 상자가 구덩이를 메우는 밀기. 가라앉는 몫이 있어 보통 밀기보다 길다
  fell: 0.32,
  climbed: 0.3,
  blocked: 0.2,
  placed: 0.22,
  planted: 0.44,
  tram: 0.24,
}
// 미끄러짐은 칸 수에 상관없이 속도가 같아야 상자와 큐브가 나란히 간다. max는 아주 긴 미끄러짐만 잡는다
const SLIDE = { perCell: 0.1, max: 0.9 }
// 버섯은 두 칸씩 건너뛰고 연쇄면 네 칸, 여섯 칸을 한 수에 간다.
// 얼음처럼 칸 수로 시간을 늘려 연쇄가 길어져도 속도가 같다. peak는 튕김 한 번의 꼭대기 높이 px.
// max는 갓마다 머무는 몫까지 담아야 해서 버섯 셋을 잇는 일곱 칸(1.9초)까지는 안 걸린다
const HOP = { perCell: 0.19, max: 2, peak: 32 }
// 큐브가 갓에 올라선 뒤 눌리고 펴지고 돌아오는 구간. 올라선 때부터 칸 수로 잰다.
// press와 spring을 더한 만큼 큐브가 갓 위에 머물러 눌림과 튕김이 가로 이동과 안 겹친다.
// 둘을 합쳐 1칸이라 한 칸을 가는 시간만큼 머문다. recover는 큐브가 날아간 뒤에 이어진다
const CAP_PRESS = { press: 0.55, spring: 0.45, recover: 1.1 }
// 큐브가 올라서서 눌린 채 남는 갓. 튕기지 않아 머무름을 따로 못 두고 이동의 끝자락을 쓴다.
// 이 몫만큼 남았을 때 눌리기 시작해서, 그 전까지는 큐브가 평소 높이 갓 위로 올라선다
const CAP_REST = 0.4
// 밟힌 버섯이 시드는 구간. 갓에 올라선 때부터 재서 머무름 1칸이 끝난 뒤에 시작한다
const CAP_WITHER = { from: 1.2, span: 1.4 }
// 큐브가 올라선 갓의 press 값
const CAP_ON = 2
const TILT = 0.24
// 바람에 밀려 한 칸 미끄러지는 시간과 기대서 버티는 시간. 내 이동 연출이 끝난 뒤에 붙는다
const WIND = { slide: 0.3, brace: 0.3 }
// 구를 때 머리 위 물건의 가장 큰 기울기 라디안과 그 기울기가 풀리는 구르기 몫, 튀어 오르는 높이 px
const CARRY_LEAN = { max: 0.31, until: 0.6 }
const CARRY_HOP = { alone: 6, chained: 3, from: 0.3 }

// 머리 위 물건은 윗면을 따라 기울었다 풀리고 그 사이 떠올랐다 새 윗면에 앉으며 두 움직임 모두 멈춘 채 시작하고 끝난다
export const carriedRoll = (p: number, chained: boolean) => {
  const lean = Math.min(1, p / CARRY_LEAN.until)
  const q = clamp01((p - CARRY_HOP.from) / (1 - CARRY_HOP.from))
  const height = chained ? CARRY_HOP.chained : CARRY_HOP.alone
  return {
    angle: CARRY_LEAN.max * Math.sin(Math.PI * lean),
    hop: height * Math.sin(Math.PI * q) ** 2,
  }
}
// 심는 수의 구간. 큐브가 bump 동안 턱 쪽으로 기울었다 돌아오고 가장 기운 pop에 씨앗이 튀어 travel 동안 흙 자리로 간다.
// hop은 떨어지며 솟는 높이 px이고 묻히는 동안 fadeFrom부터 흐려진다
const PLANT_SEED = {
  bump: 0.45,
  pop: 0.225,
  travel: 0.4,
  hop: 8,
  fadeFrom: 0.65,
  fade: 0.35,
  small: 0.5,
}

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
// 천천히 시작해 천천히 멈춘다. 씨앗이 솟는 곡선과 같다
const smooth = (t: number) => t * t * (3 - 2 * t)
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

const cellsOf = (event: PathEvent) =>
  Math.abs(event.to.x - event.from.x) + Math.abs(event.to.y - event.from.y)

// 튕겨 간 이동의 칸 수. 미끄러짐 말고 한 번에 두 칸 넘게 가는 것은 버섯뿐이라 칸 수로 가른다
const hopCells = (event: PathEvent) =>
  event.type === 'slid' || event.type === 'climbed' || cellsOf(event) < 2 ? 0 : cellsOf(event)

const secondsOf = (event: PathEvent) =>
  event.type === 'slid'
    ? Math.min(SLIDE.max, SLIDE.perCell * cellsOf(event))
    : hopCells(event) > 0
      ? Math.min(HOP.max, HOP.perCell * hopSpan(hopCells(event)))
      : event.type === 'pushed' && event.result === 'filled'
        ? SECONDS.filled
        : SECONDS[event.type]

// 기다리는 구간이 섞일 수 있어 길이를 이벤트와 따로 둔다
interface Segment {
  event: PathEvent
  seconds: number
  wait?: boolean // 내 이동 연출이 끝나고 바람이 불기를 기다리는 구간
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

const has = (list: Point[], p: Point) => list.some((q) => same(q, p))

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

const isWind = (e: GameEvent) => e.type === 'blown' || e.type === 'braced'

// 바람이 분 수에서 바람 앞의 내 이동 이벤트. 바람이 안 분 수면 null
const ownPart = (events: GameEvent[]) => {
  const at = events.findIndex(isWind)
  return at < 0 ? null : events.slice(0, at)
}

// 바람에 밀려 가는 길은 내 이동 연출이 다 끝난 뒤에 이어진다
const windSegments = (events: GameEvent[], own: GameEvent[]): Segment[] => {
  const mine = playerSegments(own)
  const path = playerPath(events.slice(own.length))
  if (path.length === 0) return mine

  const hold = mine.at(-1)?.event.to ?? path[0].from
  const wait = Math.max(0, moveSeconds(own, NO_SWAMP) - totalSeconds(mine))
  return [
    ...mine,
    { event: { type: 'moved', from: hold, to: hold }, seconds: wait, wait: true },
    ...path.map((event) => ({
      event,
      seconds: event.type === 'moved' && cellsOf(event) === 1 ? WIND.slide : secondsOf(event),
    })),
  ]
}

// 상자가 메우는 중인 칸에 큐브가 올라서면 빈 공간 위에 뜬다. 멈춰 세우면 걸리는 느낌이 나서 다가가는 속도만 늦춘다
const playerSegments = (events: GameEvent[]): Segment[] => {
  const own = ownPart(events)
  if (own) return windSegments(events, own)

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
    for (const { event, seconds, wait } of segments) {
      if (!wait && leave === null && same(event.from, p)) leave = start
      if (!wait && same(event.to, p)) arrive = start + seconds
      start += seconds
    }
  }
  return { arrive, leave }
}

// 스위치가 눌리거나 풀린 뒤 문과 발판이 따라 움직이는 시간
const SWITCH_SECONDS = 0.3

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

// 씨앗이 솟는 시간. 큐브와 상자가 다 움직인 뒤에 따로 붙는다
const RISE_SECONDS = 0.36

// 솟기를 뺀 이동 몫의 연출 시간
const moveSeconds = (events: GameEvent[], swamp: SwampTime) =>
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
    ...events.map((e) =>
      e.type === 'blocked' || e.type === 'placed' || e.type === 'planted' ? SECONDS[e.type] : 0,
    ),
    ...events.map((e) => (e.type === 'cracked' && e.gone ? CRUMBLE_SECONDS : 0)),
    ...events.map((e) => (e.type === 'struggled' ? SWAMP.struggle : 0)),
    ...frostStamps(events).map((stamp) => stamp.at + FROST_FADE),
  ) +
  (events.some((e) => e.type === 'braced') ? WIND.brace : 0)

const rises = (events: GameEvent[]) => events.some((e) => e.type === 'rose')

// at 칸이 솟으며 그 위의 큐브나 상자를 올리는 층 수
const seedLift = (events: GameEvent[], at: Point, what: Lifted) =>
  events.some((e) => e.type === 'rose' && same(e.at, at) && e.lifted.includes(what)) ? 1 : 0

export const durationOf = (events: GameEvent[], swamp: SwampTime = NO_SWAMP) =>
  moveSeconds(events, swamp) + (rises(events) ? RISE_SECONDS : 0)

// 이동 몫의 진행도. 씨앗이 솟는 수는 솟기 전에 1이 된다
export const stepProgress = (events: GameEvent[], t: number, swamp: SwampTime = NO_SWAMP) => {
  const moving = moveSeconds(events, swamp)
  return moving <= 0 ? 1 : clamp01((t * durationOf(events, swamp)) / moving)
}

// 씨앗이 솟는 진행도. 가속해 오르다 끝에서 느려져 튀지 않는다
export const riseProgress = (events: GameEvent[], t: number, swamp: SwampTime = NO_SWAMP) => {
  if (!rises(events)) return 1

  const p = clamp01((t * durationOf(events, swamp) - moveSeconds(events, swamp)) / RISE_SECONDS)
  return p * p * (3 - 2 * p)
}

// 이동이 시작한 뒤로 흐른 시간. 늪에서 뽑혀 나오기를 기다리는 동안은 0보다 작다
const elapsedAt = (events: GameEvent[], swamp: SwampTime, t: number) =>
  t * durationOf(events, swamp) - swamp.lead

// 바람이 부는 때와 그치는 때. elapsedAt과 같은 시각이고 바람이 안 분 수면 null
const windSpan = (events: GameEvent[], swamp: SwampTime) => {
  if (events.some((e) => e.type === 'braced')) {
    const from = moveSeconds(events, swamp) - swamp.lead - WIND.brace
    return { from, to: from + WIND.brace }
  }
  const segments = playerSegments(events)
  const wait = segments.findIndex((s) => s.wait)
  if (wait < 0) return null
  return { from: totalSeconds(segments.slice(0, wait + 1)), to: totalSeconds(segments) }
}

// 큐브가 바람에 밀리거나 기대는 동안이면 바람 쪽으로 기운 몫 0~1, 아니면 null
const windLean = (events: GameEvent[], swamp: SwampTime, t: number) => {
  const span = windSpan(events, swamp)
  const elapsed = elapsedAt(events, swamp, t)
  if (span === null || elapsed < span.from || elapsed >= span.to) return null
  return Math.sin(Math.PI * clamp01((elapsed - span.from) / (span.to - span.from)))
}

// 이 수의 연출이 시작한 뒤 바람이 부는 초. 바람이 안 분 수면 null
export const windSeconds = (events: GameEvent[], swamp: SwampTime = NO_SWAMP) => {
  const span = windSpan(events, swamp)
  return span === null ? null : swamp.lead + span.from
}

interface WindView {
  game: GameState | null
  prevGame: GameState | null
  events: GameEvent[]
  animating: boolean
}

// 바람이 분 수는 내 이동 연출이 끝나 바람이 부는 동안 0이 흔들리고 연출이 끝나면 다음 숫자로 깜빡인다
export const windDisplay = ({ game, prevGame, events, animating }: WindView) => {
  const gustAt = game && prevGame ? windSeconds(events, swampTime(prevGame, game)) : null
  const wind = game ? windLeft(gustAt === null || !animating ? game : (prevGame ?? game)) : null
  const blew = gustAt !== null && !animating
  return { gustAt, wind, blew }
}

// 바람에 밀리거나 기대는 동안은 머리 위 물건이 구르지 않고 큐브와 같이 기운다
export const windLeaning = (events: GameEvent[], t: number, swamp: SwampTime = NO_SWAMP) =>
  windLean(events, swamp, t) !== null

// 내 이동 몫의 진행도. 바람이 분 수는 바람이 불기 전에 1이 된다
export const ownProgress = (events: GameEvent[], t: number, swamp: SwampTime = NO_SWAMP) => {
  const span = windSpan(events, swamp)
  if (span === null) return stepProgress(events, t, swamp)
  return span.from <= 0 ? 1 : clamp01(elapsedAt(events, swamp, t) / span.from)
}

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
    : smooth(Math.min(1, Math.max(0, (elapsedAt(events, swamp, t) - at) / SWITCH_SECONDS)))
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

interface CarryView {
  pickedUp: GameEvent | undefined // 이 수의 줍기
  placed: GameEvent | undefined // 이 수의 사다리 놓기
  game: Pick<GameState, 'carrying'>
  pickUpPhase: number
  ownT: number
}

export const carriedOpacityOf = ({ pickedUp, placed, game, pickUpPhase, ownT }: CarryView) =>
  pickedUp && !game.carrying
    ? 0
    : pickedUp
      ? pickUpPhase
      : placed
        ? 1 - ownT
        : game.carrying
          ? 1
          : 0

// 막힌 쪽으로 밀어 큐브가 기울면 머리 위 물건도 윗면을 따라 기운다
export const carriedBaseOf = (
  cubeScreen: Point,
  cubeSink: number,
  cube: Pick<CubeFrame, 'lift'>,
) => ({
  x: cubeScreen.x,
  y: cubeScreen.y - TILE.layer + cubeSink - cube.lift,
})

// 구를 때는 윗면에 붙어 같이 기울다가 새 윗면으로 살짝 튀어 올라앉는다
export const rollingTilt = (
  cube: Pick<CubeFrame, 'angle' | 'direction'>,
  chain: Chain,
): TopTilt => {
  const roll = carriedRoll(Math.min(1, cube.angle / (Math.PI / 2)), chain.in || chain.out)
  return (u, v, z) => {
    const d = tiltOnTop(cube.direction, roll.angle)(u, v, z)
    return { x: d.x, y: d.y - roll.hop }
  }
}

interface TiltView {
  events: GameEvent[]
  moving: boolean
  t: number
  swampSeconds: SwampTime
  cube: Pick<CubeFrame, 'angle' | 'direction'>
  rolling: TopTilt
}

// 막혔거나 바람에 기울면 큐브와 같이 기울고 구르는 동안은 rolling을 따른다
export const carriedTilt = ({ events, moving, t, swampSeconds, cube, rolling }: TiltView) =>
  events.some((e) => e.type === 'blocked') || (moving && windLeaning(events, t, swampSeconds))
    ? tiltOnTop(cube.direction, cube.angle)
    : moving && cube.angle > 0
      ? rolling
      : undefined

// 사다리는 큐브 윗면보다 2px 위에 그린다
export const ladderTilt = (bump: TopTilt | undefined): TopTilt | undefined =>
  bump && ((u, v, z) => bump(u, v, z + 2))

// 발판이 다음 칸으로 가는 진행도 0~1. 발판이 가지 않는 이동은 1
export const tramProgress = (events: GameEvent[], t: number, swamp: SwampTime = NO_SWAMP) => {
  const at = tramStart(events)
  if (at === null) return 1

  return smooth(Math.min(1, Math.max(0, (elapsedAt(events, swamp, t) - at) / SECONDS.tram)))
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
      // 바람을 기다리는 구간 앞뒤에서는 멈췄다가 다시 출발한다
      return {
        event,
        index,
        p: moveEase(local, {
          in: index > 0 ? !segments[index - 1].wait : chain.in,
          out: (!last && !segments[index + 1].wait) || chain.out,
        }),
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
  lift: number // 버섯 갓에 받쳐지거나 튕겨 떠오른 화면 거리
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

export type Tram = Extract<Entity, { type: 'tram' }>

export const tramNext = (tram: Tram, spot: TramSpot) =>
  tram.cells[nextTramSpot(tram.cells, spot).at]

// 코는 다음에 갈 쪽을 가리킨다. 끝에 닿으면 오던 쪽 그대로 둔다
export const tramFacing = (tram: Tram, spot: TramSpot) => {
  const at = tram.cells[spot.at]
  const ahead = tram.cells[spot.at + spot.dir]
  const back = tram.cells[spot.at - spot.dir]
  return ahead ? { x: ahead.x - at.x, y: ahead.y - at.y } : { x: at.x - back.x, y: at.y - back.y }
}

// 발판 길 칸은 바닥이 없어도 구덩이로 그린다. 값은 이웃한 길 칸의 방향이다
export const railDirsOf = (trams: Tram[]) => {
  const map = new Map<string, string>()
  for (const tram of trams)
    tram.cells.forEach((cell, i) =>
      map.set(
        `${cell.x}-${cell.y}`,
        [tram.cells[i - 1], tram.cells[i + 1]]
          .filter((near) => near !== undefined)
          .map((near) => `${near.x - cell.x},${near.y - cell.y}`)
          .join('|'),
      ),
    )
  return map
}

interface TramView {
  trams: Tram[]
  before: Pick<GameState, 'trams'>
  game: Pick<GameState, 'trams'>
  tramPhase: number
  PIT_FLOOR: number // BoardCell의 구덩이 바닥 깊이
}

// 발판은 이전 자리에서 다음 자리로 미끄러진다. 코와 밝은 레일은 도착하는 순간에 다음 쪽으로 넘어간다
export const tramFramesOf = ({ trams, before, game, tramPhase, PIT_FLOOR }: TramView) =>
  trams.map((tram, i) => {
    const from = tram.cells[before.trams[i].at]
    const to = tram.cells[game.trams[i].at]
    const spot = tramPhase < 1 ? before.trams[i] : game.trams[i]
    const sliding = tramPhase > 0 && tramPhase < 1
    const facing = sliding ? { x: to.x - from.x, y: to.y - from.y } : tramFacing(tram, spot)
    const screen = toScreen(
      { x: lerp(from.x, to.x, tramPhase), y: lerp(from.y, to.y, tramPhase) },
      0,
    )
    return {
      x: screen.x,
      y: screen.y - tram.level * TILE.layer,
      depth: PIT_FLOOR + tram.level * TILE.layer,
      dx: facing.x,
      dy: facing.y,
      to,
      cell: slidingCell(from, to, tramPhase),
      next: tramNext(tram, spot),
    }
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

// 갓으로 걸어 들어가는 첫 한 칸만 구르는 각도. 갓을 딛고 날아가는 동안은 구르지 않는다
const hopAngle = (cells: number, u: number) => {
  const lead = cells % 2
  return lead === 0 || u >= lead ? 0 : (Math.PI / 2) * (u / lead)
}

// 튕겨 가는 큐브가 u칸째에 있을 때 딛는 칸의 높이. 갓이 있는 칸과 양 끝만 밟고 사이 칸은 건너뛴다
const hopLevel = (
  game: GameState,
  event: PathEvent,
  cells: number,
  fromLevel: number,
  toLevel: number,
  u: number,
) => {
  const dx = Math.sign(event.to.x - event.from.x)
  const dy = Math.sign(event.to.y - event.from.y)
  const stops = [0]
  for (let n = cells % 2 === 0 ? 2 : 1; n < cells; n += 2) stops.push(n)
  stops.push(cells)

  const floorOf = (n: number) =>
    n === 0
      ? fromLevel
      : n === cells
        ? toLevel
        : (game.heights[event.from.y + dy * n]?.[event.from.x + dx * n] ?? fromLevel)

  const next = Math.max(
    1,
    stops.findIndex((s) => s >= u),
  )
  const a = stops[next - 1]
  const b = stops[next] ?? cells
  return b === a ? floorOf(a) : lerp(floorOf(a), floorOf(b), clamp01((u - a) / (b - a)))
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
    lift: capHeight(game, player),
  }
  if (t >= 1) return still

  const segments = playerSegments(events)
  const startLevel = prev ? standHeight(prev, prev.player) : endLevel
  const pathLevel = segments.reduce((level, s) => levelAfter(level, s.event), startLevel)
  const swamp = swampTime(prev, game)
  // 씨앗이 솟아 오르는 몫은 이동이 끝난 뒤에 칸과 같이 오른다
  const seedUp = seedLift(events, player, 'player')
  const pathEnd = endLevel - seedUp
  // 이동 경로로 설명되지 않는 나머지 높이 차이는 발판이 오르내린 몫이라 칸과 같은 속도로 따라간다
  const risen = seedUp * riseProgress(events, t, swamp)
  const riding = (pathEnd - pathLevel) * ridePhase(game, events, player, t, swamp) + risen
  // 연출이 이동보다 길 수 있어 큐브는 제 길을 다 가면 그 자리에서 기다린다
  const elapsed = elapsedAt(events, swamp, t)

  // 바람이 분 수는 내 이동 연출이 다 끝난 뒤에 바람에 밀리거나 기댄다
  const wind = windSpan(events, swamp)
  const lean = windLean(events, swamp, t)
  const braced = events.find((e) => e.type === 'braced')
  // 늪에 빠져 버티는 수는 버둥 사이에 끼면 리듬만 끊겨 기울거나 눌리지 않는다
  // 늪에 묶이거나 숨어서 버틴 수는 기울지 않는다
  if (braced?.type === 'braced' && lean !== null && !inSwamp(game, player) && !braced.sheltered) {
    return { ...still, level: pathEnd + risen, direction: braced.direction, angle: lean * TILT }
  }

  const warped = events.find((e) => e.type === 'warped')
  const warpStart = warpAt(events)
  // 내 이동에서 순간이동한 뒤 바람에 밀리면 그때부터는 밀리는 길을 그린다
  const ownWarp = wind !== null && warpStart !== null && warpStart < wind.from
  const waitAt = segments.findIndex((s) => s.wait)
  const ownLevel = segments
    .slice(0, waitAt < 0 ? segments.length : waitAt)
    .reduce((level, s) => levelAfter(level, s.event), startLevel)
  // 순간이동은 길을 다 간 뒤에 일어나서 가라앉는 동안 들어간 칸에, 솟는 동안 나온 칸에 그린다
  if (
    warped?.type === 'warped' &&
    warpStart !== null &&
    elapsed >= warpStart &&
    !(ownWarp && elapsed >= wind.from)
  ) {
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
      level:
        (ownWarp ? ownLevel : sinking ? pathLevel + riding : pathEnd + risen) - WARP.depth * deep,
      direction: last ? directionBetween(last.event.from, last.event.to) : still.direction,
      angle: 0,
      cell,
      squash: 0,
      fade: 1 - deep,
      lift: 0,
    }
  }

  // 늪에 가라앉는 동안은 걸음이 끝나 들어간 칸에 서 있다. 그 칸에 그려야 진흙에 가려진다
  if (swamp.tail > 0 && elapsed >= totalSeconds(segments)) return still

  // 늪에서 뽑혀 나오기를 기다리는 동안은 떠나기 전 칸에 그대로 선다
  const moving = elapsed < 0 ? null : stepAt(segments, elapsed, slideChain(events, chain))
  // 바람을 기다리는 동안은 내 이동이 끝난 자리에 선다
  const step =
    moving && segments[moving.index].wait
      ? moving.index > 0
        ? { event: segments[moving.index - 1].event, index: moving.index - 1, p: 1 }
        : null
      : moving
  if (prev && step) {
    const span = slideSpan(segments)
    const { event, index, p } = step
    const fromLevel = segments
      .slice(0, index)
      .reduce((level, s) => levelAfter(level, s.event), startLevel)
    const toLevel = levelAfter(fromLevel, event)

    const cells = cellsOf(event)
    const rise = capHeight(prev, event.from)
    const land = capHeight(game, event.to)
    // 튕겨 가는 이동은 갓을 딛는 동안 가로로 거의 안 움직인다
    const hopped = hopCells(event) > 0
    const gone = hopped ? hopProgress(cells, p) : p

    // 갓을 딛는 이동은 갓에 닿기 전에 내려앉아야 큐브와 갓이 붙는다
    // 이 낙하만 고르게 내린다. 가속하면 갓에 닿기 직전까지 떠 있다가 뚝 떨어진다
    const dropped =
      land > 0 ? clamp01((cells * p) / restWalk(cells)) : easeIn(clamp01((p - 0.55) / 0.45))
    // 튕겨서 상자 위에 내려서는 수는 오르는 이벤트가 아니라 걷기로 남아 levelAfter가 높이를 못 올린다.
    // 그 몫을 riding에 맡기면 이동 내내 골고루 퍼져 갓을 딛는 동안에도 큐브가 떠 있다
    const landLevel = index === segments.length - 1 ? pathEnd : toLevel
    const level = hopped
      ? hopLevel(game, event, cells, fromLevel, landLevel, gone * cells)
      : event.type === 'fell'
        ? lerp(fromLevel, toLevel, dropped)
        : event.type === 'climbed'
          ? lerp(fromLevel, toLevel, easeOut(Math.min(1, p / 0.6)))
          : fromLevel

    return {
      x: lerp(event.from.x, event.to.x, gone),
      y: lerp(event.from.y, event.to.y, gone),
      // 튕겨 가는 이동은 hopLevel이 끝 칸 높이까지 맡는다
      level: level + (hopped ? risen : riding),
      direction: directionBetween(event.from, event.to),
      // 얼음 위와 갓을 딛고 날아가는 동안에는 구르지 않는다. 갓으로 걸어 들어가는 한 칸은 구른다
      // 바람에 밀려 가는 동안은 구르지 않고 바람 쪽으로 기울었다 돌아온다
      angle:
        waitAt >= 0 && index > waitAt
          ? (lean ?? 0) * TILT
          : event.type === 'slid'
            ? 0
            : hopped
              ? hopAngle(cells, gone * cells)
              : (Math.PI / 2) * p,
      // 솟는 수는 이동이 끝나면 들어선 칸에 그려 그 칸의 말뚝이 큐브 앞에 남는다
      cell: rises(events) && p >= 1 ? event.to : frontOf(event.from, event.to),
      squash: span ? squashAt((elapsed - span.from) / (span.to - span.from)) : 0,
      fade: 1,
      lift: hopped
        ? hopLift(cells, hopSpan(cells) * p, land)
        : land > 0
          ? restLift(
              cells * (p - 1),
              lerp(rise, CAP_TOP_IDLE, clamp01((cells * p) / restWalk(cells))),
            )
          : lerp(rise, land, p),
    }
  }

  const blocked = events.find((e) => e.type === 'blocked')
  if (blocked?.type === 'blocked') {
    return { ...still, direction: blocked.direction, angle: Math.sin(Math.PI * t) * TILT }
  }

  // 제 힘으로 가지 않은 이동은 떠나기 전 칸에 서 있는다
  const hold = prev ? prev.player : player

  // 심는 수는 턱에 부딪혀 기울었다가 앞 절반 안에 돌아온다. 그 반동에 씨앗이 떨어진다
  // 바람이 분 수는 바람이 불기 전까지가 심는 수의 몫이고 그동안은 심은 칸에 선다
  const planted = events.find((e) => e.type === 'planted')
  if (planted?.type === 'planted') {
    const own = wind === null ? t : wind.from > 0 ? clamp01(elapsed / wind.from) : 1
    const bump = clamp01(own / PLANT_SEED.bump)
    const at = wind === null ? still : { ...still, ...hold, cell: hold, level: startLevel }
    return { ...at, direction: planted.direction, angle: Math.sin(Math.PI * bump) * TILT }
  }

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
  lift: number // 버섯에 튕겨 떠오른 화면 거리
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
  // 구덩이를 메우는 상자는 반쯤 가서부터 부드럽게 가라앉고 떨어지는 상자는 끝에서 빨라진다
  const filling = event.type === 'pushed' && event.result === 'filled'
  const level =
    event.type === 'slid' || p < (filling ? 0.5 : 0.6)
      ? fromLevel
      : lerp(fromLevel, toLevel, filling ? smooth((p - 0.5) / 0.5) : easeIn((p - 0.6) / 0.4))
  // 도착 칸에 서는 높이에서 상자 한 층을 뺀 값이 상자가 앉을 높이다. 발판이 오르내린 몫이 여기서 드러난다
  const endLevel = path.reduce((level, passed) => boxLevelAfter(prev, level, passed), start)
  // 씨앗이 솟아 오르는 몫은 상자가 자리에 앉은 뒤 칸과 같이 오른다
  const riding =
    (standHeight(game, to) - 1 - seedLift(events, to, 'box') - endLevel) *
    ridePhase(game, events, to, t, swamp)
  const shift = carry ? carriedBy(carry, ride) : { x: 0, y: 0 }

  const cells = cellsOf(event)
  const hopped = hopCells(event) > 0
  const gone = hopped ? hopProgress(cells, p) : p

  return {
    x: lerp(event.from.x, event.to.x, gone) + shift.x,
    y: lerp(event.from.y, event.to.y, gone) + shift.y,
    level: level + riding,
    lift: hopped ? hopLift(cells, hopSpan(cells) * p, 0) : 0,
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

// 상자가 구덩이를 메워 생긴 바닥. 길을 다시 짜는 데 쓰는 자리라 가려지면 안 된다.
// 덩굴이 메운 칸은 판을 짤 때 보이게 두어서 빼고, 넣으면 긴 덩굴 앞의 칸이 줄줄이 흐려진다
export const filledCells = (
  heights: number[][],
  stageHeights: number[][],
  entities: Entity[],
  vines: VineSpot[],
) => {
  const grown = entities.flatMap((e) =>
    e.type === 'vine' ? e.cells.slice(0, vines.find((v) => v.id === e.id)?.grown ?? 0) : [],
  )
  return heights.flatMap((row, y) =>
    row.flatMap((h, x) =>
      h >= 0 && stageHeights[y][x] < 0 && !has(grown, { x, y }) ? [{ x, y }] : [],
    ),
  )
}

// 상자가 메우는 구덩이는 상자가 한 칸 안으로 들어올 때까지 구덩이로 두고 그 뒤로는 바닥이 먼저 깔린다.
// 덩굴이 올 칸은 먼저 깔린 바닥이 빈칸으로 보여서 상자가 다 가라앉을 때까지 싹 달린 구덩이로 둔다
export const fillingCellKey = (
  box: Point | null,
  events: GameEvent[],
  vines: Map<string, VineLook>,
) => {
  const filling = box ? events.find((e) => e.type === 'pushed' && e.result === 'filled') : undefined
  const fillingAt = filling?.type === 'pushed' ? `${filling.to.x}-${filling.to.y}` : null
  return box &&
    filling?.type === 'pushed' &&
    fillingAt &&
    (vines.has(fillingAt) || Math.hypot(box.x - filling.to.x, box.y - filling.to.y) > 1)
    ? fillingAt
    : null
}

export interface FillView {
  heights: number[][]
  before: Pick<GameState, 'heights'>
  fillingKey: string | null // 아직 구덩이로 그리는 메우는 칸
}

export const heightNow = ({ heights, before, fillingKey }: FillView, x: number, y: number) =>
  `${x}-${y}` === fillingKey ? before.heights[y][x] : heights[y]?.[x]

// 옆 칸이 바닥이면 구덩이 벽을 세운다. 옆 칸이 발판 길이나 판이 덜 차오른 덩굴 길이면 구덩이가 이어져 벽이 없다
export const wallHeight = (
  view: FillView & { vineFrame: Map<string, VineFrame>; railDirs: Map<string, string> },
  x: number,
  y: number,
) => {
  const { before, vineFrame, railDirs } = view
  const key = `${x}-${y}`
  const vine = vineFrame.get(key)
  const vinePit =
    vine !== undefined &&
    vine.kind !== 'root' &&
    ((heightNow(view, x, y) ?? -1) < 0 || (vine.kind === 'grown' && vine.rise < 1))
  return railDirs.has(key) || vinePit
    ? -1
    : Math.max(heightNow(view, x, y) ?? -1, before.heights[y]?.[x] ?? -1)
}

interface BoxView {
  box: BoxFrame | null
  sinkingBox: BoxSinkFrame | null
  tramFrames: { x: number; y: number; to: Point; cell: Point }[]
  boxes: Point[]
  crackView: CrackView
  BOX_SINK: number // BoardCell의 상자가 늪에 잠기는 깊이
}

// 밀리는 상자와 발판 위의 상자. 칸과 따로 움직여서 화면 좌표로 미리 구해 둔다
export const boxFramesOf = ({
  box,
  sinkingBox,
  tramFrames,
  boxes,
  crackView,
  BOX_SINK,
}: BoxView) => {
  const pushedScreen = box ? toScreen({ x: box.x, y: box.y }, box.level) : null
  return [
    ...(box && pushedScreen
      ? [
          {
            x: pushedScreen.x,
            // 늪에 밀려 들어간 상자는 멈춘 자리에서 진흙 아래로 내려간다
            y:
              pushedScreen.y -
              TILE.layer +
              standSink(crackView, box.x, box.y) -
              box.lift +
              (sinkingBox ? BOX_SINK * sinkingBox.deep : 0),
            to: box.to,
            cell: box.cell,
          },
        ]
      : []),
    // 발판 위의 상자는 발판과 한 몸이라 판 위에 얹혀 그려져야 한다
    ...tramFrames
      .filter((frame) => has(boxes, frame.to) && !(box && same(box.to, frame.to)))
      .map((frame) => ({ x: frame.x, y: frame.y - TILE.layer, to: frame.to, cell: frame.cell })),
  ]
}

// 단계가 오르는 앞부분과 가라앉아 사라지는 뒷부분. 가라앉음은 이동 연출을 거의 다 쓴다
const CRUMBLE = { deepen: 0.9, fallFrom: 0.12, drop: 1.6, shadow: 0.9 }

// 튕겨 가는 이동에서 무너지는 칸이 닳기 시작하는 지점. 큐브가 꼭대기를 지나 내려올 때다
const CRACK_HOP_FROM = 0.5

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

// 무너지는 칸이 앞으로 견디는 횟수. 목록에 없는 칸은 바닥 없는 칸과 같게 본다
export const crackLeft = (state: Pick<GameState, 'cracks'>, p: Point) =>
  state.cracks.find((c) => same(c, p))?.left ?? -1

export interface CrackView {
  game: Pick<GameState, 'cracks'>
  before: Pick<GameState, 'cracks'>
  crackPhase: number
}

// 무너지는 칸은 닳을수록 내려앉아서 그 위에 선 것도 같은 만큼 내려간다
export const sinkAt = ({ game, before, crackPhase }: CrackView, p: Point) => {
  const left = crackLeft(game, p)
  const was = crackLeft(before, p)
  return Math.max(left, was) >= 0 ? crackSink(crackFrame(was, left, crackPhase).stage) : 0
}

// 칸 사이를 지나는 동안에는 앞뒤 칸의 내려앉은 양을 섞는다
export const standSink = (view: CrackView, x: number, y: number) => {
  const x0 = Math.floor(x)
  const x1 = Math.ceil(x)
  const y0 = Math.floor(y)
  const y1 = Math.ceil(y)
  const near = lerp(sinkAt(view, { x: x0, y: y0 }), sinkAt(view, { x: x1, y: y0 }), x - x0)
  const far = lerp(sinkAt(view, { x: x0, y: y1 }), sinkAt(view, { x: x1, y: y1 }), x - x0)
  return lerp(near, far, y - y0)
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

// 갓이 눌리는 차례. 펴짐, 평소, 눌림, 올라섬 순서라 press에 1을 더한 자리를 읽는다
const CAP_STEM = [18, 14, 9, 2]
const CAP_WIDTH = [0.44, 0.48, 0.54, 0.66]
const CAP_THICK = [6, 6, 5, 3]
const CAP_CROWN = [3, 3, 2, 0]
// 시드는 차례. 평소, 시드는 중, 시듦 순서라 wither에 2를 곱한 자리를 읽는다
const DRY_STEM = [14, 8, 3]
const DRY_WIDTH = [0.48, 0.5, 0.56]
const DRY_THICK = [6, 4, 3]
const DRY_CROWN = [3, 2, 2]

const capTop = (i: number) => CAP_STEM[i] + CAP_THICK[i] + CAP_CROWN[i]

// 못 뛰어서 올라선 큐브가 눌린 갓 위에 서는 높이
export const MUSHROOM_STAND = capTop(3)
// 큐브가 막 올라선 평소 갓과 다 펴진 갓의 꼭대기. 머무름이 끝나고 여기서 날아오른다
export const CAP_TOP_IDLE = capTop(1)
const CAP_TOP_SPRING = capTop(0)

export interface MushroomPose {
  stem: number
  cap: number // 칸 폭에 대한 갓 너비 비율
  thick: number
  crown: number
}

// press는 -1(펴짐)에서 2(큐브가 올라섬)까지, wither는 0에서 1까지다
export const mushroomPose = (press: number, wither: number): MushroomPose => {
  const at = wither > 0 ? clamp01(wither) * 2 : Math.min(3, Math.max(0, press + 1))
  const steps =
    wither > 0
      ? [DRY_STEM, DRY_WIDTH, DRY_THICK, DRY_CROWN]
      : [CAP_STEM, CAP_WIDTH, CAP_THICK, CAP_CROWN]

  return {
    stem: atStage(steps[0], at),
    cap: atStage(steps[1], at),
    thick: atStage(steps[2], at),
    crown: atStage(steps[3], at),
  }
}

// 갓이 눌린 정도에 따른 갓 꼭대기 높이. 큐브는 언제나 그 위에 얹힌다
const capTopAt = (press: number) => {
  const pose = mushroomPose(press, 0)
  return pose.stem + pose.thick + pose.crown
}

// 이미 올라서 있던 갓은 눌린 채로 시작해 펴지는 몫만 남는다
const capFrom = (index: number, lead: number) => (index === 0 && lead === 0 ? CAP_PRESS.press : 0)

// 그 갓이 다 눌렸을 때 값. 올라서 있던 갓은 큐브가 얹혀 더 눌려 있다
const capDeep = (index: number, lead: number) => (index === 0 && lead === 0 ? CAP_ON : 1)

// 머무름까지 더한 이동 길이. 칸 수와 같은 단위라 HOP.perCell을 그대로 곱한다
const hopSpan = (cells: number) => {
  const lead = cells % 2
  const bounces = (cells - lead) / 2
  return cells + bounces * (CAP_PRESS.press + CAP_PRESS.spring) - capFrom(0, lead)
}

interface HopStep {
  u: number // 실제로 간 칸 수
  index: number // 지금 딛고 있는 갓 번호, 딛고 있지 않으면 -1
  phase: number // 그 갓에 올라선 뒤 흐른 칸 수
}

// 머무름까지 더한 자리 q가 실제로는 어디인지. 갓을 딛는 동안 u가 멈춘다
const hopStepAt = (cells: number, q: number): HopStep => {
  const lead = cells % 2
  const bounces = (cells - lead) / 2
  let at = 0
  let u = 0

  for (let i = 0; i < bounces; i += 1) {
    const walk = i === 0 ? lead : 2
    if (q < at + walk) return { u: u + Math.max(0, q - at), index: -1, phase: 0 }
    at += walk
    u += walk

    const dwell = CAP_PRESS.press + CAP_PRESS.spring - capFrom(i, lead)
    if (q < at + dwell) return { u, index: i, phase: capFrom(i, lead) + (q - at) }
    at += dwell
  }

  return { u: Math.min(cells, u + Math.max(0, q - at)), index: -1, phase: 0 }
}

// 진행도 p일 때 실제로 간 칸 비율. 갓을 딛는 동안은 제자리다
export const hopProgress = (cells: number, p: number) =>
  hopStepAt(cells, hopSpan(cells) * p).u / cells

// 큐브나 상자가 머무름까지 더한 자리 q에 있을 때 떠오른 화면 거리. land는 도착 칸에서 앉는 높이다
export const hopLift = (cells: number, q: number, land: number) => {
  const lead = cells % 2
  const bounces = (cells - lead) / 2
  const { u, index, phase } = hopStepAt(cells, q)

  // 머무는 동안은 눌렸다 펴지는 갓을 그대로 딛고 있어 큐브가 같이 오르내린다
  if (index >= 0) return capTopAt(capSpringAt(phase, capDeep(index, lead)))
  // 걸어 들어가는 한 칸은 평소 높이 갓 위로 올라서는 몫만 오른다
  if (u < lead) return lerp(0, CAP_TOP_IDLE, clamp01(u / lead))

  const b = Math.min(bounces - 1, Math.floor((u - lead) / 2))
  const s = clamp01((u - lead) / 2 - b)
  // 이어지는 갓에는 평소 높이로 내려서고 마지막에는 땅으로 내린다
  // 마지막에 갓 위에 내려서면 평소 높이로 내린 뒤에 눌린다
  const to = b + 1 < bounces || land > 0 ? CAP_TOP_IDLE : land
  const flying = lerp(CAP_TOP_SPRING, to, s) + HOP.peak * Math.sin(Math.PI * s)
  return land > 0 ? restLift(q - hopSpan(cells), flying) : flying
}

// 큐브가 버섯 갓 위에 서 있는 높이. 그 칸에 서 있지 않으면 0
const capHeight = (state: GameState | null, p: Point) =>
  state && has(state.mushrooms, p) ? MUSHROOM_STAND : 0

// 튕겨 보내는 갓. 큐브가 올라선 뒤에 눌리고 펴진다. c는 올라선 뒤 흐른 칸 수다
const capSpringAt = (c: number, deep: number) =>
  c <= 0
    ? 0
    : c <= CAP_PRESS.press
      ? lerp(0, deep, easeOut(c / CAP_PRESS.press))
      : c <= CAP_PRESS.press + CAP_PRESS.spring
        ? lerp(deep, -1, easeIn((c - CAP_PRESS.press) / CAP_PRESS.spring))
        : lerp(-1, 0, clamp01((c - CAP_PRESS.press - CAP_PRESS.spring) / CAP_PRESS.recover))

// 큐브가 올라서서 눌린 채 남는 갓. 다가오는 한 칸 동안 눌린다
// 갓에 올라서기까지 걷는 몫. 남은 CAP_REST는 눌리는 데 쓴다
const restWalk = (cells: number) => Math.max(0.01, cells - CAP_REST)

// 갓 위에 내려서는 끝자락. 다 내려서기 전에는 walking을 그대로 쓰고 그 뒤로는 눌리는 갓을 딛는다
const restLift = (phase: number, walking: number) =>
  phase <= -CAP_REST ? walking : capTopAt(capRestAt(phase))

const capRestAt = (d: number) =>
  d <= -CAP_REST ? 0 : lerp(0, CAP_ON, easeIn(clamp01(1 + d / CAP_REST)))

// 구간 위에 있는 칸이면 from에서 몇 칸째인지. 구간을 벗어나면 null
const stepsTo = (event: PathEvent, p: Point) => {
  const dx = Math.sign(event.to.x - event.from.x)
  const dy = Math.sign(event.to.y - event.from.y)
  const along = (p.x - event.from.x) * dx + (p.y - event.from.y) * dy
  const onLine = event.from.x + dx * along === p.x && event.from.y + dy * along === p.y
  return onLine && along >= 0 && along <= cellsOf(event) ? along : null
}

interface CapTouch {
  phase: number // 갓에 올라선 뒤 흐른 칸 수
  rest: boolean // 큐브가 그 갓에 올라선 채로 끝나는지
  deep: number
}

// 튕겨 가는 이동에서 at칸째 갓에 올라서는 자리. 건너뛰기만 하는 칸이면 null
const hopTouch = (cells: number, at: number) => {
  const lead = cells % 2
  const bounces = (cells - lead) / 2
  if (at === cells) return { start: hopSpan(cells), index: -1, rest: true }
  if (at < lead || (at - lead) % 2 !== 0) return null

  const index = (at - lead) / 2
  if (index >= bounces) return null
  // 앞선 갓들에서 머문 몫이 밀린다
  const waited = index * (CAP_PRESS.press + CAP_PRESS.spring) - (index > 0 ? capFrom(0, lead) : 0)
  return { start: at + waited, index, rest: false }
}

// 큐브나 상자가 그 갓을 딛고 얼마나 지났는지. 이 길에서 딛지 않는 칸이면 null
const capTouch = (
  segments: Segment[],
  cell: Point,
  elapsed: number,
  chain: Chain,
): CapTouch | null => {
  const step = stepAt(segments, Math.max(0, elapsed), chain)
  if (!step) return null

  let before = 0
  const touches: { arrive: number; rest: boolean; deep: number; from: number; index: number }[] = []
  let now = 0
  for (const [i, { event }] of segments.entries()) {
    const cells = cellsOf(event)
    const hopped = hopCells(event) > 0
    const at = stepsTo(event, cell)
    const touch =
      at === null
        ? null
        : hopped
          ? hopTouch(cells, at)
          : at === cells
            ? { start: at, index: -1, rest: true }
            : null

    if (touch) {
      const lead = cells % 2
      touches.push({
        arrive: before + touch.start,
        rest: touch.rest,
        deep: touch.rest ? CAP_ON : capDeep(touch.index, lead),
        from: touch.rest ? 0 : capFrom(touch.index, lead),
        index: i,
      })
    }
    if (i === step.index) now = before + (hopped ? hopSpan(cells) : cells) * step.p
    before += hopped ? hopSpan(cells) : cells
  }

  // 내 이동으로 올라선 갓에서 바람에 밀려 튀면 바람이 분 뒤로는 튕기는 갓을 그린다
  const wait = segments.findIndex((s) => s.wait)
  const blown = touches.filter((touch) => wait >= 0 && step.index > wait && touch.index > wait)
  const found = blown[0] ?? touches[0]
  if (!found) return null
  return { phase: now - found.arrive + found.from, rest: found.rest, deep: found.deep }
}

export interface MushroomFrame {
  cell: Point
  press: number // 갓이 눌린 정도. -1은 펴짐, 0은 평소, 1은 눌림, 2는 큐브가 올라섬
  wither: number // 시든 정도 0~1
}

// 칸마다의 버섯 모습. 지나간 순서대로 눌렸다 펴지고 밟힌 것은 큐브가 떠난 뒤에 시든다
export const mushroomFrames = (
  prev: GameState | null,
  game: GameState,
  events: GameEvent[],
  t: number,
  chain: Chain = NO_CHAIN,
): MushroomFrame[] => {
  const cells = readMushrooms(game.stage)
  if (cells.length === 0) return []

  const still = (cell: Point): MushroomFrame => ({
    cell,
    press: same(game.player, cell) ? CAP_ON : 0,
    wither: has(game.mushrooms, cell) ? 0 : 1,
  })
  if (!prev || t >= 1) return cells.map(still)

  const elapsed = elapsedAt(events, swampTime(prev, game), t)
  const walked = slideChain(events, chain)
  const walks = [playerSegments(events), segmentsOf(boxPath(events))]

  return cells.map((cell) => {
    const touched = walks
      .map((segments) => capTouch(segments, cell, elapsed, walked))
      .filter((touch): touch is CapTouch => touch !== null)
    if (touched.length === 0) return still(cell)

    const touch = touched.reduce((a, b) => (a.phase > b.phase ? a : b))
    const dried = has(prev.mushrooms, cell) && !has(game.mushrooms, cell)

    return {
      cell,
      press: touch.rest ? capRestAt(touch.phase) : capSpringAt(touch.phase, touch.deep),
      wither: dried
        ? clamp01((touch.phase - CAP_WITHER.from) / CAP_WITHER.span)
        : has(game.mushrooms, cell)
          ? 0
          : 1,
    }
  })
}

// 무너지는 칸이 닳는 진행도. 튕겨 가는 이동은 큐브가 내려앉기 시작한 뒤에야 닳는다
export const crackProgress = (events: GameEvent[], t: number) => {
  const hop = playerSegments(events).some(({ event }) => hopCells(event) > 0)
  return hop ? clamp01((t - CRACK_HOP_FROM) / (1 - CRACK_HOP_FROM)) : t
}

export type VineKind = 'root' | 'grown' | 'next' | 'future' | 'spent'

export interface VineLook {
  kind: VineKind
  enter: Direction | null // 줄기가 들어오는 방향. 뿌리는 null
  leave: Direction | null // 줄기가 나가는 방향
  hard: boolean // 굳은 덩굴의 자란 칸
  knot: boolean // 굳은 덩굴의 끝 칸이라 봉오리로 닫힘
}

// 덩굴 뿌리와 길 칸마다 무엇을 그릴지. 키는 "x-y"다
// 씨앗으로 솟은 칸과 층 수. 원본이 바닥이고 무너지는 칸이 아닌 칸이 원본보다 높아진 만큼이다
export const seedLayers = (stage: Stage, heights: number[][]): Map<string, number> => {
  const layers = new Map<string, number>()
  heights.forEach((row, y) =>
    row.forEach((h, x) => {
      const origin = stage.heights[y][x]
      const crack = (stage.cracks?.[y]?.[x] ?? '.') !== '.'
      if (origin >= 0 && !crack && h > origin) layers.set(`${x}-${y}`, h - origin)
    }),
  )
  return layers
}

export interface SeedFrame {
  level: number // 그 순간 칸 윗면 높이
  land: number // 볏짚빛 층 수
  tree: number // 사라지는 나무 단계. 남은 수이고 0이면 없음
  treeNext: number // 들어서는 나무 단계
  treeP: number // tree에서 treeNext로 바뀐 정도 0~1
  stakes: number
  stakesNext: number
  stakeP: number
  leaves: number // 솟은 땅에 남은 잎이 드러난 정도 0~1
  stalk: number // 보스 기둥 줄기 층 수
  bud: number // 봉오리가 돋은 정도 0~1
}

interface SeedLook {
  level: number
  land: number
  left: number
  leaves: number
  stalk: number
  bud: number
}

const seedLook = (state: GameState, key: string, layers: Map<string, number>): SeedLook => {
  const [x, y] = key.split('-').map(Number)
  const land = layers.get(key) ?? 0
  const left = state.planted.find((seed) => seed.x === x && seed.y === y)?.left ?? 0
  const boss = Boolean(state.stage.rules?.seedGrow)
  return {
    level: state.heights[y][x],
    land,
    left,
    leaves: land > 0 && !boss && left === 0 ? 1 : 0,
    stalk: boss ? land : 0,
    bud: boss && land > 0 && left === 0 ? 1 : 0,
  }
}

const blendSeed = (was: SeedLook, now: SeedLook, p: number): SeedFrame => ({
  level: lerp(was.level, now.level, p),
  land: lerp(was.land, now.land, p),
  tree: was.left,
  treeNext: now.left,
  treeP: p,
  stakes: was.left,
  stakesNext: now.left,
  stakeP: p,
  leaves: lerp(was.leaves, now.leaves, p),
  stalk: lerp(was.stalk, now.stalk, p),
  bud: lerp(was.bud, now.bud, p),
})

// 나무는 칸 오른쪽 모서리의 흙 자리에서 자라고 흙 자리는 윗면에서 이만큼 솟는다
export const SAPLING = { spot: 0.36, soil: 2 }

// 심는 수는 튀어 떨어진 씨앗이 흙 자리에 닿을 즈음부터 싹과 말뚝이 드러난다
const PLANT_FROM = 0.6
export interface PlantingFrame {
  go: number // 큐브 윗면에서 흙 자리까지 간 정도 0~1
  hop: number // 떨어지는 길에서 솟은 높이 px
  scale: number
  opacity: number
}

// 심는 수에 들고 있던 씨앗이 흙 자리로 내려가 묻힌다. 심지 않는 수는 null
export const plantingSeed = (
  events: GameEvent[],
  t: number,
  swamp: SwampTime = NO_SWAMP,
): PlantingFrame | null => {
  if (!events.some((e) => e.type === 'planted')) return null

  const p = ownProgress(events, t, swamp)
  const q = clamp01((p - PLANT_SEED.pop) / PLANT_SEED.travel)
  const go = q * q * (3 - 2 * q)
  return {
    go,
    hop: Math.sin(Math.PI * q) * PLANT_SEED.hop,
    scale: lerp(1, PLANT_SEED.small, go),
    opacity: 1 - clamp01((p - PLANT_SEED.fadeFrom) / PLANT_SEED.fade),
  }
}

interface PlantView {
  planting: PlantingFrame | null
  cubeScreen: Point
  cubeSink: number
  cube: Pick<CubeFrame, 'lift'>
}

// 심는 수에 들고 있던 씨앗이 큐브 윗면에서 그 칸의 흙 자리로 내려간다
export const plantedSeedAt = ({ planting, cubeScreen, cubeSink, cube }: PlantView) => {
  const soilSpot = isoDelta(SAPLING.spot, -SAPLING.spot)
  return (
    planting && {
      x: cubeScreen.x + soilSpot.x * planting.go,
      y:
        lerp(
          cubeScreen.y - TILE.layer + cubeSink - cube.lift,
          cubeScreen.y + soilSpot.y - SAPLING.soil + cubeSink,
          planting.go,
        ) - planting.hop,
      scale: planting.scale,
      opacity: planting.opacity,
    }
  )
}

// 튀어 오르기 전까지는 턱 쪽으로 기운 큐브 윗면에 얹혀 있고 떨어지는 동안 기울기를 벗는다
export const plantTiltOf = (
  planting: PlantingFrame | null,
  cube: Pick<CubeFrame, 'angle' | 'direction'>,
): TopTilt | undefined =>
  planting
    ? (u, v, z) => {
        const d = tiltOnTop(cube.direction, cube.angle)(u, v, z)
        return { x: d.x * (1 - planting.go), y: d.y * (1 - planting.go) }
      }
    : undefined

const seedKeys = (state: GameState, layers: Map<string, number>) => [
  ...layers.keys(),
  ...state.planted.map(({ x, y }) => `${x}-${y}`),
]

// 씨앗이 있거나 솟은 칸마다 이 순간의 모습. 심기와 자람은 한 수 전체에, 솟기는 이동 뒤에 걸친다
export const seedFrames = (
  prev: GameState | null,
  game: GameState,
  events: GameEvent[],
  t: number,
  swamp: SwampTime = NO_SWAMP,
  restarting = false,
): Map<string, SeedFrame> => {
  const after = seedLayers(game.stage, game.heights)
  if (!prev || t >= 1) {
    return new Map(
      seedKeys(game, after).map((key) => {
        const look = seedLook(game, key, after)
        return [key, blendSeed(look, look, 1)]
      }),
    )
  }

  const before = seedLayers(prev.stage, prev.heights)
  const keys = new Set([...seedKeys(game, after), ...seedKeys(prev, before)])
  const step = stepProgress(events, t, swamp)
  const rise = riseProgress(events, t, swamp)
  const eventAt = (type: 'planted' | 'rose', key: string) =>
    events.some((e) => e.type === type && `${e.at.x}-${e.at.y}` === key)

  return new Map(
    [...keys].map((key) => {
      const p = restarting
        ? t * t * (3 - 2 * t)
        : eventAt('rose', key)
          ? rise
          : eventAt('planted', key)
            ? clamp01((step - PLANT_FROM) / (1 - PLANT_FROM))
            : step
      return [key, blendSeed(seedLook(prev, key, before), seedLook(game, key, after), p)]
    }),
  )
}

export const vineLooks = (state: GameState): Map<string, VineLook> => {
  const looks = new Map<string, VineLook>()
  const vines = state.stage.entities.filter((e) => e.type === 'vine')

  vines.forEach((vine, i) => {
    const { grown, stopped } = state.vines[i]
    const line = [{ x: vine.x, y: vine.y }, ...vine.cells]
    const look = (kind: VineKind, enter: Direction | null, leave: Direction | null) => ({
      kind,
      enter,
      leave,
      hard: false,
      knot: false,
    })

    looks.set(`${vine.x}-${vine.y}`, look('root', null, directionBetween(line[0], line[1])))
    vine.cells.forEach((cell, k) => {
      const enter = directionBetween(line[k], cell)
      // 끝 칸은 들어온 쪽으로 곧게 나간다
      const leave = line[k + 2] ? directionBetween(cell, line[k + 2]) : enter
      const kind = k < grown ? 'grown' : stopped ? 'spent' : k === grown ? 'next' : 'future'
      const hard = stopped && k < grown
      looks.set(`${cell.x}-${cell.y}`, {
        ...look(kind, enter, leave),
        hard,
        knot: hard && k === grown - 1,
      })
    })
  })

  return looks
}

// 싹 키 px. 다음 자랄 칸이 더 크다
export const VINE_SPROUT = { next: 24, future: 14 }
// 다음 자랄 칸으로 넘어온 혀의 길이. 칸 단위다
export const VINE_TONGUE = 0.2
// 줄기 끝은 한 수에 한 칸을 같은 빠르기로 간다. 혀 끝에서 출발해 이 몫에 칸 끝에 닿고 남은 몫에 다음 칸 혀가 된다
const VINE_TIP = 1 - VINE_TONGUE
// 이 수의 진행도에서 시작하는 자리와 걸리는 몫
const VINE_RISE = { from: 0, span: 1 } // 판이 구덩이에서 차오름
const VINE_NEXT = { from: 0, span: 1 } // 새 다음 칸의 싹이 큼
const VINE_HARD = { from: 0.4, span: 0.6 } // 굳음

export interface VineFrame {
  kind: VineKind
  enter: Direction | null
  leave: Direction | null
  growth: number // 줄기가 칸을 건너는 진행도 0~1. 이 수에 자라는 칸만 1보다 작다
  rise: number // 판이 구덩이에서 차오른 정도 0~1
  tongue: number // 다음 칸으로 넘어온 혀 길이 0~1
  sprout: number // 싹 키 px. 0이면 없음
  sproutOpacity: number
  hard: number // 굳은 정도 0~1
  knot: number // 봉오리가 돋은 정도 0~1
  opacity: number // 줄기와 잎의 투명도. 재시작하면 사라진다
}

// 이 수에서 덩굴이 움직이는 진행도 0~1. 늪에서 뽑혀 나오는 동안은 0이다
export const vineProgress = (events: GameEvent[], t: number, swamp: SwampTime = NO_SWAMP) => {
  const moving = moveSeconds(events, swamp) - swamp.lead
  return moving <= 0 ? 1 : clamp01(elapsedAt(events, swamp, t) / moving)
}

const stillVine = (look: VineLook): VineFrame => ({
  kind: look.kind,
  enter: look.enter,
  leave: look.leave,
  growth: 1,
  rise: 1,
  tongue: look.kind === 'next' ? 1 : 0,
  sprout: look.kind === 'next' ? VINE_SPROUT.next : look.kind === 'future' ? VINE_SPROUT.future : 0,
  sproutOpacity: 1,
  hard: look.hard ? 1 : 0,
  knot: look.knot ? 1 : 0,
  opacity: 1,
})

const phase = (p: number, { from, span }: { from: number; span: number }) =>
  easeOut(clamp01((p - from) / span))

// 덩굴 칸마다 이 순간의 모습. 자라기, 굳기, 재시작 되돌림을 앞뒤 모습 차이로 가른다
export const vineFrames = (
  prev: GameState | null,
  game: GameState,
  events: GameEvent[],
  t: number,
  swamp: SwampTime = NO_SWAMP,
  restarting = false,
): Map<string, VineFrame> => {
  const after = vineLooks(game)
  if (!prev || t >= 1) return new Map([...after].map(([key, look]) => [key, stillVine(look)]))

  const before = vineLooks(prev)
  const p = restarting ? 0 : vineProgress(events, t, swamp)
  const back = easeOut(t)
  const hard = phase(p, VINE_HARD)

  return new Map(
    [...after].map(([key, look]): [string, VineFrame] => {
      const was = before.get(key) ?? look
      const still = stillVine(look)

      // 재시작하면 자란 칸의 판이 구덩이로 내려가고 그 자리에 싹이 다시 돋는다
      if (restarting) {
        if (was.kind === 'grown' && look.kind !== 'grown') {
          return [
            key,
            {
              ...stillVine(was),
              rise: 1 - back,
              opacity: 1 - back,
              sprout: still.sprout,
              sproutOpacity: back,
            },
          ]
        }
        return [key, was.kind === 'spent' ? { ...still, sproutOpacity: back } : still]
      }

      if (was.kind === 'next' && look.kind === 'grown') {
        const rise = phase(p, VINE_RISE)
        return [
          key,
          {
            ...still,
            growth: clamp01(p / VINE_TIP),
            rise,
            sprout: VINE_SPROUT.next,
            sproutOpacity: 1 - rise,
          },
        ]
      }
      if (was.kind === 'future' && look.kind === 'next') {
        return [
          key,
          {
            ...still,
            tongue: clamp01((p - VINE_TIP) / (1 - VINE_TIP)),
            sprout: lerp(VINE_SPROUT.future, VINE_SPROUT.next, phase(p, VINE_NEXT)),
          },
        ]
      }
      if (was.kind === 'grown' && look.hard && !was.hard) {
        return [key, { ...still, hard, knot: look.knot ? hard : 0 }]
      }
      // 굳은 덩굴의 남은 자리는 혀가 물러나고 싹이 사라진다
      if (look.kind === 'spent' && was.kind !== 'spent') {
        return [
          key,
          {
            ...stillVine(was),
            tongue: was.kind === 'next' ? 1 - hard : 0,
            sproutOpacity: 1 - hard,
          },
        ]
      }
      return [key, still]
    }),
  )
}
