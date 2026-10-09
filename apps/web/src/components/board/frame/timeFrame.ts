import { clamp01, smooth } from './curveFrame'
import { fireEnd } from './fireFrame'
import {
  type PathEvent,
  SECONDS,
  type Segment,
  boxPath,
  cellsOf,
  playerPath,
  secondsOf,
  segmentsOf,
  stonePath,
  totalSeconds,
} from './pathFrame'
import { same } from '@/game/rules'
import type { GameEvent, GameState, Point } from '@/game/types'

// 내 이동 연출 뒤에 붙는 바람에 밀려 미끄러지는 시간과 기대서 버티는 시간
export const WIND = { slide: 0.3, brace: 0.3 }

// 짝 칸으로 가라앉는 시간, 짝인 칸에서 솟아오르는 시간, 잠기는 층 수
export const WARP = { sink: 0.2, rise: 0.2, depth: 0.6 }

// over는 버둥마다 그 수의 자리보다 더 솟는 몫, peak는 솟는 데 쓰는 몫, fill은 잠긴 상자 위로 땅이 드러나는 지점
// lead는 상자가 칸에 닿기 전에 미리 가라앉는 시간, 닿는 순간 이미 진흙에 밀려 들어간 모습
export const SWAMP = {
  sink: 0.28,
  struggle: 0.3,
  rise: 0.2,
  box: 0.36,
  lead: 0.09,
  over: 0.4285,
  peak: 0.42,
  fill: 0.5,
}

// 상자가 멈추면서 그 칸을 메우거나 아래층으로 떨어지는 마지막 구간
const boxLanding = (events: GameEvent[]) => {
  const landing = boxPath(events).at(-1)
  return landing?.type === 'pushed' && landing.result !== 'slid' ? landing : null
}

// 큐브가 가는 마지막 한 칸, 여러 칸 미끄러졌으면 그 앞에서 끊은 칸
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

// 바람이 분 수에서 바람 앞의 내 이동 이벤트, 바람이 안 분 수면 null
const ownPart = (events: GameEvent[]) => {
  const at = events.findIndex(isWind)
  return at < 0 ? null : events.slice(0, at)
}

// 내 이동 연출이 다 끝난 뒤에 이어지는 바람에 밀려 가는 길
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

// 밀린 얼음 돌을 뒤따라 미끄러지는 큐브의 늦춘 길, 돌이 가로로 다 간 뒤 도착
const behindStone = (events: GameEvent[], segments: Segment[]): Segment[] => {
  const stone = segmentsOf(stonePath(events))
  const end = stone.at(-1)
  const sliding = segments.some((s) => s.event.type === 'slid')
  if (!end || !sliding) return segments

  const floated = end.event.type === 'pushed' && end.event.result === 'floated'
  const arrive = totalSeconds(stone) - (floated ? end.seconds * (1 - FLOAT_REACH) : 0)
  const own = totalSeconds(segments)
  const slower = own > 0 && arrive > own ? arrive / own : 1
  return segments.map((s) => ({ ...s, seconds: s.seconds * slower }))
}

// 메우는 중인 칸에 큐브가 뜨지 않게 늦추는 다가가는 속도, 멈추면 걸리는 느낌
export const playerSegments = (events: GameEvent[]): Segment[] => {
  const own = ownPart(events)
  if (own) return windSegments(events, own)

  const path = playerPath(events)
  const landing = boxLanding(events)
  const last = path.at(-1)
  if (!landing || !last || !same(last.to, landing.to)) return behindStone(events, segmentsOf(path))

  const { before, tile } = lastTile(last)
  const approach = segmentsOf([...path.slice(0, -1), ...(before ? [before] : [])])
  const reach = totalSeconds(approach)
  const settle = totalSeconds(segmentsOf(boxPath(events)))
  const slower = reach > 0 && settle > reach ? settle / reach : 1

  return [...approach.map((s) => ({ ...s, seconds: s.seconds * slower })), ...segmentsOf([tile])]
}

// 이동보다 길게 두는 칸이 무너지는 순간, 한 단계 닳는 변화는 이동 길이 안
const CRUMBLE_SECONDS = 0.36

// 미끄러져 지나온 칸에 남는 서리 자국이 옅어지는 시간
export const FROST_FADE = 0.2

interface Stamp {
  p: Point
  at: number // 미끄러지며 그 칸을 떠난 시각
}

// 큐브나 상자가 서 있는 미끄러짐이 멈춘 칸은 자국 제외
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

export const frostStamps = (events: GameEvent[]) => [
  ...slideStamps(playerSegments(events)),
  ...slideStamps(segmentsOf(boxPath(events))),
]

