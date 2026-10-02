import { type Chain, NO_CHAIN, clamp01, easeIn, easeOut, lerp } from './curveFrame'
import { slideChain, slideSpan, squashAt } from './iceFrame'
import {
  CAP_TOP_IDLE,
  capHeight,
  hopAngle,
  hopClear,
  hopLevel,
  hopLift,
  hopProgress,
  restLift,
  restWalk,
} from './mushroomFrame'
import { PLANT_SEED, seedLift } from './seedFrame'
import { inSwamp, swampTime } from './swampFrame'
import { ridePhase } from './switchFrame'
import {
  type PathEvent,
  WARP,
  cellsOf,
  elapsedAt,
  hopCells,
  hopSpan,
  playerPath,
  playerSegments,
  riseProgress,
  rises,
  stepAt,
  totalSeconds,
  warpAt,
} from './timeFrame'
import { carriedBy, carryOf, frontOf, slidingCell, tramProgress } from './tramFrame'
import { windLean, windSpan } from './windFrame'
import { TILE } from '@/game/iso'
import { standHeight } from '@/game/rules'
import type { Direction, GameEvent, GameState, Point } from '@/game/types'

const TILT = 0.24

export const directionBetween = (from: Point, to: Point): Direction =>
  to.x > from.x ? 'right' : to.x < from.x ? 'left' : to.y > from.y ? 'down' : 'up'

export interface CubeFrame {
  x: number
  y: number
  level: number
  direction: Direction
  angle: number
  cell: Point // 그리기 순서를 맞출 칸
  squash: number // 진행 방향으로 눌린 정도. 0이면 평소 모양
  fade: number // 진하기. 1이면 평소, 0이면 안 보임
  lift: number // 버섯 갓에 받쳐지거나 튕겨 떠오른 화면 거리
}

const levelAfter = (level: number, event: PathEvent) =>
  event.type === 'fell' ? level - event.drop : event.type === 'climbed' ? level + 1 : level

