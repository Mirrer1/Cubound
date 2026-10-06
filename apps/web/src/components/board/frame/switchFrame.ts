import { smooth } from './curveFrame'
import { boxPath, cellsOf, same, segmentsOf } from './pathFrame'
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
import { isLiftRaised } from '@/game/rules'
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
