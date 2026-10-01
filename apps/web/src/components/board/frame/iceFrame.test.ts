import { describe, expect, it } from 'vitest'

import { frostAt } from './iceFrame'
import { ICE_STAGE, STAGE } from './testStages'
import { createState, move } from '@/game/rules'
import type { Stage } from '@/game/types'

describe('frostAt', () => {
  const slidEvents = () => move(createState(ICE_STAGE), 'right').events

  it('미끄러지지 않는 이동은 자국을 남기지 않는다', () => {
    const { events } = move(createState(STAGE), 'right')

    expect(frostAt(events, { x: 1, y: 0 }, 0.5)).toBe(0)
  })

  it('미끄러짐이 끝나는 칸에는 자국을 두지 않는다', () => {
    const events = slidEvents()

    for (let t = 0; t <= 1; t += 0.05) {
      expect(frostAt(events, { x: 4, y: 0 }, t)).toBe(0)
    }
  })

  it('아직 지나지 않은 칸에는 자국이 없다', () => {
    expect(frostAt(slidEvents(), { x: 3, y: 0 }, 0)).toBe(0)
  })

  it('자국이 함께 보이는 동안에는 먼저 지나온 칸이 더 옅다', () => {
    const events = slidEvents()
    let together = 0
    for (let t = 0; t <= 1; t += 0.02) {
      const early = frostAt(events, { x: 1, y: 0 }, t)
      const late = frostAt(events, { x: 2, y: 0 }, t)
      if (early > 0 && late > 0) {
        expect(early).toBeLessThan(late)
        together += 1
      }
    }

    expect(together).toBeGreaterThan(0)
  })

  it('자국은 진해졌다 옅어지고 연출이 끝나면 남지 않는다', () => {
    const events = slidEvents()
    let last = 0
    let fading = false
    for (let t = 0; t <= 1; t += 0.02) {
      const frost = frostAt(events, { x: 1, y: 0 }, t)
      if (frost < last) fading = true
      if (fading) expect(frost).toBeLessThanOrEqual(last)
      expect(frost).toBeLessThanOrEqual(1)
      last = frost
    }

    expect(fading).toBe(true)
    expect(frostAt(events, { x: 1, y: 0 }, 1)).toBe(0)
  })

  it('미끄러진 상자도 지나온 칸에 자국을 남긴다', () => {
    const stage: Stage = {
      ...ICE_STAGE,
      heights: [[0, 0, 0, 0, 0, 0, 0]],
      ice: ['..###..'],
      goal: { x: 6, y: 0 },
      entities: [{ type: 'box', x: 1, y: 0 }],
    }
    const { events } = move(createState(stage), 'right')
    let deepest = 0
    for (let t = 0; t <= 1; t += 0.02) {
      deepest = Math.max(deepest, frostAt(events, { x: 3, y: 0 }, t))
    }

    expect(deepest).toBeGreaterThan(0)
  })
})