// 큐브나 상자가 그 칸에 닿는 시각과 떠나는 시각
export const touchAt = (events: GameEvent[], p: Point) => {
  let arrive: number | null = null
  let leave: number | null = null
  for (const segments of [
    playerSegments(events),
    segmentsOf(boxPath(events)),
    segmentsOf(stonePath(events)),
  ]) {
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
export const SWITCH_SECONDS = 0.3

// 연출할 시간을 남기는 가장 늦은 때, 눌림은 구간 끝, 풀림은 구간 시작
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
export const LADDER_SECONDS = 0.16

// 큐브가 사다리 칸에 닿는 시각, 이 이동에서 집지 않으면 null
export const pickUpAt = (events: GameEvent[]) => {
  const picked = events.find((e) => e.type === 'pickedUp')
  return picked?.type === 'pickedUp' ? touchAt(events, picked.at).arrive : null
}

const pickUpEnd = (events: GameEvent[]) => {
  const at = pickUpAt(events)
  return at === null ? 0 : at + LADDER_SECONDS
}

// 큐브가 짝 칸에 닿는 시각, 이 이동에서 순간이동하지 않으면 null
export const warpAt = (events: GameEvent[]) => {
  const warped = events.find((e) => e.type === 'warped')
  return warped?.type === 'warped' ? touchAt(events, warped.from).arrive : null
}

const warpEnd = (events: GameEvent[]) => {
  const at = warpAt(events)
  return at === null ? 0 : at + WARP.sink + WARP.rise
}

export type TramEvent = Extract<GameEvent, { type: 'tram' }>

export const tramMoves = (events: GameEvent[]) =>
  events.filter((e): e is TramEvent => e.type === 'tram')

// 이 이동에서 큐브나 상자가 새로 올라선 발판 여부
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

// 발판이 출발하는 시각, 새로 올라타는 것이 있으면 자리에 앉은 뒤
export const tramStart = (events: GameEvent[]) => {
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

// 늪 연출에 더 드는 시간, lead는 이동 앞쪽, tail은 뒤쪽
export interface SwampTime {
  lead: number // 뽑혀 나오기를 기다리는 시간
  tail: number // 가라앉기를 기다리는 시간
}

export const NO_SWAMP: SwampTime = { lead: 0, tail: 0 }

// 늪에 밀려 들어간 상자가 다 잠기는 시각, 가라앉기 시작은 밀기가 끝나기 전
export const sinkEnd = (events: GameEvent[]) =>
  events.some((e) => e.type === 'sank')
    ? totalSeconds(segmentsOf(boxPath(events))) - SWAMP.lead + SWAMP.box
    : 0

// 끌린 배가 한 칸 가는 가장 짧은 시간, 이 수에 띄우거나 내린 배는 늦게 출발하는 몫
export const PULL_SECONDS = 0.3

type Pulled = Extract<GameEvent, { type: 'pulled' | 'stonePulled' }>

// 물에 떨어뜨리는 밀기에서 상자가 물 칸 위로 다 밀려 오는 구간 진행도
export const FLOAT_REACH = 0.5

// 물에 떨어뜨리는 밀기에서 가장 깊이 잠기는 진행도, 아무리 높은 데서 떨어져도 수면에 닿는 때
export const FLOAT_RISE = 0.75

// 그 자리 배가 떠나도 되는 때, 이 수에 띄운 배와 돌은 물에 다 내려앉은 뒤, 큐브가 내린 배는 큐브가 반쯤 굴러 나간 뒤
const freeAt = (events: GameEvent[], from: Point) => {
  for (const path of [segmentsOf(boxPath(events)), segmentsOf(stonePath(events))]) {
    if (path.length > 0 && same(path[path.length - 1].event.to, from)) return totalSeconds(path)
  }

  let start = 0
  for (const { event, seconds, wait } of playerSegments(events)) {
    if (!wait && same(event.from, from)) return start + seconds / 2
    start += seconds
  }
  return 0
}

// 물이 바뀌는 수에 꼭지가 열리거나 닫히는 시간과 수면이 오르내리는 시간, afloat은 끌림과 얼기가 시작하는 수면 진행도
export const SLUICE = { tap: 0.12, level: 0.48, afloat: 0.5 }

// 물이 바뀌기 시작하는 때, 큐브와 상자와 돌이 다 움직인 뒤, 물이 그대로인 수는 null
export const sluiceStart = (events: GameEvent[]) =>
  events.some((e) => e.type === 'sluice')
    ? Math.max(
        totalSeconds(playerSegments(events)),
        totalSeconds(segmentsOf(boxPath(events))),
        totalSeconds(segmentsOf(stonePath(events))),
      )
    : null

// 꼭지가 열리는 시간, 꼭지 없는 밀물은 0
const tapSeconds = (events: GameEvent[]) =>
  events.some((e) => e.type === 'sluice' && e.tide) ? 0 : SLUICE.tap

const sluiceEnd = (events: GameEvent[]) => {
  const at = sluiceStart(events)
  return at === null ? 0 : at + tapSeconds(events) + SLUICE.level
}

// 물이 바뀌는 수에 떠오른 배가 끌리고 새로 잠긴 칸이 얼기 시작하는 때
const sluiceAfloat = (events: GameEvent[]) => {
  const at = sluiceStart(events)
  return at === null ? 0 : at + tapSeconds(events) + SLUICE.level * SLUICE.afloat
}

// 큐브가 돌 옆 언 칸에서 미끄러져 다 나가는 때, 그 전에 돌이 떠나면 큐브 밑 얼음이 녹는 탓
const slidOff = (events: GameEvent[], stone: Point) => {
  let start = 0
  let end = 0
  for (const { event, seconds } of playerSegments(events)) {
    const next = Math.abs(event.from.x - stone.x) + Math.abs(event.from.y - stone.y) === 1
    if (event.type === 'slid' && next) end = start + seconds
    start += seconds
  }
  return end
}

// 끌린 배가 혼자 출발할 수 있는 때, 물이 바뀌는 수는 수면이 반쯤 움직인 뒤
const freeToPull = (events: GameEvent[], pulled: Pulled) => {
  // 잠기는 땅에서 이 수에 새로 뜬 배는 수면이 다 오른 뒤
  const lifted = events.some(
    (e) => e.type === 'sluice' && e.up && e.cells.some((cell) => same(cell, pulled.from)),
  )
  return Math.max(
    freeAt(events, pulled.from),
    lifted ? sluiceEnd(events) : sluiceAfloat(events),
    pulled.type === 'stonePulled' ? slidOff(events, pulled.from) : 0,
  )
}

// 이 수에 끌리는 배와 돌이 같이 출발하는 때, 가장 늦게 풀려나는 것 기준
export const pullStart = (events: GameEvent[]) =>
  Math.max(
    0,
    ...events.flatMap((e) =>
      e.type === 'pulled' || e.type === 'stonePulled' ? [freeToPull(events, e)] : [],
    ),
  )

const pullEnd = (events: GameEvent[]) =>
  Math.max(
    0,
    ...events.map((e) =>
      e.type === 'pulled' || e.type === 'stonePulled' ? pullStart(events) + PULL_SECONDS : 0,
    ),
  )

// 마개의 구간, 상자가 소용돌이 칸까지 밀리고 빨려 들고 소용돌이가 막히는 시간
export const PLUG = { push: 0.3, suck: 0.36, close: 0.36 }

// 소용돌이 칸으로 밀리기 시작하는 때, 이 수에 막지 않으면 null
export const plugStart = (events: GameEvent[]) => {
  if (!events.some((e) => e.type === 'plugged')) return null

  const segments = segmentsOf(boxPath(events))
  return totalSeconds(segments.slice(0, -1))
}

const plugEnd = (events: GameEvent[]) => {
  const at = plugStart(events)
  return at === null ? 0 : at + PLUG.push + PLUG.suck + PLUG.close
}

// 큐브와 상자가 다 움직인 뒤에 따로 붙는 씨앗이 솟는 시간
const RISE_SECONDS = 0.36

// 솟기를 뺀 이동 몫의 연출 시간
export const moveSeconds = (events: GameEvent[], swamp: SwampTime) =>
  swamp.lead +
  Math.max(
    0,
    totalSeconds(playerSegments(events)) + swamp.tail,
    totalSeconds(segmentsOf(boxPath(events))),
    totalSeconds(segmentsOf(stonePath(events))),
    freezeEnd(events),
    switchEnd(events),
    pickUpEnd(events),
    warpEnd(events),
    tramEnd(events),
    sinkEnd(events),
    pullEnd(events),
    plugEnd(events),
    sluiceEnd(events),
    fireEnd(events, playerSegments(events), swamp.tail),
    ...events.map((e) =>
      e.type === 'blocked' || e.type === 'placed' || e.type === 'planted' ? SECONDS[e.type] : 0,
    ),
    ...events.map((e) => (e.type === 'cracked' && e.gone ? CRUMBLE_SECONDS : 0)),
    ...events.map((e) => (e.type === 'struggled' ? SWAMP.struggle : 0)),
    ...frostStamps(events).map((stamp) => stamp.at + FROST_FADE),
  ) +
  (events.some((e) => e.type === 'braced') ? WIND.brace : 0)

export const rises = (events: GameEvent[]) => events.some((e) => e.type === 'rose')

// 돌을 민 수에 얼음이 덮이고 물러나는 시간, 돌이 먼저 멈춰도 이어지는 몫
export const FREEZE_SECONDS = 0.42
export const thaws = (events: GameEvent[]) =>
  events.some((e) => e.type === 'froze' || e.type === 'thawed')

// 돌을 민 수에 얼음이 다 덮이는 때, 물로 떨어지는 돌은 가장 늦게 수면에 닿는 때부터 얼음 덮임 시간
export const freezeEnd = (events: GameEvent[]) => {
  if (sluiceStart(events) !== null && thaws(events)) {
    return events.some((e) => e.type === 'froze')
      ? Math.max(sluiceEnd(events), sluiceAfloat(events) + FREEZE_SECONDS)
      : sluiceEnd(events)
  }
  const segments = segmentsOf(stonePath(events))
  const last = segments.at(-1)
  if (!last || !thaws(events)) return 0
  const to = last.event.to
  const floated = last.event.type === 'pushed' && last.event.result === 'floated'
  // 같은 수에 끌려가는 돌은 끌려가며 옮겨 가는 얼음 몫
  const pulled = events.some((e) => e.type === 'stonePulled' && same(e.from, to))
  return floated && !pulled
    ? totalSeconds(segments) - last.seconds * (1 - FLOAT_RISE) + FREEZE_SECONDS
    : FREEZE_SECONDS
}

// 이동이 다 끝난 뒤 얼음 돌이 녹아 사라지는 시간
export const MELT_SECONDS = 0.42

export const durationOf = (events: GameEvent[], swamp: SwampTime = NO_SWAMP) =>
  moveSeconds(events, swamp) +
  (rises(events) ? RISE_SECONDS : 0) +
  (events.some((e) => e.type === 'melted') ? MELT_SECONDS : 0)

// 물이 바뀌는 수의 꼭지, 수면, 새로 잠긴 칸이 어는 진행도, 드러나는 칸이 녹는 진행도와 그 뒤 돌 밑 판이 녹는 진행도, 물이 그대로인 수는 모두 1
export const sluicePhase = (events: GameEvent[], t: number, swamp: SwampTime = NO_SWAMP) => {
  const at = sluiceStart(events)
  if (at === null) return { tap: 1, level: 1, freeze: 1, thaw: 1, slab: 1 }

  const now = elapsedAt(events, swamp, t)
  const tap = tapSeconds(events)
  const afloat = at + tap + SLUICE.level * SLUICE.afloat
  return {
    tap: tap === 0 ? 1 : smooth(clamp01((now - at) / tap)),
    level: smooth(clamp01((now - at - tap) / SLUICE.level)),
    freeze: smooth(clamp01((now - afloat) / FREEZE_SECONDS)),
    thaw: smooth(clamp01((now - at) / FREEZE_SECONDS)),
    slab: smooth(clamp01((now - at - FREEZE_SECONDS) / (tap + SLUICE.level - FREEZE_SECONDS))),
  }
}

// 이동 몫의 진행도, 씨앗이 솟는 수는 솟기 전에 1
export const stepProgress = (events: GameEvent[], t: number, swamp: SwampTime = NO_SWAMP) => {
  const moving = moveSeconds(events, swamp)
  return moving <= 0 ? 1 : clamp01((t * durationOf(events, swamp)) / moving)
}

// 가속해 오르다 끝에서 느려지는 씨앗이 솟는 진행도
export const riseProgress = (events: GameEvent[], t: number, swamp: SwampTime = NO_SWAMP) => {
  if (!rises(events)) return 1

  const p = clamp01((t * durationOf(events, swamp) - moveSeconds(events, swamp)) / RISE_SECONDS)
  return p * p * (3 - 2 * p)
}

// 이동이 시작한 뒤로 흐른 시간, 늪에서 뽑혀 나오기를 기다리는 동안은 음수
export const elapsedAt = (events: GameEvent[], swamp: SwampTime, t: number) =>
  t * durationOf(events, swamp) - swamp.lead

export interface CountView {
  game: GameState | null
  prevGame: GameState | null
  events: GameEvent[]
  animating: boolean
  passed: number // 이 수의 연출에서 이미 지난 숫자가 바뀌는 순간 수
}

type Moments = (prev: GameState, game: GameState, events: GameEvent[]) => number[]

// 지난 순간 수만큼만 다음 숫자로 다가간 보스 숫자, at은 연출이 시작한 뒤 숫자가 바뀌는 초
export const countDisplay = (
  { game, prevGame, events, animating, passed }: CountView,
  count: (state: GameState) => number | null,
  moments: Moments,
) => {
  const after = game ? count(game) : null
  const before = prevGame ? count(prevGame) : null
  if (!game || !prevGame || !animating || after === null || before === null)
    return { at: [], count: after }

  const at = moments(prevGame, game, events)
  const step = Math.min(passed, Math.abs(after - before))
  return { at, count: passed >= at.length ? after : before + Math.sign(after - before) * step }
}
