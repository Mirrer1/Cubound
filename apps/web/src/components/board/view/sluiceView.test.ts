import { describe, expect, it } from 'vitest'

import {
  CHANNEL,
  TAP,
  channelCells,
  channelPoints,
  slotPoints,
  tapBase,
  tapParts,
} from './sluiceView'
import { TILE, isoDelta } from '@/game/iso'
import type { Stage } from '@/game/types'

// 물 높이 1, 가 웅덩이 (1,1)과 (2,1), 나 웅덩이 (5,1), 사이 (3,1) 장치와 (4,1) 땅
const LOCK: Stage = {
  version: 1,
  id: 'test-sluice-view',
  heights: [
    [2, 2, 2, 2, 2, 2, 2],
    [2, 0, 1, 2, 2, 0, 2],
    [2, 2, 2, 2, 2, 2, 2],
  ],
  water: 1,
  start: { x: 0, y: 0 },
  goal: { x: 6, y: 0 },
  entities: [{ type: 'sluice', x: 3, y: 1 }],
  rules: { lock: { x: 1, y: 1 } },
}

describe('tapBase', () => {
  it('꼭지 밑동은 칸 오른쪽 모서리 쪽', () => {
    const d = isoDelta(TAP.at.u, TAP.at.v)

    expect(tapBase(100, 50)).toEqual({ x: 100 + d.x, y: 50 + d.y })
    expect(d.x).toBeGreaterThan(0)
    expect(d.y).toBeCloseTo(0)
  })
})

describe('slotPoints', () => {
  it('닫히면 세로, 돌아서 열리면 가로로 눕는 바퀴 홈', () => {
    const extent = (turn: number) => {
      const points = slotPoints(turn)
      return [Math.max(...points.map(([u]) => u)), Math.max(...points.map(([, v]) => v))]
    }
    const [closedU, closedV] = extent(0)
    const [openU, openV] = extent(1)

    expect(closedU).toBeCloseTo(TAP.slot.short)
    expect(closedV).toBeCloseTo(TAP.slot.long)
    expect(openU).toBeCloseTo(TAP.slot.long)
    expect(openV).toBeCloseTo(TAP.slot.short)
  })

  it('반쯤 돌면 홈이 비스듬하다', () => {
    const [u, v] = slotPoints(0.5)[2]
    expect(Math.abs(u)).toBeGreaterThan(TAP.slot.short)
    expect(Math.abs(v)).toBeLessThan(TAP.slot.long)
  })
})

describe('channelCells', () => {
  it('장치에서 한 축으로 곧게 두 웅덩이에 닿는 땅이 물길', () => {
    expect([...channelCells(LOCK)]).toEqual([
      ['3-1', 'x'],
      ['4-1', 'x'],
    ])
  })

  it('세로로 닿으면 세로 물길', () => {
    const heights = [
      [2, 0, 2],
      [2, 2, 2],
      [2, 0, 2],
    ]
    const stage: Stage = {
      ...LOCK,
      heights,
      entities: [{ type: 'sluice', x: 1, y: 1 }],
      rules: { lock: { x: 1, y: 0 } },
    }

    expect([...channelCells(stage)]).toEqual([['1-1', 'y']])
  })

  it('곧은 길이 없거나 갑문 판이 아니면 물길 없음', () => {
    const bent = LOCK.heights.map((row, y) => (y === 1 ? [2, 0, 1, 2, 2, 2, 2] : row))
    const corner = [...bent.slice(0, 2), [2, 2, 2, 2, 2, 0, 2]]

    expect(channelCells({ ...LOCK, heights: corner }).size).toBe(0)
    expect(channelCells({ ...LOCK, rules: undefined }).size).toBe(0)
  })
})

describe('tapParts', () => {
  const ys = (points: string) => points.split(' ').map((p) => Number(p.split(',')[1]))

  it('기둥 위 바퀴가 바닥에서 꼭지 높이만큼 위', () => {
    const parts = tapParts(0, 0, 0)

    expect(parts.post).toMatchObject({ y: -TAP.height, depth: TAP.height })
    expect(parts.wheel).toMatchObject({ y: -TAP.height - TAP.wheelDepth, depth: TAP.wheelDepth })
    expect(Math.min(...ys(parts.spout))).toBeGreaterThan(-TAP.height)
  })

  it('웅덩이는 열린 만큼 커진다', () => {
    const width = (points: string) => {
      const xs = points.split(' ').map((p) => Number(p.split(',')[0]))
      return Math.max(...xs) - Math.min(...xs)
    }

    expect(width(tapParts(0, 0, 1).puddle)).toBeCloseTo(TILE.width * TAP.puddle)
    expect(width(tapParts(0, 0, 0.5).puddle)).toBeCloseTo((TILE.width * TAP.puddle) / 2)
  })
})

describe('channelPoints', () => {
  it('칸을 가로지르는 홈 폭은 칸 폭 0.2배', () => {
    const { groove } = channelPoints(0, 0, 'x')
    const corners = groove.split(' ').map((p) => p.split(',').map(Number))
    const d = isoDelta(0, CHANNEL.width)

    expect(corners).toHaveLength(4)
    expect(corners[3][0] - corners[0][0]).toBeCloseTo(d.x)
    expect(corners[3][1] - corners[0][1]).toBeCloseTo(d.y)
  })
})