// 큐브가 제 힘으로 간 몫만 그린 프레임. 발판에 실린 몫은 playerFrame이 더한다
const pathFrame = (
  prev: GameState | null,
  game: GameState,
  events: GameEvent[],
  t: number,
  chain: Chain,
): CubeFrame => {
  const { player } = game
  const endLevel = standHeight(game, player)
  const still = {
    ...player,
    level: endLevel,
    direction: 'right' as Direction,
    angle: 0,
    cell: player,
    squash: 0,
    fade: 1,
    lift: capHeight(game, player),
  }
  if (t >= 1) return still

  const segments = playerSegments(events)
  const startLevel = prev ? standHeight(prev, prev.player) : endLevel
  const pathLevel = segments.reduce((level, s) => levelAfter(level, s.event), startLevel)
  const swamp = swampTime(prev, game)
  // 씨앗이 솟아 오르는 몫은 이동이 끝난 뒤에 칸과 같이 오른다
  const seedUp = seedLift(events, player, 'player')
  const pathEnd = endLevel - seedUp
  // 이동 경로로 설명되지 않는 나머지 높이 차이는 발판이 오르내린 몫이라 칸과 같은 속도로 따라간다
  const risen = seedUp * riseProgress(events, t, swamp)
  const riding = (pathEnd - pathLevel) * ridePhase(game, events, player, t, swamp) + risen
  // 연출이 이동보다 길 수 있어 큐브는 제 길을 다 가면 그 자리에서 기다린다
  const elapsed = elapsedAt(events, swamp, t)

  // 바람이 분 수는 내 이동 연출이 다 끝난 뒤에 바람에 밀리거나 기댄다
  const wind = windSpan(events, swamp)
  const lean = windLean(events, swamp, t)
  const braced = events.find((e) => e.type === 'braced')
  // 늪에 빠져 버티는 수는 버둥 사이에 끼면 리듬만 끊겨 기울거나 눌리지 않는다
  // 늪에 묶이거나 숨어서 버틴 수는 기울지 않는다
  if (braced?.type === 'braced' && lean !== null && !inSwamp(game, player) && !braced.sheltered) {
    return { ...still, level: pathEnd + risen, direction: braced.direction, angle: lean * TILT }
  }

  const warped = events.find((e) => e.type === 'warped')
  const warpStart = warpAt(events)
  // 내 이동에서 순간이동한 뒤 바람에 밀리면 그때부터는 밀리는 길을 그린다
  const ownWarp = wind !== null && warpStart !== null && warpStart < wind.from
  const waitAt = segments.findIndex((s) => s.wait)
  const ownLevel = segments
    .slice(0, waitAt < 0 ? segments.length : waitAt)
    .reduce((level, s) => levelAfter(level, s.event), startLevel)
  // 순간이동은 길을 다 간 뒤에 일어나서 가라앉는 동안 들어간 칸에, 솟는 동안 나온 칸에 그린다
  if (
    warped?.type === 'warped' &&
    warpStart !== null &&
    elapsed >= warpStart &&
    !(ownWarp && elapsed >= wind.from)
  ) {
    const sinking = elapsed < warpStart + WARP.sink
    const p = sinking
      ? (elapsed - warpStart) / WARP.sink
      : Math.min(1, (elapsed - warpStart - WARP.sink) / WARP.rise)
    const cell = sinking ? warped.from : warped.to
    const last = segments.at(-1)
    // 들어갈 때는 점점 빨라지고 나올 때는 점점 느려져야 이동과 이어진다
    const deep = sinking ? easeIn(p) : 1 - easeOut(p)

    return {
      ...cell,
      level:
        (ownWarp ? ownLevel : sinking ? pathLevel + riding : pathEnd + risen) - WARP.depth * deep,
      direction: last ? directionBetween(last.event.from, last.event.to) : still.direction,
      angle: 0,
      cell,
      squash: 0,
      fade: 1 - deep,
      lift: 0,
    }
  }

  // 늪에 가라앉는 동안은 걸음이 끝나 들어간 칸에 서 있다. 그 칸에 그려야 진흙에 가려진다
  if (swamp.tail > 0 && elapsed >= totalSeconds(segments)) return still

  // 늪에서 뽑혀 나오기를 기다리는 동안은 떠나기 전 칸에 그대로 선다
  const moving = elapsed < 0 ? null : stepAt(segments, elapsed, slideChain(events, chain))
  // 바람을 기다리는 동안은 내 이동이 끝난 자리에 선다
  const step =
    moving && segments[moving.index].wait
      ? moving.index > 0
        ? { event: segments[moving.index - 1].event, index: moving.index - 1, p: 1 }
        : null
      : moving
  if (prev && step) {
    const span = slideSpan(segments)
    const { event, index, p } = step
    const fromLevel = segments
      .slice(0, index)
      .reduce((level, s) => levelAfter(level, s.event), startLevel)
    const toLevel = levelAfter(fromLevel, event)

    const cells = cellsOf(event)
    const rise = capHeight(prev, event.from)
    const land = capHeight(game, event.to)
    // 튕겨 가는 이동은 갓을 딛는 동안 가로로 거의 안 움직인다
    const hopped = hopCells(event) > 0
    const gone = hopped ? hopProgress(cells, p) : p

    // 갓을 딛는 이동은 갓에 닿기 전에 내려앉아야 큐브와 갓이 붙는다
    // 이 낙하만 고르게 내린다. 가속하면 갓에 닿기 직전까지 떠 있다가 뚝 떨어진다
    const dropped =
      land > 0 ? clamp01((cells * p) / restWalk(cells)) : easeIn(clamp01((p - 0.55) / 0.45))
    // 튕겨서 상자 위에 내려서는 수는 오르는 이벤트가 아니라 걷기로 남아 levelAfter가 높이를 못 올린다.
    // 그 몫을 riding에 맡기면 이동 내내 골고루 퍼져 갓을 딛는 동안에도 큐브가 떠 있다
    const landLevel = index === segments.length - 1 ? pathEnd : toLevel
    const level = hopped
      ? hopLevel(game, event, cells, fromLevel, landLevel, gone * cells)
      : event.type === 'fell'
        ? lerp(fromLevel, toLevel, dropped)
        : event.type === 'climbed'
          ? lerp(fromLevel, toLevel, easeOut(Math.min(1, p / 0.6)))
          : fromLevel

    return {
      x: lerp(event.from.x, event.to.x, gone),
      y: lerp(event.from.y, event.to.y, gone),
      // 튕겨 가는 이동은 hopLevel이 끝 칸 높이까지 맡는다
      level: level + (hopped ? risen : riding),
      direction: directionBetween(event.from, event.to),
      // 얼음 위와 갓을 딛고 날아가는 동안에는 구르지 않는다. 갓으로 걸어 들어가는 한 칸은 구른다
      // 바람에 밀려 가는 동안은 구르지 않고 바람 쪽으로 기울었다 돌아온다
      angle:
        waitAt >= 0 && index > waitAt
          ? (lean ?? 0) * TILT
          : event.type === 'slid'
            ? 0
            : hopped
              ? hopAngle(cells, gone * cells)
              : (Math.PI / 2) * p,
      // 솟는 수는 이동이 끝나면 들어선 칸에 그려 그 칸의 말뚝이 큐브 앞에 남는다
      cell: rises(events) && p >= 1 ? event.to : frontOf(event.from, event.to),
      squash: span ? squashAt((elapsed - span.from) / (span.to - span.from)) : 0,
      fade: 1,
      lift: hopped
        ? hopLift(
            cells,
            hopSpan(cells) * p,
            land,
            hopClear(prev, event, cells, fromLevel, landLevel),
          )
        : land > 0
          ? restLift(
              cells * (p - 1),
              lerp(rise, CAP_TOP_IDLE, clamp01((cells * p) / restWalk(cells))),
            )
          : lerp(rise, land, p),
    }
  }

  const blocked = events.find((e) => e.type === 'blocked')
  if (blocked?.type === 'blocked') {
    return { ...still, direction: blocked.direction, angle: Math.sin(Math.PI * t) * TILT }
  }

  // 제 힘으로 가지 않은 이동은 떠나기 전 칸에 서 있는다
  const hold = prev ? prev.player : player

  // 심는 수는 턱에 부딪혀 기울었다가 앞 절반 안에 돌아온다. 그 반동에 씨앗이 떨어진다
  // 바람이 분 수는 바람이 불기 전까지가 심는 수의 몫이고 그동안은 심은 칸에 선다
  const planted = events.find((e) => e.type === 'planted')
  if (planted?.type === 'planted') {
    const own = wind === null ? t : wind.from > 0 ? clamp01(elapsed / wind.from) : 1
    const bump = clamp01(own / PLANT_SEED.bump)
    const at = wind === null ? still : { ...still, ...hold, cell: hold, level: startLevel }
    return { ...at, direction: planted.direction, angle: Math.sin(Math.PI * bump) * TILT }
  }

  return { ...still, x: hold.x, y: hold.y, cell: hold, level: startLevel + riding }
}

