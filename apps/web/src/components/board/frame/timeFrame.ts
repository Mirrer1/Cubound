import { type Chain, clamp01, moveEase } from './curveFrame'
import type { GameEvent, Point } from '@/game/types'

export const SECONDS = {
  moved: 0.24,
  pushed: 0.26,
  filled: 0.34, // 가라앉는 몫까지 담은 구덩이 메우는 밀기
  fell: 0.32,
  climbed: 0.3,
  blocked: 0.2,
  placed: 0.22,
  planted: 0.44,
  tram: 0.24,
}

// 상자와 큐브가 나란히 가는 칸당 같은 속도, max는 아주 긴 미끄러짐의 상한
const SLIDE = { perCell: 0.1, max: 0.9 }

// 연쇄가 길어져도 같은 속도인 칸 수 비례 시간, peak는 튕김 한 번의 꼭대기 높이 px
// max는 갓마다 머무는 몫까지 담아 버섯 셋을 잇는 일곱 칸(1.9초)도 넘지 않는 상한
export const HOP = { perCell: 0.19, max: 2, peak: 32 }

// 큐브가 갓에 올라선 뒤 눌리고 펴지고 돌아오는 구간, 칸 수 단위
// press와 spring의 합 1칸은 갓 위에 머무는 시간, recover는 큐브가 날아간 뒤의 몫
export const CAP_PRESS = { press: 0.55, spring: 0.45, recover: 1.1 }

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

// 미끄러지면 여러 구간으로 이어지는 한 이동
export type PathEvent = Extract<
  GameEvent,
  { type: 'moved' | 'fell' | 'climbed' | 'slid' | 'pushed' }
>

export const cellsOf = (event: PathEvent) =>
  Math.abs(event.to.x - event.from.x) + Math.abs(event.to.y - event.from.y)

// 튕겨 간 이동의 칸 수, 미끄러짐 말고 두 칸 넘게 가는 것은 버섯 하나
export const hopCells = (event: PathEvent) =>
  event.type === 'slid' || event.type === 'climbed' || cellsOf(event) < 2 ? 0 : cellsOf(event)

const secondsOf = (event: PathEvent) =>
  event.type === 'slid'
    ? Math.min(SLIDE.max, SLIDE.perCell * cellsOf(event))
    : hopCells(event) > 0
      ? Math.min(HOP.max, HOP.perCell * hopSpan(hopCells(event)))
      : event.type === 'pushed' && event.result === 'filled'
        ? SECONDS.filled
        : SECONDS[event.type]

// 기다리는 구간이 섞일 수 있어 이벤트와 따로 두는 길이
export interface Segment {
  event: PathEvent
  seconds: number
  wait?: boolean // 내 이동 연출이 끝나고 바람이 불기를 기다리는 구간
}

export const segmentsOf = (path: PathEvent[]): Segment[] =>
  path.map((event) => ({ event, seconds: secondsOf(event) }))

export const totalSeconds = (segments: Segment[]) => segments.reduce((sum, s) => sum + s.seconds, 0)

export const playerPath = (events: GameEvent[]) =>
  events.filter(
    (e): e is PathEvent =>
      e.type === 'moved' ||
      e.type === 'fell' ||
      e.type === 'climbed' ||
      (e.type === 'slid' && e.subject === 'player'),
  )

export const boxPath = (events: GameEvent[]) =>
  events.filter(
    (e): e is PathEvent => e.type === 'pushed' || (e.type === 'slid' && e.subject === 'box'),
  )

export const same = (a: Point, b: Point) => a.x === b.x && a.y === b.y

export const has = (list: Point[], p: Point) => list.some((q) => same(q, p))

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

// 메우는 중인 칸에 큐브가 뜨지 않게 늦추는 다가가는 속도, 멈추면 걸리는 느낌
export const playerSegments = (events: GameEvent[]): Segment[] => {
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

// 큐브와 상자가 다 움직인 뒤에 따로 붙는 씨앗이 솟는 시간
const RISE_SECONDS = 0.36

// 솟기를 뺀 이동 몫의 연출 시간
export const moveSeconds = (events: GameEvent[], swamp: SwampTime) =>
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

export const rises = (events: GameEvent[]) => events.some((e) => e.type === 'rose')

export const durationOf = (events: GameEvent[], swamp: SwampTime = NO_SWAMP) =>
  moveSeconds(events, swamp) + (rises(events) ? RISE_SECONDS : 0)

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

interface Step {
  event: PathEvent
  index: number
  p: number
}

// 경과 시간이 들어 있는 구간, 큐브와 상자가 한 이동 안에서 같이 끝나는 제 길이
export const stepAt = (segments: Segment[], seconds: number, chain: Chain): Step | null => {
  let start = 0
  for (const [index, { event, seconds: span }] of segments.entries()) {
    const last = index === segments.length - 1
    if (seconds < start + span || last) {
      const local = span === 0 ? 1 : Math.min(1, Math.max(0, (seconds - start) / span))
      // 바람을 기다리는 구간 앞뒤의 멈춤과 재출발
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

// 이미 올라서 있던 갓은 눌린 채 시작, 남는 것은 펴지는 몫
export const capFrom = (index: number, lead: number) =>
  index === 0 && lead === 0 ? CAP_PRESS.press : 0

// 머무름까지 더한 이동 길이, HOP.perCell을 그대로 곱하는 칸 수 단위
export const hopSpan = (cells: number) => {
  const lead = cells % 2
  const bounces = (cells - lead) / 2
  return cells + bounces * (CAP_PRESS.press + CAP_PRESS.spring) - capFrom(0, lead)
}
