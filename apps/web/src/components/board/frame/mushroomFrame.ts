import { atStage } from './crackFrame'
import { type Chain, NO_CHAIN, clamp01, easeIn, easeOut, lerp } from './curveFrame'
import { slideChain } from './iceFrame'
import { swampTime } from './swampFrame'
import {
  CAP_PRESS,
  type CountView,
  HOP,
  type PathEvent,
  type Segment,
  boxPath,
  capFrom,
  cellsOf,
  countDisplay,
  durationOf,
  elapsedAt,
  has,
  hopCells,
  hopSpan,
  playerSegments,
  same,
  segmentsOf,
  stepAt,
} from './timeFrame'
import { TILE } from '@/game/iso'
import { capsLeft, readMushrooms, standHeight } from '@/game/rules'
import type { GameEvent, GameState, Point } from '@/game/types'

// 큐브가 올라서서 눌린 채 남는 갓이 눌리는 몫, 머무름 대신 쓰는 이동의 끝자락
const CAP_REST = 0.4

// 밟힌 버섯이 시드는 구간, 갓에 올라선 때부터 잰 칸 수, 시작은 머무름 1칸 뒤
const CAP_WITHER = { from: 1.2, span: 1.4 }

// 큐브가 올라선 갓의 press 값
const CAP_ON = 2

// 구르는 것은 갓으로 걸어 들어가는 첫 한 칸 하나, 날아가는 동안은 각도 0
export const hopAngle = (cells: number, u: number) => {
  const lead = cells % 2
  return lead === 0 || u >= lead ? 0 : (Math.PI / 2) * (u / lead)
}

