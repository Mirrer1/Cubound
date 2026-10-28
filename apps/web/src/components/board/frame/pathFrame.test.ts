import { describe, expect, it } from 'vitest'

import {
  CAP_PRESS,
  HOP,
  SECONDS,
  boxPath,
  fallPhase,
  hopSpan,
  playerPath,
  segmentsOf,
  stepAt,
  stonePath,
  totalSeconds,
} from './pathFrame'
import type { GameEvent } from '@/game/types'

const ORIGIN = { x: 0, y: 0 }

describe('segmentsOf', () => {
  it('한 칸 이동은 이동 시간, 밀기는 밀기 시간이다', () => {
    const segments = segmentsOf([
      { type: 'moved', from: ORIGIN, to: { x: 1, y: 0 } },
      { type: 'pushed', from: { x: 1, y: 0 }, to: { x: 2, y: 0 }, result: 'slid' },
    ])
    expect(segments.map((s) => s.seconds)).toEqual([SECONDS.moved, SECONDS.pushed])
  })

  it('미끄러짐은 칸 수에 비례하고 아주 길면 상한에서 멈춘다', () => {
    const slid = (cells: number) =>
      segmentsOf([{ type: 'slid', subject: 'player', from: ORIGIN, to: { x: cells, y: 0 } }])[0]
        .seconds
    expect(slid(3)).toBeCloseTo(0.42)
    expect(slid(20)).toBe(1.2)
  })

  it('물에 떨어뜨리는 밀기는 떠오르는 몫까지 담은 시간이다', () => {
    const [segment] = segmentsOf([
      { type: 'pushed', from: ORIGIN, to: { x: 1, y: 0 }, result: 'floated' },
    ])
    expect(segment.seconds).toBe(SECONDS.floated)
  })

  it('한 층 넘게 떨어지는 큐브와 짐은 높을수록 오래 걸린다', () => {
    const fell = (drop: number) =>
      segmentsOf([
        { type: 'fell', from: ORIGIN, to: { x: 1, y: 0 }, drop },
        { type: 'pushed', from: ORIGIN, to: { x: 1, y: 0 }, result: 'fell', drop },
      ]).map((s) => s.seconds)
    expect(fell(1)).toEqual([SECONDS.fell, SECONDS.pushed])
    expect(fell(3)[0]).toBeGreaterThan(SECONDS.fell)
    expect(fell(3)[1]).toBeGreaterThan(SECONDS.pushed)
  })
})

describe('fallPhase', () => {
  const pushed = (drop: number) =>
    ({ type: 'pushed', from: ORIGIN, to: { x: 1, y: 0 }, result: 'fell', drop }) as const

  it('한 층 낙하는 진행도 그대로 가고 떨어지기 시작하는 때부터 떨어진다', () => {
    expect(fallPhase(pushed(1), 0.5, 0.6)).toEqual({ gone: 0.5, fall: 0 })
    expect(fallPhase(pushed(1), 0.8, 0.6).fall).toBeCloseTo(0.5)
  })

  it('높은 낙하도 가로 이동은 한 층 낙하와 같은 때 끝난다', () => {
    const p = SECONDS.pushed / totalSeconds(segmentsOf([pushed(3)]))
    expect(fallPhase(pushed(3), p, 0.6).gone).toBeCloseTo(1)
    expect(fallPhase(pushed(3), p, 0.6).fall).toBeLessThan(1)
    expect(fallPhase(pushed(3), 1, 0.6).fall).toBe(1)
  })
})

describe('totalSeconds', () => {
  it('구간 시간을 모두 더한다', () => {
    const path: GameEvent[] = [
      { type: 'moved', from: ORIGIN, to: { x: 1, y: 0 } },
      { type: 'moved', from: { x: 1, y: 0 }, to: { x: 2, y: 0 } },
    ]
    expect(totalSeconds(segmentsOf(playerPath(path)))).toBeCloseTo(SECONDS.moved * 2)
  })
})

describe('hopSpan', () => {
  it('두 칸 튕김은 갓 위에 머무는 몫을 더하고 이미 눌린 몫을 뺀다', () => {
    expect(hopSpan(2)).toBeCloseTo(2 + CAP_PRESS.press + CAP_PRESS.spring - CAP_PRESS.press)
  })

  it('홀수 칸은 첫 칸을 걸어 들어가 눌린 몫을 빼지 않는다', () => {
    expect(hopSpan(3)).toBeCloseTo(3 + CAP_PRESS.press + CAP_PRESS.spring)
  })

  it('버섯 연쇄 시간은 상한을 넘지 않는다', () => {
    const [segment] = segmentsOf([{ type: 'moved', from: ORIGIN, to: { x: 9, y: 0 } }])
    expect(segment.seconds).toBe(HOP.max)
  })
})

describe('stepAt', () => {
  const segments = segmentsOf([
    { type: 'moved', from: ORIGIN, to: { x: 1, y: 0 } },
    { type: 'moved', from: { x: 1, y: 0 }, to: { x: 2, y: 0 } },
  ])
  const chain = { in: false, out: false }

  it('경과 시간이 든 구간과 그 안의 진행도를 준다', () => {
    const step = stepAt(segments, SECONDS.moved * 1.5, chain)
    expect(step?.index).toBe(1)
    expect(step?.p).toBeGreaterThan(0)
    expect(step?.p).toBeLessThan(1)
  })

  it('끝을 지나면 마지막 구간의 끝이다', () => {
    const step = stepAt(segments, 10, chain)
    expect(step?.index).toBe(1)
    expect(step?.p).toBe(1)
  })

  it('구간이 없으면 null이다', () => {
    expect(stepAt([], 0, chain)).toBeNull()
  })
})

describe('stonePath', () => {
  it('물에 뜬 채 밀린 돌은 저어 가기, 땅에서 밀린 돌은 밀기로 센다', () => {
    const events: GameEvent[] = [
      { type: 'stonePushed', from: ORIGIN, to: { x: 1, y: 0 }, result: 'rowed' },
      { type: 'stonePushed', from: { x: 1, y: 0 }, to: { x: 2, y: 0 }, result: 'floated' },
    ]
    expect(stonePath(events).map((e) => e.type)).toEqual(['rowed', 'pushed'])
  })

  it('큐브와 상자의 움직임은 담지 않는다', () => {
    const events: GameEvent[] = [
      { type: 'moved', from: ORIGIN, to: { x: 1, y: 0 } },
      { type: 'pushed', from: { x: 1, y: 0 }, to: { x: 2, y: 0 }, result: 'slid' },
    ]
    expect(stonePath(events)).toEqual([])
    expect(boxPath(events)).toHaveLength(1)
  })
})
