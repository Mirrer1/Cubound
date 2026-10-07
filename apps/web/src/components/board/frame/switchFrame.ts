import { lerp, smooth } from './curveFrame'
import { boxPath, cellsOf, has, same, segmentsOf } from './pathFrame'
import {
  NO_SWAMP,
  SWITCH_SECONDS,
  type SwampTime,
  elapsedAt,
  playerSegments,
  sluicePhase,
  sluiceStart,
  touchAt,
} from './timeFrame'
import { TILE } from '@/game/iso'
import { isDoorOpen, isLiftRaised } from '@/game/rules'
import type { Entity, GameEvent, GameState, Point, Stage } from '@/game/types'

// cells 중 한 칸이 pressed 상태가 되는 시각, 이 이동에서 닿지 않는 칸뿐이면 null
const pressedAt = (events: GameEvent[], cells: Point[], pressed: boolean) => {
  const times = cells
    .map((p) => (pressed ? touchAt(events, p).arrive : touchAt(events, p).leave))
    .filter((at): at is number => at !== null)

  return times.length === 0 ? null : Math.min(...times)
}

// 스위치와 엮인 문과 발판의 진행도 0~1, 눌림이 바뀌지 않는 이동은 이동 전체
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

// 스위치 자신이 눌리고 풀리는 짧은 시간, 닿아서 생기는 일
const PRESS_SECONDS = 0.06

// 접촉이 바뀌는 순간에 맞춘 스위치, 눌림의 끝은 닿는 때, 풀림의 시작은 떠나는 때
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

// 미끄러져 지나가는 칸의 스위치가 눌렸다 돌아오는 정도 0~1, 앞뒤 반 칸씩 걸치는 시간
// 이 이동에서 걸어 들어와 바로 미끄러져 나가는 출발 칸 포함
export const passDip = (events: GameEvent[], p: Point, t: number, swamp: SwampTime = NO_SWAMP) => {
  const now = elapsedAt(events, swamp, t)
  let dip = 0
  for (const segments of [playerSegments(events), segmentsOf(boxPath(events))]) {
    let start = 0
    let arrived = false
    for (const { event, seconds, wait } of segments) {
      const cells = cellsOf(event)
      const step = Math.abs(p.x - event.from.x) + Math.abs(p.y - event.from.y)
      const dx = Math.sign(event.to.x - event.from.x)
      const dy = Math.sign(event.to.y - event.from.y)
      const passing =
        event.type === 'slid' &&
        !wait &&
        (step > 0 || arrived) &&
        step < cells &&
        same(p, { x: event.from.x + dx * step, y: event.from.y + dy * step })
      if (passing) {
        const cell = seconds / cells
        const u = (now - start - cell * (step - 1)) / (cell * 2)
        if (u > 0 && u < 1) dip = Math.max(dip, Math.sin(Math.PI * u))
      }
      start += seconds
      arrived = !wait && same(event.to, p)
    }
  }
  return dip
}

export const switchCells = (stage: Stage, target: string): Point[] =>
  stage.entities.filter((e) => e.type === 'switch' && e.target === target)

// 그 칸의 발판이 오르내리는 진행도, 물이 바뀌는 수는 수면 진행도, 발판 칸이 아니면 이동 전체
export const ridePhase = (
  game: GameState,
  events: GameEvent[],
  p: Point,
  t: number,
  swamp: SwampTime,
) => {
  if (sluiceStart(events) !== null) return sluicePhase(events, t, swamp).level
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

export interface SwitchLook {
  entity: 'switch' | 'door' | null
  switchDepth: number
  doorDepth: number
  lift: boolean
  warp: boolean
}

interface SwitchScene {
  before: GameState
  moving: boolean
  dropping: boolean
  progress: number
}

interface SwitchView {
  stage: Stage
  game: GameState
  events: GameEvent[]
  t: number
  swampSeconds: SwampTime
  back: number
}

export const switchLookOf = (
  scene: SwitchScene,
  { stage, game, events, t, swampSeconds, back }: SwitchView,
) => {
  // 문과 발판이 움직이기 시작하는 때, 스위치가 눌리거나 풀린 때
  const linkedPhase = (cells: Point[], pressed: boolean) =>
    scene.dropping
      ? back
      : scene.moving
        ? switchProgress(events, cells, pressed, t, swampSeconds)
        : 1

  return (cell: { p: Point }): { raised: number; device: SwitchLook } => {
    const entity = stage.entities.find((e) => same(e, cell.p))
    const pressed = (state: GameState) => same(state.player, cell.p) || has(state.boxes, cell.p)
    const doorDepth = (state: GameState) =>
      entity?.type === 'door' && isDoorOpen(state, entity.id) ? 0 : TILE.layer
    // 상자가 얹힌 칸도 찾도록 entity와 따로 보는 발판
    const lift = stage.entities.find(
      (e): e is Extract<Entity, { type: 'lift' }> => e.type === 'lift' && same(e, cell.p),
    )
    const liftLevel = (state: GameState) =>
      lift !== undefined && isLiftRaised(state, lift.id) ? 1 : 0
    const warp = stage.entities.find(
      (e): e is Extract<Entity, { type: 'warp' }> => e.type === 'warp' && same(e, cell.p),
    )
    const liftPhase =
      lift === undefined ? 1 : linkedPhase(switchCells(stage, lift.id), isLiftRaised(game, lift.id))
    const switchPhase =
      entity?.type === 'switch' && scene.dropping
        ? back
        : entity?.type === 'switch' && scene.moving
          ? pressProgress(events, cell.p, pressed(game), t, swampSeconds)
          : scene.progress
    const passing =
      entity?.type === 'switch' && scene.moving ? passDip(events, cell.p, t, swampSeconds) : 0
    const doorDip =
      entity?.type === 'door' && scene.moving
        ? Math.max(
            0,
            ...switchCells(stage, entity.id).map((p) => passDip(events, p, t, swampSeconds)),
          )
        : 0
    const doorPhase =
      entity?.type === 'door'
        ? linkedPhase([...switchCells(stage, entity.id), cell.p], isDoorOpen(game, entity.id))
        : scene.progress
    const raised = lerp(liftLevel(scene.before), liftLevel(game), liftPhase)

    return {
      raised,
      device: {
        entity: entity?.type === 'switch' || entity?.type === 'door' ? entity.type : null,
        // 미끄러져 지나칠 때는 눌림 깊이의 절반
        switchDepth:
          lerp(pressed(scene.before) ? 2 : 9, pressed(game) ? 2 : 9, switchPhase) - 3.5 * passing,
        // 지나치는 스위치에 딸린 문은 한 층의 4분의 1
        doorDepth:
          lerp(doorDepth(scene.before), doorDepth(game), doorPhase) - (TILE.layer / 4) * doorDip,
        lift: lift !== undefined,
        warp: warp !== undefined,
      },
    }
  }
}
