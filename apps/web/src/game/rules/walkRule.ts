import type { Direction, GameEvent, GameState, LeaningLadder, MoveResult, Point } from '../types'
import { hasBox, same, step } from './cellRule'
import { slidePlayer } from './iceRule'
import { floorAt, standHeight } from './stateRule'
import { isSwamp } from './swampRule'
import { warpExit } from './warpRule'

// 시드는 판의 클리어 조건, 버섯을 다 밟은 뒤 구멍 도착
const clearedAt = (state: GameState, p: Point) =>
  same(p, state.stage.goal) && !(state.stage.rules?.mushroomWither && state.mushrooms.length > 0)

// 내려선 뒤의 미끄러짐, 짝 칸 이동, 늪 빠짐, 클리어, 빈손일 때 사다리나 씨앗 줍기
export const arrive = (
  state: GameState,
  to: Point,
  direction: Direction,
  event: GameEvent,
  pre: GameEvent[] = [],
): MoveResult => {
  const from = state.player
  // 낙하는 언제나 미끄러짐의 끝, 떨어져 내려온 칸은 미끄럼 제외
  const slide =
    event.type === 'fell' ? { rest: to, landed: null } : slidePlayer(state, to, direction)
  const { rest, landed } = slide
  const stop = landed ?? rest
  const events = [...pre, event]

  if (!same(rest, to)) events.push({ type: 'slid', subject: 'player', from: to, to: rest })
  if (landed) {
    const drop = (floorAt(state, rest) ?? 0) - (floorAt(state, landed) ?? 0)
    events.push({ type: 'fell', from: rest, to: landed, drop })
  }

  // 짝 칸 이동 제외 경우, 상자 위에 선 큐브와 나올 칸이 상자로 막힌 큐브
  const exit = warpExit(state.stage, stop)
  const warped = exit && !hasBox(state, stop) && !hasBox(state, exit) ? exit : null
  const at = warped ?? stop
  if (warped) events.push({ type: 'warped', from: stop, to: warped })

  // 늪에 빠진 수, 걸어 들어가든 떨어져 내려앉든 늪 칸에 닿은 이동
  const next: GameState = {
    ...state,
    player: at,
    moves: state.moves + 1,
    struggles: 0,
    sinks: state.sinks + (isSwamp(state, at) ? 1 : 0),
    cleared: clearedAt(state, at),
  }
  if (state.carrying) return { state: next, events }

  const pickedUp: GameEvent = { type: 'pickedUp', at, item: 'ladder' }

  if (state.ladders.some((l) => same(l, at))) {
    const ladders = state.ladders.filter((l) => !same(l, at))
    return { state: { ...next, ladders, carrying: 'ladder' }, events: [...events, pickedUp] }
  }

  const climbedDown = (l: LeaningLadder) => same(l, at) && same(step(l, l.direction), from)
  if (state.leaningLadders.some(climbedDown)) {
    const leaningLadders = state.leaningLadders.filter((l) => !climbedDown(l))
    return { state: { ...next, leaningLadders, carrying: 'ladder' }, events: [...events, pickedUp] }
  }

  if (state.seeds.some((s) => same(s, at))) {
    const seeds = state.seeds.filter((s) => !same(s, at))
    return {
      state: { ...next, seeds, carrying: 'seed' },
      events: [...events, { ...pickedUp, item: 'seed' }],
    }
  }

  return { state: next, events }
}

export const walk = (
  state: GameState,
  to: Point,
  toHeight: number,
  direction: Direction,
  pre: GameEvent[] = [],
) => {
  const from = state.player
  const drop = standHeight(state, from) - toHeight
  const event: GameEvent = drop > 0 ? { type: 'fell', from, to, drop } : { type: 'moved', from, to }
  return arrive(state, to, direction, event, pre)
}
