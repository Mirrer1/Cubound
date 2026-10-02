import { NO_CHAIN, clamp01, easeIn, easeOut, lerp, moveEase } from './curveFrame'
import {
  type CountView,
  NO_SWAMP,
  SWAMP,
  type SwampTime,
  countDisplay,
  elapsedAt,
  playerSegments,
  same,
  sinkEnd,
  totalSeconds,
} from './timeFrame'
import { STRUGGLES, sinkCount } from '@/game/rules'
import type { GameEvent, GameState, Point } from '@/game/types'

export const inSwamp = (state: GameState, p: Point) => state.swamps.some((cell) => same(cell, p))

// 늪에 빠지거나 늪에서 나오는 이동에 더 드는 시간, 제자리 버둥은 따로 두는 길이
export const swampTime = (prev: GameState | null, game: GameState): SwampTime => {
  if (!prev || same(prev.player, game.player)) return NO_SWAMP

  return {
    lead: inSwamp(prev, prev.player) ? SWAMP.rise : 0,
    tail: inSwamp(game, game.player) ? SWAMP.sink : 0,
  }
}

// 빠진 큐브가 잠기는 깊이와 둘레 진흙 테, 제일 깊은 자리와 마지막 버둥 자리의 값
const MUD_SINK = { deepest: 13, risen: 6 }

const MUD_COLLAR = { deepest: 0.72, risen: 0.66 }

export const swampSink = (risen: number) => lerp(MUD_SINK.deepest, MUD_SINK.risen, risen)

export const swampCollar = (risen: number) => lerp(MUD_COLLAR.deepest, MUD_COLLAR.risen, risen)

// 깊어지는 늪은 빠진 횟수만큼 느는 버둥
const strugglesFor = (state: GameState) =>
  state.stage.rules?.swampDeepen ? STRUGGLES + state.sinks - 1 : STRUGGLES

// 버둥 수와 상관없이 마지막 버둥에서 1이 되는 고른 상승
const risenIn = (state: GameState) => state.struggles / strugglesFor(state)

// 다음 자리보다 살짝 더 솟았다가 도로 잠기는 버둥
const struggleRise = (from: number, to: number, p: number) =>
  p < SWAMP.peak
    ? lerp(from, to + SWAMP.over, easeOut(p / SWAMP.peak))
    : lerp(to + SWAMP.over, to, moveEase((p - SWAMP.peak) / (1 - SWAMP.peak), NO_CHAIN))

export interface SwampFrame {
  cell: Point
  risen: number // 올라온 정도, 0이면 제일 깊은 자리, 1이면 마지막 버둥 자리
  deep: number // 잠긴 정도 0~1
}

// 늪에 잠긴 큐브의 깊이, 잠긴 큐브가 없으면 null
export const swampFrame = (
  prev: GameState | null,
  game: GameState,
  events: GameEvent[],
  t: number,
): SwampFrame | null => {
  const swamp = swampTime(prev, game)
  const elapsed = elapsedAt(events, swamp, t)

  // 나오는 이동은 걷기 전에 뽑혀 올라오는 몫, 다 올라오면 늪 밖
  if (prev && elapsed < 0) {
    const p = clamp01((elapsed + swamp.lead) / swamp.lead)
    return { cell: prev.player, risen: risenIn(prev), deep: 1 - easeIn(p) }
  }
  if (!inSwamp(game, game.player)) return null

  // 들어가는 이동은 큐브가 칸에 닿은 뒤부터 가라앉는 몫
  if (swamp.tail > 0) {
    const walked = totalSeconds(playerSegments(events))
    return {
      cell: game.player,
      risen: risenIn(game),
      deep: easeIn(clamp01((elapsed - walked) / swamp.tail)),
    }
  }
  if (prev && events.some((e) => e.type === 'struggled')) {
    const p = clamp01(elapsed / SWAMP.struggle)
    return {
      cell: game.player,
      risen: struggleRise(risenIn(prev), risenIn(game), p),
      deep: 1,
    }
  }

  return { cell: game.player, risen: risenIn(game), deep: 1 }
}

export interface BoxSinkFrame {
  at: Point
  deep: number // 잠긴 정도 0~1
  filled: number // 메운 자리가 드러난 정도 0~1
}

// 늪에 밀려 들어간 상자가 잠기는 정도, 가라앉는 상자가 없으면 null
export const boxSink = (events: GameEvent[], swamp: SwampTime, t: number): BoxSinkFrame | null => {
  const sank = events.find((e) => e.type === 'sank')
  if (sank?.type !== 'sank') return null

  // 연출이 끝나는 프레임에서 꼭 1이 되게 다 잠기는 때에서 거꾸로 센 값
  const p = clamp01(1 - (sinkEnd(events) - elapsedAt(events, swamp, t)) / SWAMP.box)

  return { at: sank.at, deep: easeIn(p), filled: clamp01((p - SWAMP.fill) / (1 - SWAMP.fill)) }
}

// 늪에 빠지는 수에서 큐브가 잠기기 시작하는 초
export const sinkSeconds = (prev: GameState, game: GameState, events: GameEvent[]) =>
  game.sinks > prev.sinks ? [swampTime(prev, game).lead + totalSeconds(playerSegments(events))] : []

export const mudDisplay = (view: CountView) => countDisplay(view, sinkCount, sinkSeconds)
