import { type Lane, TAP, type WaterAt, channelCells, pullLanes } from '../view'
import { clamp01, lerp } from './curveFrame'
import { has, same } from './pathFrame'
import { restartPhase } from './restartFrame'
import { pressProgress } from './switchFrame'
import { SLUICE, type SwampTime, sluicePhase, sluiceStart } from './timeFrame'
import { waterLevel } from '@/game/rules'
import type { GameEvent, GameState, Point, Stage } from '@/game/types'

type Phase = ReturnType<typeof sluicePhase>

const DONE: Phase = { tap: 1, level: 1, freeze: 1, thaw: 1, slab: 1 }

const hasSluice = (stage: Stage) => stage.entities.some((e) => e.type === 'sluice')

// 수 전후 칸의 물 높이를 level만큼 섞은 그 순간 높이, 수위 없는 판은 판의 물 높이
export const waterAtOf = (before: GameState, game: GameState, level: number): WaterAt => {
  if (!hasSluice(game.stage)) {
    const water = game.stage.water ?? 0
    return () => water
  }
  return (p) => lerp(waterLevel(before, p), waterLevel(game, p), level)
}

interface SceneView {
  before: GameState
  game: GameState
  events: GameEvent[]
  t: number
  swamp: SwampTime
  moving: boolean
  dropping: boolean
  lanes: Map<string, Lane>
}

// 그 순간 판 전체의 수위 값, still은 이 수가 끝난 물 높이, laneFade는 물이 바뀌며 생기거나 끊기는 물길 띠 진하기
export const sluiceScene = ({
  before,
  game,
  events,
  t,
  swamp,
  moving,
  dropping,
  lanes,
}: SceneView) => {
  if (!hasSluice(game.stage)) {
    const still = waterAtOf(game, game, 1)
    return { phase: DONE, waterAt: still, still, lanes, laneFade: null }
  }

  const back = restartPhase(t, game.boxes.length, game.stones.length)
  const phase = dropping
    ? { tap: back, level: back, freeze: back, thaw: back, slab: back }
    : moving
      ? sluicePhase(events, t, swamp)
      : DONE
  const was = pullLanes(game.stage, (p) => waterLevel(before, p))
  const union = new Map([...was, ...lanes])
  const laneFade = new Map(
    [...union.keys()].map((key) => [
      key,
      lanes.has(key) ? (was.has(key) ? 1 : phase.level) : 1 - phase.level,
    ]),
  )
  return {
    phase,
    waterAt: waterAtOf(before, game, phase.level),
    still: waterAtOf(game, game, 1),
    lanes: union,
    laneFade,
  }
}

// 장치 위로 올라온 물건 앞에 다시 그리는 꼭지와 그 물건을 그리는 칸, 앞 칸 차례 물건은 장치 칸 가운데에서 반 칸 안 기준
export const tapFronts = (stage: Stage, holders: { x: number; y: number; cell: Point }[]) =>
  stage.entities.flatMap((device) => {
    if (device.type !== 'sluice') return []
    const at = { x: device.x, y: device.y }
    const holder = holders.find((h) => {
      const off = Math.max(Math.abs(h.x - at.x), Math.abs(h.y - at.y))
      return same(h.cell, at) ? off <= 1 : h.cell.x + h.cell.y > at.x + at.y && off <= 0.5
    })
    return holder ? [{ device: at, cell: holder.cell }] : []
  })

const wet = (state: GameState, p: Point) => {
  const h = state.stage.heights[p.y][p.x]
  return h >= 0 && h < waterLevel(state, p)
}

// 멈춰 선 돌 밑 얼음 판 진하기, 잠길 때는 둘레보다 먼저 얼고 드러날 때는 둘레가 다 녹은 뒤 녹는 값
export const stoneSlab = (before: GameState, game: GameState, phase: Phase, p: Point) => {
  const was = wet(before, p)
  const now = wet(game, p)
  return now && !was
    ? clamp01(phase.level / SLUICE.afloat)
    : was && !now
      ? 1 - phase.slab
      : now
        ? 1
        : 0
}

// 물길 띠 진하기에 물이 바뀌며 생기거나 끊기는 몫을 곱한 값
export const fadeLanes = (shown: Map<string, number>, fade: Map<string, number> | null) =>
  fade ? new Map([...shown].map(([key, v]) => [key, v * (fade.get(key) ?? 1)])) : shown

export interface SluiceLook {
  device: boolean // 수위 장치 칸
  open: number // 꼭지가 열린 정도 0~1
  turn: number // 바퀴가 돈 정도 0~1, 물이 다 차오를 때까지 이어서 도는 값
  plate: number // 판 두께 px, 장치 칸이 아니면 0
  channel: 'x' | 'y' | null // 갑문 물길 홈 방향
  flow: number // 홈에 물이 흐르는 정도 0~1
  sunk: number // 집이 물에 잠긴 정도 0~1
}

const NO_SLUICE: SluiceLook = {
  device: false,
  open: 0,
  turn: 0,
  plate: 0,
  channel: null,
  flow: 0,
  sunk: 0,
}

interface LookScene {
  before: GameState
  moving: boolean
  dropping: boolean
  sluice: { phase: Phase; waterAt: WaterAt }
}

interface LookView {
  game: GameState
  events: GameEvent[]
  t: number
  swamp: SwampTime
}

// 칸마다 수위 장치, 물길 홈, 잠긴 집의 모습
export const sluiceLookOf = (
  { before, moving, dropping, sluice }: LookScene,
  { game, events, t, swamp }: LookView,
) => {
  const { phase, waterAt } = sluice
  const { stage } = game
  if (!hasSluice(stage)) return () => NO_SLUICE

  const channels = channelCells(stage)
  const changing = moving && !dropping && sluiceStart(events) !== null
  // 꼭지에서 물길로 물이 오가는 진행도, 꼭지와 수면 시간 비율로 이은 값
  const span = (phase.tap * SLUICE.tap + phase.level * SLUICE.level) / (SLUICE.tap + SLUICE.level)

  return (p: Point): SluiceLook => {
    const device = stage.entities.some((e) => e.type === 'sluice' && same(e, p))
    const channel = channels.get(`${p.x}-${p.y}`) ?? null
    const goal = same(stage.goal, p)
    if (!device && !channel && !goal) return NO_SLUICE

    const pressed = (state: GameState) =>
      same(state.player, p) || has(state.boxes, p) || has(state.stones, p) ? 1 : 0
    const was = pressed(before)
    const now = pressed(game)
    const press = dropping
      ? phase.level
      : moving
        ? pressProgress(events, p, now === 1, t, swamp)
        : 1
    const depth = (on: number) => (on ? TAP.pressed : TAP.depth)

    return {
      device,
      open: device ? lerp(was, now, changing ? phase.tap : press) : 0,
      turn: device ? lerp(was, now, changing ? span : press) : 0,
      plate: device ? lerp(depth(was), depth(now), press) : 0,
      channel,
      flow: channel && changing ? Math.sin(Math.PI * span) : 0,
      sunk: goal ? clamp01(waterAt(p) - stage.heights[p.y][p.x]) : 0,
    }
  }
}