export const playerFrame = (
  prev: GameState | null,
  game: GameState,
  events: GameEvent[],
  t: number,
  chain: Chain = NO_CHAIN,
): CubeFrame => {
  const frame = pathFrame(prev, game, events, t, chain)
  const warped = events.find((e) => e.type === 'warped')
  // 큐브가 제 길을 다 가고 선 칸. 그 자리가 발판이면 이어서 실려 간다
  const rest =
    warped?.type === 'warped' ? warped.to : (playerPath(events).at(-1)?.to ?? prev?.player ?? null)
  const carry = prev && t < 1 ? carryOf(events, rest) : null
  if (carry === null) return frame

  const p = tramProgress(events, t, swampTime(prev, game))
  const shift = carriedBy(carry, p)

  return {
    ...frame,
    x: frame.x + shift.x,
    y: frame.y + shift.y,
    cell: p <= 0 ? frame.cell : slidingCell(carry.from, carry.to, p),
  }
}

// 미끄러지는 큐브가 늘어나는 축. 아이소메트릭이라 화면에서는 대각선이다
export const SLIDE_DEG = (Math.atan2(TILE.height / 2, TILE.width / 2) * 180) / Math.PI
const SQUASH_ALONG = 0.24
const SQUASH_ACROSS = 0.16

// (cx, cy)를 고정한 채 deg 축으로 늘이고 직각 방향으로 누른다
export const squashTransform = (cx: number, cy: number, deg: number, squash: number) => {
  const scale = `scale(${1 + squash * SQUASH_ALONG} ${1 - squash * SQUASH_ACROSS})`
  const pivot = `translate(${cx} ${cy})`
  return `${pivot} rotate(${deg}) ${scale} rotate(${-deg}) translate(${-cx} ${-cy})`
}
