import { describe, expect, it } from 'vitest'

import {
  WATER,
  bankPoints,
  floatShown,
  floatShownAt,
  surfaceRise,
  waterDepth,
  waterLook,
  waterTone,
} from './waterView'
import { TILE } from '@/game/iso'
import type { Stage } from '@/game/types'

// 물 높이 2, 가운데 줄이 깊이 1과 2인 물, 오른쪽 아래는 바닥 없는 칸
const STAGE: Stage = {
  version: 1,
  id: 'test-water-view',
  heights: [
    [2, 2, 2],
    [2, 1, 0],
    [2, 2, -1],
  ],
  water: 2,
  start: { x: 0, y: 0 },
  goal: { x: 2, y: 0 },
  entities: [],
}

describe('waterDepth', () => {
  it('물 칸은 물 높이에서 바닥까지 층 수이고 나머지는 0이다', () => {
    expect(waterDepth(STAGE, { x: 1, y: 1 })).toBe(1)
    expect(waterDepth(STAGE, { x: 2, y: 1 })).toBe(2)
    expect(waterDepth(STAGE, { x: 0, y: 0 })).toBe(0)
    expect(waterDepth(STAGE, { x: 2, y: 2 })).toBe(0)
    expect(waterDepth(STAGE, { x: 5, y: 5 })).toBe(0)
    expect(waterDepth({ ...STAGE, water: undefined }, { x: 1, y: 1 })).toBe(0)
  })
})

describe('waterLook', () => {
  it('왼쪽 위와 오른쪽 위가 마른 땅인 가장자리에만 반사 띠를 둔다', () => {
    expect(waterLook(STAGE, { x: 1, y: 1 })).toMatchObject({ depth: 1, bankX: true, bankY: true })
    expect(waterLook(STAGE, { x: 2, y: 1 })).toMatchObject({ depth: 2, bankX: false, bankY: true })
  })

  it('필드 밖과 바닥 없는 칸은 마른 땅이 아니다', () => {
    const stage: Stage = { ...STAGE, heights: [[-1, 0]], water: 1 }

    expect(waterLook(stage, { x: 1, y: 0 })).toMatchObject({ depth: 1, bankX: false, bankY: false })
  })

  it('물이 아닌 칸은 깊이 0에 반사 띠도 옆면도 없다', () => {
    expect(waterLook(STAGE, { x: 1, y: 2 })).toEqual({
      depth: 0,
      bankX: false,
      bankY: false,
      sideLeft: false,
      sideRight: false,
    })
  })

  it('앞 칸이 바닥이면 가려지는 물 옆면은 그리지 않는다', () => {
    expect(waterLook(STAGE, { x: 1, y: 1 })).toMatchObject({ sideLeft: false, sideRight: false })
    expect(waterLook(STAGE, { x: 2, y: 1 })).toMatchObject({ sideLeft: true, sideRight: true })
  })
})

describe('surfaceRise', () => {
  it('수면은 물 높이 땅 윗면보다 6px 아래다', () => {
    expect(surfaceRise(1)).toBe(TILE.layer - 6)
    expect(surfaceRise(2)).toBe(TILE.layer * 2 - 6)
  })
})

describe('waterTone', () => {
  it('깊이 세 층부터는 같은 색이다', () => {
    expect(waterTone(1)).toBe('var(--color-water-1)')
    expect(waterTone(3)).toBe('var(--color-water-3)')
    expect(waterTone(5)).toBe('var(--color-water-3)')
  })
})

describe('bankPoints', () => {
  it('칸 가장자리를 따라 띠 폭만큼 안쪽으로 들어온 사각형이다', () => {
    expect(bankPoints(0, 0, 'x').split(' ')).toHaveLength(4)
    expect(bankPoints(0, 0, 'x').split(' ')[0]).toBe('0,-26')
    expect(bankPoints(0, 0, 'y').split(' ')[1]).toBe('52,0')
  })
})

describe('floatShown', () => {
  it('뜬 상자는 수면 위로 6px만 보이고 윗면이 물 높이 땅과 같다', () => {
    expect(floatShown(1, 2)).toBe(WATER.lip)
    expect(TILE.layer - WATER.dip).toBe(WATER.lip)
  })

  it('땅 높이에 있는 상자는 다 보이고 더 깊으면 다 잠긴다', () => {
    expect(floatShown(2, 2)).toBe(TILE.layer)
    expect(floatShown(0, 2)).toBe(0)
  })
})

describe('floatShownAt', () => {
  it('물 칸 위 상자만 보이는 높이를 돌려준다', () => {
    expect(floatShownAt(STAGE, { x: 1.2, y: 1, level: 1 })).toBe(WATER.lip)
    expect(floatShownAt(STAGE, { x: 0, y: 0, level: 2 })).toBeNull()
  })
})
