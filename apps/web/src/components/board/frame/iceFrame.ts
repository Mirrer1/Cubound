import { type Chain, easeIn, easeOut } from './curveFrame'
import { type Segment, same } from './pathFrame'
import { FROST_FADE, NO_SWAMP, type SwampTime, elapsedAt, frostStamps } from './timeFrame'
import type { GameEvent, Point } from '@/game/types'

// 칸 하나의 자국 진하기 0~1, 겹치면 진한 쪽
export const frostAt = (events: GameEvent[], p: Point, t: number, swamp: SwampTime = NO_SWAMP) => {
  if (!events.some((e) => e.type === 'slid')) return 0

  const elapsed = elapsedAt(events, swamp, t)
  return frostStamps(events)
    .filter((stamp) => same(stamp.p, p))
    .reduce(
      (deepest, stamp) =>
        Math.max(deepest, elapsed < stamp.at ? 0 : 1 - (elapsed - stamp.at) / FROST_FADE),
      0,
    )
}

// 미끄러져 멈춘 이동은 다음 입력과 이어 붙이기 제외
export const slideChain = (events: GameEvent[], chain: Chain): Chain =>
  events.some((e) => e.type === 'slid') ? { in: chain.in, out: false } : chain

// 미끄러짐 전체를 하나로 본 눌림, 이어진 구간 사이에서 풀리면 끊겨 보이는 탓
const SQUASH = { rise: 0.15, fall: 0.25 }

export const squashAt = (q: number) =>
  q <= 0 || q >= 1
    ? 0
    : q < SQUASH.rise
      ? easeOut(q / SQUASH.rise)
      : Math.min(1, easeIn((1 - q) / SQUASH.fall))

// 이어지는 미끄러짐 구간 전체의 시작과 끝 시각
export const slideSpan = (segments: Segment[]) => {
  let start = 0
  let from = -1
  let to = -1
  for (const { event, seconds } of segments) {
    if (event.type === 'slid') {
      if (from < 0) from = start
      to = start + seconds
    }
    start += seconds
  }
  return from < 0 ? null : { from, to }
}
