import { clamp01 } from './curveFrame'
import { swampTime } from './swampFrame'
import {
  NO_SWAMP,
  type SwampTime,
  WIND,
  elapsedAt,
  moveSeconds,
  playerSegments,
  stepProgress,
  totalSeconds,
} from './timeFrame'
import { windLeft } from '@/game/rules'
import type { GameEvent, GameState } from '@/game/types'

// 바람이 부는 때와 그치는 때, elapsedAt 기준 시각, 바람이 안 분 수면 null
export const windSpan = (events: GameEvent[], swamp: SwampTime) => {
  if (events.some((e) => e.type === 'braced')) {
    const from = moveSeconds(events, swamp) - swamp.lead - WIND.brace
    return { from, to: from + WIND.brace }
  }
  const segments = playerSegments(events)
  const wait = segments.findIndex((s) => s.wait)
  if (wait < 0) return null
  return { from: totalSeconds(segments.slice(0, wait + 1)), to: totalSeconds(segments) }
}

// 큐브가 바람에 밀리거나 기대는 동안이면 바람 쪽으로 기운 몫 0~1, 아니면 null
export const windLean = (events: GameEvent[], swamp: SwampTime, t: number) => {
  const span = windSpan(events, swamp)
  const elapsed = elapsedAt(events, swamp, t)
  if (span === null || elapsed < span.from || elapsed >= span.to) return null
  return Math.sin(Math.PI * clamp01((elapsed - span.from) / (span.to - span.from)))
}

// 이 수의 연출이 시작한 뒤 바람이 부는 초, 바람이 안 분 수면 null
export const windSeconds = (events: GameEvent[], swamp: SwampTime = NO_SWAMP) => {
  const span = windSpan(events, swamp)
  return span === null ? null : swamp.lead + span.from
}

interface WindView {
  game: GameState | null
  prevGame: GameState | null
  events: GameEvent[]
  animating: boolean
}

// 바람이 분 수는 바람이 부는 동안 흔들리는 0, 연출이 끝나면 다음 숫자
export const windDisplay = ({ game, prevGame, events, animating }: WindView) => {
  const gustAt = game && prevGame ? windSeconds(events, swampTime(prevGame, game)) : null
  const wind = game ? windLeft(gustAt === null || !animating ? game : (prevGame ?? game)) : null
  const blew = gustAt !== null && !animating
  return { gustAt, wind, blew }
}

// 바람에 밀리거나 기대는 동안은 구르지 않고 큐브와 같이 기우는 머리 위 물건
export const windLeaning = (events: GameEvent[], t: number, swamp: SwampTime = NO_SWAMP) =>
  windLean(events, swamp, t) !== null

// 내 이동 몫의 진행도, 바람이 분 수는 바람이 불기 전에 1
export const ownProgress = (events: GameEvent[], t: number, swamp: SwampTime = NO_SWAMP) => {
  const span = windSpan(events, swamp)
  if (span === null) return stepProgress(events, t, swamp)
  return span.from <= 0 ? 1 : clamp01(elapsedAt(events, swamp, t) / span.from)
}