// 튕겨 가는 큐브가 u칸째에 딛는 칸의 높이, 밟는 칸은 갓 칸과 양 끝
export const hopLevel = (
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

// 튕김마다 꼭대기에 더 솟는 px, 한 층 넘게 솟은 사이 벽을 넘는 몫
export const hopClear = (
  state: GameState,
  event: PathEvent,
  cells: number,
  fromLevel: number,
  toLevel: number,
) => {
  const dx = Math.sign(event.to.x - event.from.x)
  const dy = Math.sign(event.to.y - event.from.y)
  const lead = cells % 2
  const floorOf = (n: number) =>
    n === 0
      ? fromLevel
      : n === cells
        ? toLevel
        : (state.heights[event.from.y + dy * n]?.[event.from.x + dx * n] ?? fromLevel)
  const clear: number[] = []
  for (let a = lead; a < cells; a += 2) {
    const wall = { x: event.from.x + dx * (a + 1), y: event.from.y + dy * (a + 1) }
    const middle = (floorOf(a) + floorOf(a + 2)) / 2
    const over =
      (state.heights[wall.y]?.[wall.x] ?? -1) < 0 ? 0 : standHeight(state, wall) - middle - 1
    // 9는 높은 벽 위로 여유 있게 넘어가는 몫
    clear.push(over > 0 ? over * TILE.layer + 9 : 0)
  }
  return clear
}

// 펴짐, 평소, 눌림, 올라섬 순서의 갓 높이, press에 1을 더한 자리
const CAP_STEM = [18, 14, 9, 2]

const CAP_WIDTH = [0.44, 0.48, 0.54, 0.66]

const CAP_THICK = [6, 6, 5, 3]

const CAP_CROWN = [3, 3, 2, 0]

// 평소, 시드는 중, 시든 뒤 순서의 갓 높이, wither에 2를 곱한 자리
const DRY_STEM = [14, 8, 3]

const DRY_WIDTH = [0.48, 0.5, 0.56]

const DRY_THICK = [6, 4, 3]

const DRY_CROWN = [3, 2, 2]

const capTop = (i: number) => CAP_STEM[i] + CAP_THICK[i] + CAP_CROWN[i]

// 못 뛰어서 올라선 큐브가 눌린 갓 위에 서는 높이
export const MUSHROOM_STAND = capTop(3)

// 큐브가 막 올라선 평소 갓의 꼭대기, 머무름이 끝나고 날아오르는 높이
export const CAP_TOP_IDLE = capTop(1)

const CAP_TOP_SPRING = capTop(0)

export interface MushroomPose {
  stem: number
  cap: number // 칸 폭에 대한 갓 너비 비율
  thick: number
  crown: number
}

// press는 -1(펴짐)에서 2(큐브가 올라섬)까지, wither는 0에서 1까지의 값
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

// 갓이 눌린 정도에 따른 갓 꼭대기 높이, 큐브가 얹히는 자리
const capTopAt = (press: number) => {
  const pose = mushroomPose(press, 0)
  return pose.stem + pose.thick + pose.crown
}

// 그 갓이 다 눌렸을 때 값, 올라서 있던 갓은 큐브가 얹혀 더 눌린 값
const capDeep = (index: number, lead: number) => (index === 0 && lead === 0 ? CAP_ON : 1)

interface HopStep {
  u: number // 실제로 간 칸 수
  index: number // 지금 딛고 있는 갓 번호, 딛고 있지 않으면 -1
  phase: number // 그 갓에 올라선 뒤 흐른 칸 수
}

// 머무름까지 더한 자리 q의 실제 자리, 갓을 딛는 동안 멈춘 u
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

// 진행도 p일 때 실제로 간 칸 비율, 갓을 딛는 동안은 제자리
export const hopProgress = (cells: number, p: number) =>
  hopStepAt(cells, hopSpan(cells) * p).u / cells

// 머무름까지 더한 자리 q에서 떠오른 화면 거리, land는 도착 칸에서 앉는 높이
export const hopLift = (cells: number, q: number, land: number, clear: number[] = []) => {
  const lead = cells % 2
  const bounces = (cells - lead) / 2
  const { u, index, phase } = hopStepAt(cells, q)

  // 머무는 동안은 눌렸다 펴지는 갓과 함께 오르내리는 큐브
  if (index >= 0) return capTopAt(capSpringAt(phase, capDeep(index, lead)))
  // 걸어 들어가는 한 칸은 평소 높이 갓 위로 올라서는 몫
  if (u < lead) return lerp(0, CAP_TOP_IDLE, clamp01(u / lead))

  const b = Math.min(bounces - 1, Math.floor((u - lead) / 2))
  const s = clamp01((u - lead) / 2 - b)
  // 이어지는 갓에는 평소 높이, 마지막에는 땅 높이
  // 마지막에 갓 위에 내려서면 평소 높이로 내린 뒤 눌리는 갓
  const to = b + 1 < bounces || land > 0 ? CAP_TOP_IDLE : land
  const flying = lerp(CAP_TOP_SPRING, to, s) + (HOP.peak + (clear[b] ?? 0)) * Math.sin(Math.PI * s)
  return land > 0 ? restLift(q - hopSpan(cells), flying) : flying
}

// 큐브가 버섯 갓 위에 서 있는 높이, 그 칸에 서 있지 않으면 0
export const capHeight = (state: GameState | null, p: Point) =>
  state && has(state.mushrooms, p) ? MUSHROOM_STAND : 0

// 큐브가 올라선 뒤 눌리고 펴지는 튕겨 보내는 갓, c는 올라선 뒤 흐른 칸 수
const capSpringAt = (c: number, deep: number) =>
  c <= 0
    ? 0
    : c <= CAP_PRESS.press
      ? lerp(0, deep, easeOut(c / CAP_PRESS.press))
      : c <= CAP_PRESS.press + CAP_PRESS.spring
        ? lerp(deep, -1, easeIn((c - CAP_PRESS.press) / CAP_PRESS.spring))
        : lerp(-1, 0, clamp01((c - CAP_PRESS.press - CAP_PRESS.spring) / CAP_PRESS.recover))

// 갓에 올라서기까지 걷는 몫, 남은 CAP_REST는 눌리는 몫
export const restWalk = (cells: number) => Math.max(0.01, cells - CAP_REST)

// 갓 위에 내려서는 끝자락, 다 내려서기 전은 walking, 그 뒤는 눌리는 갓
export const restLift = (phase: number, walking: number) =>
  phase <= -CAP_REST ? walking : capTopAt(capRestAt(phase))

const capRestAt = (d: number) =>
  d <= -CAP_REST ? 0 : lerp(0, CAP_ON, easeIn(clamp01(1 + d / CAP_REST)))

// 구간 위 칸이 from에서 몇 칸째인지, 구간을 벗어나면 null
const stepsTo = (event: PathEvent, p: Point) => {
  const dx = Math.sign(event.to.x - event.from.x)
  const dy = Math.sign(event.to.y - event.from.y)
  const along = (p.x - event.from.x) * dx + (p.y - event.from.y) * dy
  const onLine = event.from.x + dx * along === p.x && event.from.y + dy * along === p.y
  return onLine && along >= 0 && along <= cellsOf(event) ? along : null
}

interface CapTouch {
  phase: number // 갓에 올라선 뒤 흐른 칸 수
  rest: boolean // 큐브가 그 갓에 올라선 채로 끝나는지 여부
  deep: number
}

// 튕겨 가는 이동에서 at칸째 갓에 올라서는 자리, 건너뛰기만 하는 칸이면 null
const hopTouch = (cells: number, at: number) => {
  const lead = cells % 2
  const bounces = (cells - lead) / 2
  if (at === cells) return { start: hopSpan(cells), index: -1, rest: true }
  if (at < lead || (at - lead) % 2 !== 0) return null

  const index = (at - lead) / 2
  if (index >= bounces) return null
  // 앞선 갓들에서 머문 만큼 밀리는 시각
  const waited = index * (CAP_PRESS.press + CAP_PRESS.spring) - (index > 0 ? capFrom(0, lead) : 0)
  return { start: at + waited, index, rest: false }
}

// 큐브나 상자가 그 갓을 딛고 지난 시간, 이 길에서 딛지 않는 칸이면 null
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

  // 내 이동으로 올라선 갓에서 바람에 밀려 튀면 바람이 분 뒤로는 튕기는 갓
  const wait = segments.findIndex((s) => s.wait)
  const blown = touches.filter((touch) => wait >= 0 && step.index > wait && touch.index > wait)
  const found = blown[0] ?? touches[0]
  if (!found) return null
  return { phase: now - found.arrive + found.from, rest: found.rest, deep: found.deep }
}

