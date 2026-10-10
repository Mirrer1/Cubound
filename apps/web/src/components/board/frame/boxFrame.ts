import { BOX_SINK } from '../view'
import { type CrackView, standSink } from './crackFrame'
import { type Chain, NO_CHAIN, easeIn, lerp, smooth } from './curveFrame'
import { slideChain } from './iceFrame'
import { hopClear, hopLevel, hopLift, hopProgress } from './mushroomFrame'
import {
  type PathEvent,
  boxPath,
  cellsOf,
  has,
  hopCells,
  hopSpan,
  same,
  segmentsOf,
  stepAt,
  totalSeconds,
} from './pathFrame'
import { seedLift } from './seedFrame'
import { type BoxSinkFrame, boxSink, swampTime } from './swampFrame'
import { ridePhase } from './switchFrame'
import { elapsedAt } from './timeFrame'
import { carriedBy, carryOf, frontOf, slideFront, slidingCell, tramProgress } from './tramFrame'
import { floatGone, floatLevel } from './waterFrame'
import { TILE, toScreen } from '@/game/iso'
import { standHeight, waterLevel } from '@/game/rules'
import type { GameEvent, GameState, Point } from '@/game/types'

export interface BoxFrame {
  x: number
  y: number
  level: number
  to: Point
  cell: Point
  lift: number // 버섯에 튕겨 떠오른 화면 거리
}

// 튕겨 간 상자가 마지막 갓에서 떠나 앉는 도착 칸 높이
const boxLevelAfter = (prev: GameState, level: number, event: PathEvent) => {
  if (event.type !== 'pushed') return level
  if (event.result === 'floated') return waterLevel(prev, event.to) - 1
  const hopped = hopCells(event) > 0
  const dx = Math.sign(event.to.x - event.from.x)
  const dy = Math.sign(event.to.y - event.from.y)
  const launch = hopped ? prev.heights[event.to.y - dy * 2][event.to.x - dx * 2] : level
  return event.result === 'filled'
    ? launch - 1
    : event.result === 'fell' || hopped
      ? prev.heights[event.to.y][event.to.x]
      : level
}

