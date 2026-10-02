import { clamp01, easeOut, lerp, smooth } from './curveFrame'
import { NO_SWAMP, type SwampTime, boxPath, elapsedAt, segmentsOf } from './timeFrame'
import type { GameEvent } from '@/game/types'

// 땅에서 물로 밀린 상자의 구간, reach까지 가로 이동, drop부터 잠김, rise부터 떠오름
// sink는 제 높이보다 더 잠기는 층 수, ring은 고리가 퍼지기 시작하는 구간 진행도
export const FLOAT = { reach: 0.5, drop: 0.4, rise: 0.75, sink: 0.15, ring: 0.62 }

// 고리 크기와 진하기, 칸 폭 배수
const RING = { from: 0.75, to: 1.05, opacity: 0.8 }

export const floatGone = (p: number) => smooth(clamp01(p / FLOAT.reach))

export const floatLevel = (from: number, to: number, p: number) =>
  p < FLOAT.drop
    ? from
    : p < FLOAT.rise
      ? lerp(from, to - FLOAT.sink, smooth((p - FLOAT.drop) / (FLOAT.rise - FLOAT.drop)))
      : lerp(to - FLOAT.sink, to, smooth((p - FLOAT.rise) / (1 - FLOAT.rise)))

export interface Ripple {
  at: { x: number; y: number }
  size: number // 칸 폭 배수
  opacity: number
}

// 물에 떨어진 상자 둘레로 퍼지는 고리, 없으면 null
export const rippleOf = (
  events: GameEvent[],
  t: number,
  swamp: SwampTime = NO_SWAMP,
): Ripple | null => {
  const segments = segmentsOf(boxPath(events))
  const index = segments.findIndex(
    ({ event }) => event.type === 'pushed' && event.result === 'floated',
  )
  if (index < 0) return null

  const start = segments.slice(0, index).reduce((sum, s) => sum + s.seconds, 0)
  const { event, seconds } = segments[index]
  const local = (elapsedAt(events, swamp, t) - start) / seconds
  const r = clamp01((local - FLOAT.ring) / (1 - FLOAT.ring))
  if (r <= 0) return null

  return {
    at: event.to,
    size: lerp(RING.from, RING.to, easeOut(r)),
    opacity: RING.opacity * (1 - r),
  }
}
