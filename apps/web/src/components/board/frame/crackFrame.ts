import { clamp01, easeIn, easeOut, lerp, smooth } from './curveFrame'
import { same } from './pathFrame'
import { type SwampTime, crackLeave, durationOf } from './timeFrame'
import { toScreen } from '@/game/iso'
import type { GameEvent, GameState, Point } from '@/game/types'

// 단계가 오르는 앞부분과 가라앉아 사라지는 뒷부분, 가라앉음은 이동 연출 거의 전부
const CRUMBLE = { deepen: 0.9, fallFrom: 0.12, drop: 1.6, shadow: 0.9 }

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
  const falling = before >= 0 && after < 0
  // 재시작으로 돌아온 무너진 칸은 닳은 단계 없이 원래 모습
  const rising = before < 0 && after >= 0
  const stage = rising
    ? stageOf(after)
    : lerp(stageOf(before), stageOf(after), easeOut(Math.min(1, t / CRUMBLE.deepen)))
  const p = falling ? Math.min(1, Math.max(0, (t - CRUMBLE.fallFrom) / (1 - CRUMBLE.fallFrom))) : 0

  return {
    stage,
    // 초반에 거의 다 벌어지는 갈라짐, 그 뒤로는 떨어지기 하나
    broken: falling ? easeOut(Math.min(1, p / 0.45)) : 0,
    fall: CRUMBLE.drop * easeIn(p),
    opacity: rising ? t : 1 - p * p,
    shadow: CRUMBLE.shadow * easeOut(p) * (1 - p ** 4),
  }
}

// 무너지는 칸이 앞으로 견디는 횟수, 목록에 없는 칸은 바닥 없는 칸과 같은 값
export const crackLeft = (state: Pick<GameState, 'cracks'>, p: Point) =>
  state.cracks.find((c) => same(c, p))?.left ?? -1

// 한 번 이상 밟혀 내려앉은 칸
export const crackSunk = (state: Pick<GameState, 'cracks'>, p: Point) => {
  const left = crackLeft(state, p)
  return left >= 0 && left <= 1
}

const CLIP_FAR = 20

// 내려앉은 칸에 걸친 큐브에서 바닥면 아래로 앞 칸에 묻히는 몫을 뺀 영역
// 큐브 앞 가장자리와 걸친 내려앉은 칸 앞 가장자리 중 앞쪽 선 기준, 앞 칸이 낮은 가장자리는 제외
export const crackClip = (view: CrackView, heights: number[][], x: number, y: number) => {
  const xs = [Math.floor(x), Math.ceil(x)]
  const ys = [Math.floor(y), Math.ceil(y)]
  const sunk = xs.flatMap((cx) =>
    ys.filter((cy) => sinkAt(view, { x: cx, y: cy }) > 0.01).map((cy) => ({ x: cx, y: cy })),
  )
  if (sunk.length === 0) return null

  // 큐브 높이가 아닌 내려앉은 칸 높이 기준, 높이가 바뀌는 이동 중에도 같은 선
  const level = Math.max(...sunk.map((p) => heights[p.y][p.x]))
  const covers = (px: number, py: number) => (heights[py]?.[px] ?? -1) >= level
  const edgeX = Math.max(x, ...sunk.map((p) => p.x)) + 0.5
  const edgeY = Math.max(y, ...sunk.map((p) => p.y)) + 0.5
  // 앞 칸도 내려앉았으면 그만큼 낮춘 가장자리 선
  const dropOf = (cells: Point[]) => {
    const front = cells.filter((p) => covers(p.x, p.y))
    return front.length === 0 ? null : Math.min(...front.map((p) => sinkAt(view, p)))
  }
  const dropX = dropOf(sunk.map((p) => ({ x: Math.round(edgeX + 0.5), y: p.y })))
  const dropY = dropOf(sunk.map((p) => ({ x: p.x, y: Math.round(edgeY + 0.5) })))
  if (dropX === null && dropY === null) return null

  const ex = dropX === null ? edgeX + CLIP_FAR : edgeX
  const ey = dropY === null ? edgeY + CLIP_FAR : edgeY
  const at = (px: number, py: number, drop: number) => {
    const p = toScreen({ x: px, y: py }, level)
    return { x: p.x, y: p.y + drop }
  }
  const left = at(edgeX - CLIP_FAR, ey, dropY ?? 0)
  const right = at(ex, edgeY - CLIP_FAR, dropX ?? 0)
  // 기울기가 +0.5인 left 쪽 선과 -0.5인 right 쪽 선이 만나는 점
  const cornerX = right.y - left.y + (left.x + right.x) / 2
  const corner = { x: cornerX, y: left.y + (cornerX - left.x) / 2 }
  const top = Math.min(left.y, right.y) - 10000
  return [left, { x: left.x, y: top }, { x: right.x, y: top }, right, corner]
    .map((p) => `${p.x},${p.y}`)
    .join(' ')
}

export interface CrackView {
  game: Pick<GameState, 'cracks'>
  before: Pick<GameState, 'cracks'>
  crackPhase: number
  phaseAt?: (p: Point) => number // 칸마다 닳기 시작하는 때가 다른 수의 칸별 진행도
  shaking?: Point[] // 다 닳은 채 새로 올라선 것이 있어 흔들리는 칸
  shakePhase?: number
}

// 다 닳은 칸이 흔들리는 세기와 왕복 횟수
const SHAKE = { px: 2, times: 1.5 }

// 흔들리는 칸의 그 순간 위아래 거리, 부드럽게 잦아듦
const shakeAt = (view: CrackView, p: Point) => {
  if (!view.shaking?.some((q) => same(q, p))) return 0
  const u = view.shakePhase ?? 0
  return SHAKE.px * Math.sin(u * Math.PI * 2 * SHAKE.times) * (1 - smooth(u))
}

export const phaseOf = (view: CrackView, p: Point) => view.phaseAt?.(p) ?? view.crackPhase

// 이 수에 무너지는 칸의 남은 진하기, 그 칸 쪽 구덩이 벽도 같은 진하기
export const crumbleShown = (view: CrackView, p: Point) => {
  const was = crackLeft(view.before, p)
  const left = crackLeft(view.game, p)
  return was >= 0 && left < 0 ? crackFrame(was, left, phaseOf(view, p)).opacity : 1
}

// 닳을수록 내려앉는 무너지는 칸, 그 위에 선 것도 같은 만큼 하강
export const sinkAt = (view: CrackView, p: Point) => {
  const left = crackLeft(view.game, p)
  const was = crackLeft(view.before, p)
  return Math.max(left, was) >= 0
    ? crackSink(crackFrame(was, left, phaseOf(view, p)).stage) + shakeAt(view, p)
    : 0
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

// 무너지는 칸이 닳는 진행도, 닳기 시작하는 때부터 수 끝까지
export const crackProgress = (events: GameEvent[], t: number, swamp?: SwampTime, at?: Point) => {
  const total = durationOf(events, swamp)
  const leave = crackLeave(events, at)
  return total <= leave ? 1 : clamp01((t * total - leave) / (total - leave))
}