export interface MushroomFrame {
  cell: Point
  press: number // 갓이 눌린 정도, -1은 펴짐, 0은 평소, 1은 눌림, 2는 큐브가 올라선 상태
  wither: number // 시든 정도 0~1
}

// 칸마다의 버섯 모습, 지나간 순서대로 눌렸다 펴지고 큐브가 떠난 뒤 시드는 밟힌 갓
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

// 시들기 시작하는 때를 찾는 연출 진행도 간격 수
const WITHER_SAMPLES = 200

// 밟혀 시든 갓마다 시들기 시작하는 초, 이른 순서
export const witherSeconds = (prev: GameState, game: GameState, events: GameEvent[]) => {
  const dried = prev.mushrooms.filter((cell) => !has(game.mushrooms, cell))
  if (dried.length === 0) return []

  const duration = durationOf(events, swampTime(prev, game))
  const starts = dried.map(() => duration)
  for (let i = 0; i < WITHER_SAMPLES; i += 1) {
    const frames = mushroomFrames(prev, game, events, i / WITHER_SAMPLES)
    dried.forEach((cell, k) => {
      const wither = frames.find((f) => same(f.cell, cell))?.wither ?? 0
      if (wither > 0 && starts[k] === duration) starts[k] = (duration * i) / WITHER_SAMPLES
    })
  }
  return starts.sort((a, b) => a - b)
}

export const capsDisplay = (view: CountView) => countDisplay(view, capsLeft, witherSeconds)
