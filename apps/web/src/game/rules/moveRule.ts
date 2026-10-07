import type { Direction, GameEvent, GameState, MoveResult } from '../types'
import { pushBox } from './boxRule'
import { hasBox, hasStone, isOpenWater, isWater, step } from './cellRule'
import { crumble } from './crackRule'
import { meltStones, pushStone, settleIce } from './iceStoneRule'
import { climbOrPlaceLadder } from './ladderRule'
import { climbsLeft, dirLeft, limitBlocked, movesLeft, pushesLeft, ridesLeft } from './limitRule'
import { hop, isMushroom, spring } from './mushroomRule'
import { riseSeeds } from './seedRule'
import { floodsPlayer, sluiceEvents } from './sluiceRule'
import { floorAt, standHeight } from './stateRule'
import { struggling } from './swampRule'
import { doors, isClosedDoor, isDoorOpen, isLiftRaised, lifts } from './switchRule'
import { withinReach } from './tetherRule'
import { boardsTram, onTramPath, rideTrams, tramLevelAt } from './tramRule'
import { growVines } from './vineRule'
import { arrive, walk } from './walkRule'
import { row } from './waterRule'
import { isWhirlpool, pullBoats } from './whirlpoolRule'
import { blow } from './windRule'

const moveOnce = (state: GameState, direction: Direction): MoveResult => {
  const blocked: MoveResult = { state, events: [{ type: 'blocked', direction }] }
  const from = state.player
  const to = step(from, direction)
  const fromHeight = standHeight(state, from)
  const toFloor = floorAt(state, to)

  // 버섯에 올라선 큐브의 유일한 수, 튕겨 나가기
  if (isMushroom(state, from)) {
    const hopped = hop(state, from, direction)
    return hopped ? spring(state, hopped, direction) : blocked
  }

  if (hasStone(state, to)) {
    const pushed = pushStone(state, to, direction)
    if (!pushed) return blocked
    return pushesLeft(state) === 0 ? limitBlocked(state, direction, 'pushes') : pushed
  }

  if (isOpenWater(state, from) && isOpenWater(state, to) && !hasBox(state, to)) {
    return withinReach(state, from, to) && !isWhirlpool(state, to)
      ? row(state, to, direction)
      : blocked
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

const tick = (before: GameState, acted: GameState, events: GameEvent[]): MoveResult => {
  const { state: after, events: windEvents } = blow(acted)
  // 내 이동과 바람을 따로 보는 이유, 밟고 바로 바람에 밀려 떠난 칸도 닳는 규칙
  const { state: stepped, events: stepEvents } = crumble(before, acted, after)
  const { state: crumbled, events: windCrackEvents } =
    after === acted ? { state: stepped, events: [] } : crumble(acted, after, stepped)
  const crackEvents = [...stepEvents, ...windCrackEvents]
  const { state: rode, events: tramEvents } = rideTrams(crumbled)
  const { state: grown, events: vineEvents } = growVines(rode)
  const { state: seeded, events: seedEvents } = riseSeeds(before, grown)
  const { state: pulled, events: pullEvents } = pullBoats(seeded)
  const { state: melted, events: meltEvents } = meltStones(before, pulled)
  const { state: settled, events: iceEvents } = settleIce(before, melted)
  // 물에 잠긴 골은 언 칸이나 배로 올라서도 못 들어가는 집
  const moved =
    settled.cleared && isWater(settled, settled.stage.goal)
      ? { ...settled, cleared: false }
      : settled

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
      ...pullEvents,
      ...meltEvents,
      ...iceEvents,
      ...doorEvents,
      ...liftEvents,
      ...sluiceEvents(before, moved),
      ...(moved.cleared ? [{ type: 'cleared' } as const] : []),
    ],
  }
}

export const move = (state: GameState, direction: Direction): MoveResult => {
  if (state.cleared) return { state, events: [] }
  if (movesLeft(state) === 0) return limitBlocked(state, direction, 'moves')

  // 방향이 없는 수인 버둥, 방향 제한과 상자와 사다리는 무관
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
  // 타는 횟수를 다 쓴 뒤 막는 이동은 올라타기 하나
  const boarded = boardsTram(state, result.state)
  if (boarded && ridesLeft(state) === 0) return limitBlocked(state, direction, 'rides')

  // 발판 위나 발판 길 쪽으로 막힌 이동은 타거나 기다리는 수, 제자리에서 이동 1회
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

  // 이동 수로 세는 수는 방향 사용 1회
  const spent: GameState = limitedDir
    ? { ...acted.state, dirUses: acted.state.dirUses + 1 }
    : acted.state

  const ticked = tick(state, spent, acted.events)
  if (!floodsPlayer(state, ticked.state)) return ticked
  return state.stage.rules?.tide
    ? limitBlocked(state, direction, 'tide')
    : { state, events: [{ type: 'blocked', direction, flooded: true }] }
}
