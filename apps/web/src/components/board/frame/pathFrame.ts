import { type Chain, moveEase } from './curveFrame'
import { same } from '@/game/rules'
import type { GameEvent, Point } from '@/game/types'

export const SECONDS = {
  moved: 0.24,
  pushed: 0.26,
  filled: 0.34, // 가라앉는 몫까지 담은 구덩이 메우는 밀기
  floated: 0.6, // 잠겼다 떠오르는 몫까지 담은 물에 떨어뜨리는 밀기
  fell: 0.32,
  climbed: 0.3,
  blocked: 0.2,
  placed: 0.22,
  planted: 0.44,
  tram: 0.24,
  rowed: 0.3,
}

// 상자와 큐브가 나란히 가는 칸당 같은 속도, max는 아주 긴 미끄러짐의 상한
const SLIDE = { perCell: 0.14, max: 1.2 }

// 연쇄가 길어져도 같은 속도인 칸 수 비례 시간, peak는 튕김 한 번의 꼭대기 높이 px
// max는 갓마다 머무는 몫까지 담아 버섯 셋을 잇는 일곱 칸(1.9초)도 넘지 않는 상한
export const HOP = { perCell: 0.19, max: 2, peak: 32 }

// 큐브가 갓에 올라선 뒤 눌리고 펴지고 돌아오는 구간, 칸 수 단위
// press와 spring의 합 1칸은 갓 위에 머무는 시간, recover는 큐브가 날아간 뒤의 몫
export const CAP_PRESS = { press: 0.55, spring: 0.45, recover: 1.1 }

// 미끄러지면 여러 구간으로 이어지는 한 이동
export type PathEvent = Extract<
  GameEvent,
  { type: 'moved' | 'fell' | 'climbed' | 'slid' | 'pushed' | 'rowed' }
>

export const cellsOf = (event: PathEvent) =>
  Math.abs(event.to.x - event.from.x) + Math.abs(event.to.y - event.from.y)

// 튕겨 간 이동의 칸 수, 미끄러짐 말고 두 칸 넘게 가는 것은 버섯 하나
export const hopCells = (event: PathEvent) =>
  event.type === 'slid' || event.type === 'climbed' || cellsOf(event) < 2 ? 0 : cellsOf(event)

export const secondsOf = (event: PathEvent) =>
  event.type === 'slid'
    ? Math.min(SLIDE.max, SLIDE.perCell * cellsOf(event))
    : hopCells(event) > 0
      ? Math.min(HOP.max, HOP.perCell * hopSpan(hopCells(event)))
      : event.type === 'pushed' && (event.result === 'filled' || event.result === 'floated')
        ? SECONDS[event.result]
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
      e.type === 'rowed' ||
      (e.type === 'slid' && e.subject === 'player'),
  )

export const boxPath = (events: GameEvent[]) =>
  events.filter(
    (e): e is PathEvent =>
      e.type === 'pushed' || e.type === 'rowed' || (e.type === 'slid' && e.subject === 'box'),
  )

// 상자와 같은 시간 몫인 얼음 돌이 밀려 가는 길, 물에 뜬 채 한 칸은 저어 가기 몫
export const stonePath = (events: GameEvent[]) =>
  events.flatMap((e): PathEvent[] =>
    e.type === 'stonePushed'
      ? [
          e.result === 'rowed'
            ? { ...e, type: 'rowed' }
            : { ...e, type: 'pushed', result: e.result },
        ]
      : e.type === 'slid' && e.subject === 'stone'
        ? [e]
        : [],
  )

export { same }

export const has = (list: Point[], p: Point) => list.some((q) => same(q, p))

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
