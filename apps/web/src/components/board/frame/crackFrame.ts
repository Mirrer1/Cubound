import { clamp01, easeIn, easeOut, lerp } from './curveFrame'
import { hopCells, playerSegments, same } from './timeFrame'
import type { GameEvent, GameState, Point } from '@/game/types'

// 단계가 오르는 앞부분과 가라앉아 사라지는 뒷부분, 가라앉음은 이동 연출 거의 전부
const CRUMBLE = { deepen: 0.9, fallFrom: 0.12, drop: 1.6, shadow: 0.9 }

// 튕겨 가는 이동에서 무너지는 칸이 닳기 시작하는 지점, 큐브가 꼭대기를 지나 내려오는 때
const CRACK_HOP_FROM = 0.5

// 닳은 단계마다의 내려앉은 화면 거리와 옆면 두께
const CRACK_SINK = [0, 8, 15]

const CRACK_THICKNESS = [13, 9, 5]

export interface CrackFrame {
  stage: number // 닳은 단계 0~2, 오를수록 얇고 낮은 칸
  broken: number // 네 조각으로 갈라져 벌어진 정도, 0을 넘는 것은 무너질 때 한정
  fall: number // 아래로 내려간 층 수
  opacity: number
  shadow: number // 무너진 자리에 깔리는 그림자 진하기
}

// left는 앞으로 견디는 횟수, -1은 바닥 없는 칸
const stageOf = (left: number) => (left > 1 ? 0 : left === 1 ? 1 : 2)

// 단계 사이 값은 앞뒤 단계를 섞은 값
export const atStage = (steps: number[], stage: number) => {
  const i = Math.min(steps.length - 2, Math.max(0, Math.floor(stage)))
  return lerp(steps[i], steps[i + 1], clamp01(stage - i))
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
    // 초반에 거의 다 벌어지는 갈라짐, 그 뒤로는 떨어지기 하나
    broken: falling ? easeOut(Math.min(1, p / 0.45)) : 0,
    fall: CRUMBLE.drop * easeIn(p),
    opacity: 1 - p * p,
    shadow: CRUMBLE.shadow * easeOut(p) * (1 - p ** 4),
  }
}

// 무너지는 칸이 앞으로 견디는 횟수, 목록에 없는 칸은 바닥 없는 칸과 같은 값
export const crackLeft = (state: Pick<GameState, 'cracks'>, p: Point) =>
  state.cracks.find((c) => same(c, p))?.left ?? -1

export interface CrackView {
  game: Pick<GameState, 'cracks'>
  before: Pick<GameState, 'cracks'>
  crackPhase: number
}

// 닳을수록 내려앉는 무너지는 칸, 그 위에 선 것도 같은 만큼 하강
export const sinkAt = ({ game, before, crackPhase }: CrackView, p: Point) => {
  const left = crackLeft(game, p)
  const was = crackLeft(before, p)
  return Math.max(left, was) >= 0 ? crackSink(crackFrame(was, left, crackPhase).stage) : 0
}

// 칸 사이를 지나는 동안은 앞뒤 칸의 내려앉은 양을 섞은 값
export const standSink = (view: CrackView, x: number, y: number) => {
  const x0 = Math.floor(x)
  const x1 = Math.ceil(x)
  const y0 = Math.floor(y)
  const y1 = Math.ceil(y)
  const near = lerp(sinkAt(view, { x: x0, y: y0 }), sinkAt(view, { x: x1, y: y0 }), x - x0)
  const far = lerp(sinkAt(view, { x: x0, y: y1 }), sinkAt(view, { x: x1, y: y1 }), x - x0)
  return lerp(near, far, y - y0)
}

// 무너지는 칸이 닳는 진행도, 튕겨 가는 이동은 큐브가 내려앉기 시작한 뒤
export const crackProgress = (events: GameEvent[], t: number) => {
  const hop = playerSegments(events).some(({ event }) => hopCells(event) > 0)
  return hop ? clamp01((t - CRACK_HOP_FROM) / (1 - CRACK_HOP_FROM)) : t
}