export const movingBox = (
  prev: GameState | null,
  game: GameState,
  events: GameEvent[],
  t: number,
  chain: Chain = NO_CHAIN,
): BoxFrame | null => {
  const path = boxPath(events)
  const segments = segmentsOf(path)
  const swamp = swampTime(prev, game)
  // 상자가 제자리에 앉으면 바로 드러나는 메운 바닥, 큐브는 그 뒤에 그 칸으로 이동
  const elapsed = elapsedAt(events, swamp, t)
  const carry = carryOf(events, path.at(-1)?.to ?? null)
  const ride = carry === null ? 0 : tramProgress(events, t, swamp)
  const settled = elapsed >= totalSeconds(segments) && (carry === null || ride >= 1)
  // 늪에 밀려 들어간 상자는 다 잠길 때까지 밀기가 끝난 자리
  const sinking = boxSink(events, swamp, t)
  if (!prev || (settled && (sinking === null || sinking.deep >= 1))) return null

  const step = stepAt(segments, elapsed, slideChain(events, chain))
  if (!step) return null

  const { event, index, p } = step
  const to = carry ? carry.to : path[path.length - 1].to
  // 발판이나 올라간 승강 발판 위 상자의 출발 높이는 딛고 선 높이
  const start = standHeight(prev, path[0].from) - 1
  const fromLevel = path
    .slice(0, index)
    .reduce((level, passed) => boxLevelAfter(prev, level, passed), start)
  const toLevel = boxLevelAfter(prev, fromLevel, event)
  const cells = cellsOf(event)
  const hopped = hopCells(event) > 0
  const floated = !hopped && event.type === 'pushed' && event.result === 'floated'
  const gone = hopped ? hopProgress(cells, p) : floated ? floatGone(p) : p
  // 구덩이를 메우는 상자는 반쯤 가서부터 부드럽게 하강, 떨어지는 상자는 끝에서 가속
  // 버섯을 이어 튀는 상자는 큐브처럼 딛는 갓마다 그 칸 높이
  const filling = event.type === 'pushed' && event.result === 'filled'
  const level =
    hopped && cells > 3
      ? hopLevel(prev, event, cells, fromLevel, toLevel, gone * cells)
      : floated
        ? floatLevel(fromLevel, toLevel, p)
        : event.type === 'slid' || p < (filling ? 0.5 : 0.6)
          ? fromLevel
          : lerp(fromLevel, toLevel, filling ? smooth((p - 0.5) / 0.5) : easeIn((p - 0.6) / 0.4))
  // 상자가 앉을 높이는 도착 칸에 서는 높이에서 한 층을 뺀 값, 발판이 오르내린 몫 포함
  const endLevel = path.reduce((level, passed) => boxLevelAfter(prev, level, passed), start)
  // 상자가 자리에 앉은 뒤 칸과 같이 오르는 씨앗이 솟는 몫
  const pulledAway = events.some((e) => e.type === 'pulled' && same(e.from, to))
  const burned = events.some((e) => e.type === 'boxBurned')
  const riding =
    pulledAway || burned
      ? 0
      : (standHeight(game, to) - 1 - seedLift(events, to, 'box') - endLevel) *
        ridePhase(game, events, to, t, swamp)
  const shift = carry ? carriedBy(carry, ride) : { x: 0, y: 0 }

  return {
    x: lerp(event.from.x, event.to.x, gone) + shift.x,
    y: lerp(event.from.y, event.to.y, gone) + shift.y,
    level: level + riding,
    // 구덩이를 메우는 상자의 뜀 높이 기준, 메운 뒤 윗면이 닿는 땅 높이
    lift: hopped
      ? hopLift(
          cells,
          hopSpan(cells) * p,
          0,
          hopClear(prev, event, cells, fromLevel, filling ? toLevel + 1 : toLevel),
        )
      : 0,
    to,
    // 잠기는 상자는 진흙에 가려지는 멈춘 자리 칸
    cell:
      sinking && settled
        ? to
        : carry && ride > 0
          ? slidingCell(carry.from, carry.to, ride)
          : event.type === 'slid' && cells > 1
            ? slideFront(event, gone * cells)
            : frontOf(event.from, event.to),
  }
}

interface BoxView {
  box: BoxFrame | null
  sinkingBox: BoxSinkFrame | null
  tramFrames: { x: number; y: number; to: Point; cell: Point }[]
  boxes: Point[]
  crackView: CrackView
  iceDrop: number // 언 칸으로 밀려 가며 얼음 판 높이로 내려앉는 거리
  bowl: number // 화로 그릇 위로 오른 거리
}

// 칸과 따로 움직이는 밀리는 상자와 발판 위 상자의 화면 좌표
export const boxFramesOf = ({
  box,
  sinkingBox,
  tramFrames,
  boxes,
  crackView,
  iceDrop,
  bowl,
}: BoxView) => {
  const pushedScreen = box ? toScreen({ x: box.x, y: box.y }, box.level) : null
  return [
    ...(box && pushedScreen
      ? [
          {
            x: pushedScreen.x,
            // 늪에 밀려 들어간 상자는 멈춘 자리에서 진흙 아래로 하강
            y:
              pushedScreen.y -
              TILE.layer +
              standSink(crackView, box.x, box.y) +
              iceDrop -
              bowl -
              box.lift +
              (sinkingBox ? BOX_SINK * sinkingBox.deep : 0),
            to: box.to,
            cell: box.cell,
          },
        ]
      : []),
    // 발판과 한 몸이라 판 위에 얹어 그리는 발판 위 상자
    ...tramFrames
      .filter((frame) => has(boxes, frame.to) && !(box && same(box.to, frame.to)))
      .map((frame) => ({ x: frame.x, y: frame.y - TILE.layer, to: frame.to, cell: frame.cell })),
  ]
}
