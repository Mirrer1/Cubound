import type { Direction, GameEvent, GameState, MoveResult } from '../types'
import { pushBox } from './boxRule'
import { hasBox, step } from './cellRule'
import { crumble } from './crackRule'
import { climbOrPlaceLadder } from './ladderRule'
import { climbsLeft, dirLeft, limitBlocked, movesLeft, pushesLeft, ridesLeft } from './limitRule'
import { hop, isMushroom, spring } from './mushroomRule'
import { riseSeeds } from './seedRule'
import { floorAt, standHeight } from './stateRule'
import { struggling } from './swampRule'
import { doors, isClosedDoor, isDoorOpen, isLiftRaised, lifts } from './switchRule'
import { boardsTram, onTramPath, rideTrams, tramLevelAt } from './tramRule'
import { growVines } from './vineRule'
import { arrive, walk } from './walkRule'
import { blow } from './windRule'

const moveOnce = (state: GameState, direction: Direction): MoveResult => {
  const blocked: MoveResult = { state, events: [{ type: 'blocked', direction }] }
  const from = state.player
  const to = step(from, direction)
  const fromHeight = standHeight(state, from)
  const toFloor = floorAt(state, to)

  // 버섯에 올라선 큐브는 튕겨 나가는 수밖에 없다
  if (isMushroom(state, from)) {
    const hopped = hop(state, from, direction)
    return hopped ? spring(state, hopped, direction) : blocked
  }

  if (toFloor === null || isClosedDoor(state, to)) return blocked

  if (!hasBox(state, to)) {
    if (toFloor <= fromHeight) {
      const hopped = isMushroom(state, to) ? hop(state, to, direction) : null
      return hopped ? spring(state, hopped, direction) : walk(state, to, toFloor, direction)
    }
    return climbOrPlaceLadder(state, to, direction) ?? blocked
  }

  if (toFloor + 1 <= fromHeight) return walk(state, to, toFloor + 1, direction)
  if (toFloor > fromHeight) return blocked

  const outOfPushes = pushesLeft(state) === 0
  const pushed = outOfPushes ? null : pushBox(state, to, direction)
  if (pushed) return pushed

  const pre: GameEvent[] = outOfPushes ? [{ type: 'limit', limit: 'pushes' }] : []
  if (climbsLeft(state) === 0) {
    const stopped = limitBlocked(state, direction, 'climbs')
    return { state, events: [...pre, ...stopped.events] }
  }

  const climbing: GameState = { ...state, climbs: state.climbs + 1 }
  return arrive(climbing, to, direction, { type: 'climbed', from, to, via: 'box' }, pre)
}

// 이동으로 센 수마다 바람이 불고 무너지는 칸이 닳고 발판이 한 칸 가고 덩굴이 뻗고 씨앗이 자라고 문과 엘리베이터 발판이 따라 바뀐다
const tick = (before: GameState, acted: GameState, events: GameEvent[]): MoveResult => {
  const { state: after, events: windEvents } = blow(acted)
  // 내 이동으로 바뀐 칸과 바람에 밀려 바뀐 칸을 따로 본다. 밟고 바로 밀려 떠난 칸도 한 번 닳는다
  const { state: stepped, events: stepEvents } = crumble(before, acted, after)
  const { state: crumbled, events: windCrackEvents } =
    after === acted ? { state: stepped, events: [] } : crumble(acted, after, stepped)
  const crackEvents = [...stepEvents, ...windCrackEvents]
  const { state: rode, events: tramEvents } = rideTrams(crumbled)
  const { state: grown, events: vineEvents } = growVines(rode)
  const { state: moved, events: seedEvents } = riseSeeds(before, grown)

  const doorEvents: GameEvent[] = doors(before.stage)
    .map((door) => ({
      id: door.id,
      before: isDoorOpen(before, door.id),
      after: isDoorOpen(moved, door.id),
    }))
    .filter((change) => change.before !== change.after)
    .map(({ id, after: open }) => ({ type: 'door', id, open }))

  const liftEvents: GameEvent[] = lifts(before.stage)
    .filter((lift) => isLiftRaised(before, lift.id) !== isLiftRaised(moved, lift.id))
    .map((lift) => ({ type: 'lift', id: lift.id, up: isLiftRaised(moved, lift.id) }))

  return {
    state: moved,
    events: [
      ...events,
      ...windEvents,
      ...crackEvents,
      ...tramEvents,
      ...vineEvents,
      ...seedEvents,
      ...doorEvents,
      ...liftEvents,
      ...(moved.cleared ? [{ type: 'cleared' } as const] : []),
    ],
  }
}

export const move = (state: GameState, direction: Direction): MoveResult => {
  if (state.cleared) return { state, events: [] }
  if (movesLeft(state) === 0) return limitBlocked(state, direction, 'moves')

  // 버둥은 방향이 없는 수라 방향 제한을 보지 않고 상자와 사다리도 건드리지 않는다
  if (struggling(state)) {
    const struggled: GameState = {
      ...state,
      moves: state.moves + 1,
      struggles: state.struggles + 1,
    }
    return tick(state, struggled, [{ type: 'struggled', at: state.player }])
  }

  const limitedDir = state.stage.rules?.dirLimit?.dir === direction
  if (limitedDir && dirLeft(state) === 0) return limitBlocked(state, direction, 'dir')

  const result = moveOnce(state, direction)
  // 타는 횟수를 다 쓰면 올라타는 이동만 막는다
  const boarded = boardsTram(state, result.state)
  if (boarded && ridesLeft(state) === 0) return limitBlocked(state, direction, 'rides')

  // 발판 위에서 막힌 이동은 타고 가겠다는 뜻이고 발판 길 쪽으로 막힌 이동은 기다리겠다는 뜻이라 제자리에 서서 이동 1회로 센다
  const forTram =
    result.state === state &&
    (tramLevelAt(state, state.player) !== null ||
      onTramPath(state.stage, step(state.player, direction)))
  if (result.state === state && !forTram) return result

  const acted: MoveResult = forTram
    ? { state: { ...state, moves: state.moves + 1 }, events: [] }
    : boarded
      ? { ...result, state: { ...result.state, rides: result.state.rides + 1 } }
      : result

  // 이동 수로 세는 수면 그 방향을 쓴 것이다
  const spent: GameState = limitedDir
    ? { ...acted.state, dirUses: acted.state.dirUses + 1 }
    : acted.state

  return tick(state, spent, acted.events)
}
