import type { Direction, GameEvent, GameState, MoveResult, Point } from '../types'
import { hasBox, hasStone, isFrozen, isOpenWater, same, step } from './cellRule'
import { isIce } from './iceRule'
import { isMushroom, wither } from './mushroomRule'
import { floorAt, rawHeight } from './stateRule'
import { isSwamp } from './swampRule'
import { isClosedDoor } from './switchRule'
import { onTramPath } from './tramRule'
import { walk } from './walkRule'
import { isWhirlpool } from './whirlpoolRule'

// 바닥 없는 칸은 -1, 상자가 들어가 메울 자리
export const boxLanding = (state: GameState, p: Point, level: number): number | null => {
  const floor = rawHeight(state, p)
  if (floor === undefined || floor > level) return null
  // 상자가 메운 발판 길 칸은 발판 통행 불가
  if (floor < 0 && onTramPath(state.stage, p)) return null
  if (
    hasBox(state, p) ||
    hasStone(state, p) ||
    state.ladders.some((l) => same(l, p)) ||
    state.leaningLadders.some((l) => same(l, p)) ||
    state.seeds.some((s) => same(s, p)) ||
    same(p, state.stage.goal) ||
    isClosedDoor(state, p) ||
    (isWhirlpool(state, p) && !state.stage.rules?.plug)
  )
    return null

  return floor
}

// 버섯에 튕긴 상자가 내려설 자리와 밟고 지난 버섯들
const hopBox = (
  state: GameState,
  from: Point,
  direction: Direction,
): { to: Point; floor: number; level: number; sprung: Point[] } | null => {
  const sprung: Point[] = []
  let at = from

  for (;;) {
    const level = floorAt(state, at) ?? 0
    const to = step(step(at, direction), direction)
    const floor = boxLanding(state, to, level)
    if (floor === null) return null

    sprung.push(at)
    if (!isMushroom(state, to)) return { to, floor, level, sprung }
    at = to
  }
}

const slideBox = (
  state: GameState,
  from: Point,
  direction: Direction,
  level: number,
): { rest: Point; landed: { to: Point; result: 'fell' | 'filled' | 'floated' } | null } => {
  let at = from

  for (;;) {
    if (!isIce(state, at) && !isFrozen(state, at)) return { rest: at, landed: null }

    const next = step(at, direction)
    // 언 칸이 끝나는 물 앞 멈춤
    if (isFrozen(state, at) && isOpenWater(state, next)) return { rest: at, landed: null }
    const floor = boxLanding(state, next, level)
    if (floor === null) return { rest: at, landed: null }
    if (floor < level)
      return {
        rest: at,
        landed: {
          to: next,
          result: isOpenWater(state, next) ? 'floated' : floor < 0 ? 'filled' : 'fell',
        },
      }
    at = next
  }
}

export const pushBox = (state: GameState, box: Point, direction: Direction): MoveResult | null => {
  const boxFloor = floorAt(state, box) ?? 0
  const first = step(box, direction)
  const entry = boxLanding(state, first, boxFloor)
  if (entry === null) return null

  // 버섯으로 밀린 상자는 내릴 자리가 없으면 밀기 불가
  const onMushroom = isMushroom(state, first)
  const flight = onMushroom ? hopBox(state, first, direction) : null
  if (onMushroom && flight === null) return null

  const target = flight?.to ?? first
  const landing = flight?.floor ?? entry
  const launch = flight?.level ?? boxFloor

  const slide = landing < 0 ? null : slideBox(state, target, direction, landing)
  const rest = slide?.rest ?? target
  const landed = slide?.landed ?? null

  const events: GameEvent[] = [
    {
      type: 'pushed',
      from: box,
      to: target,
      result:
        isOpenWater(state, target) && !isOpenWater(state, box)
          ? 'floated'
          : landing < 0
            ? 'filled'
            : landing < boxFloor
              ? 'fell'
              : 'slid',
    },
  ]
  if (!same(rest, target)) events.push({ type: 'slid', subject: 'box', from: target, to: rest })
  if (landed) events.push({ type: 'pushed', from: rest, to: landed.to, result: landed.result })

  const stop = landed?.to ?? rest
  const sank = isSwamp(state, stop)
  if (sank) events.push({ type: 'sank', at: stop })
  const plugging = isWhirlpool(state, stop)
  if (plugging) events.push({ type: 'plugged', at: stop })

  const others = state.boxes.filter((b) => !same(b, box))
  const filled = landing < 0 ? target : landed?.result === 'filled' ? landed.to : null
  const fillHeight = landing < 0 ? launch : landing

  // 미끄러짐과 낙하까지 밀기 한 번
  const iced = state.iced.filter((p) => !same(p, box))
  const pushing: GameState = {
    ...state,
    iced,
    pushes: state.pushes + 1,
    mushrooms: wither(state, flight?.sprung ?? []),
  }
  const next: GameState = sank
    ? { ...pushing, boxes: others, swamps: state.swamps.filter((cell) => !same(cell, stop)) }
    : plugging
      ? { ...pushing, boxes: others, plugged: [...state.plugged, stop] }
      : filled
        ? {
            ...pushing,
            boxes: others,
            heights: state.heights.map((row, y) =>
              y === filled.y ? row.map((h, x) => (x === filled.x ? fillHeight : h)) : row,
            ),
          }
        : {
            ...pushing,
            boxes: [...others, stop],
            iced: isFrozen(state, stop) ? [...iced, stop] : iced,
          }

  return walk(next, box, boxFloor, direction, events)
}
