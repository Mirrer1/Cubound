import { describe, expect, it } from 'vitest'

import {
  IDLE_RIPPLE,
  WATER,
  bankPoints,
  boatLook,
  floatShown,
  floatShownAt,
  idleRipples,
  rippleCycle,
  rippleLoop,
  sunkLift,
  surfaceRise,
  surfaceShown,
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
    expect(waterLook(STAGE, { x: 1, y: 1 })).toMatchObject({ depth: 1, bankX: 1, bankY: 1 })
    expect(waterLook(STAGE, { x: 2, y: 1 })).toMatchObject({ depth: 2, bankX: 0, bankY: 1 })
  })

  it('필드 밖과 바닥 없는 칸은 마른 땅이 아니다', () => {
    const stage: Stage = { ...STAGE, heights: [[-1, 0]], water: 1 }

    expect(waterLook(stage, { x: 1, y: 0 })).toMatchObject({ depth: 1, bankX: 0, bankY: 0 })
  })

  it('물이 아닌 칸은 깊이 0에 반사 띠도 옆면도 없다', () => {
    expect(waterLook(STAGE, { x: 1, y: 2 })).toEqual({
      depth: 0,
      bankX: 0,
      bankY: 0,
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

describe('rippleCycle', () => {
  it('칸 수만큼 gap씩 어긋나고 짧아도 고리 두 개 길이는 된다', () => {
    expect(rippleCycle(12)).toBe(12 * IDLE_RIPPLE.gap)
    expect(rippleCycle(1)).toBe(IDLE_RIPPLE.life * 2)
  })
})

describe('rippleLoop', () => {
  it('한 바퀴 중 처음 life 동안만 보이고 안쪽 판은 테 폭만큼 작게 시작한다', () => {
    const [start, end] = rippleLoop(10000, false)
    const [inset] = rippleLoop(10000, true)
    const { from, to, width } = IDLE_RIPPLE

    expect(start.opacity).toBe(0.9)
    expect(end.offset).toBeCloseTo(IDLE_RIPPLE.life / 10000)
    expect(end.opacity).toBe(0)
    expect(start.transform).toBe(`scale(${from / to})`)
    expect(inset.transform).toBe(`scale(${(from - width) / (to - width)})`)
  })
})

describe('idleRipples', () => {
  const pond = (w: number, h: number): Stage => ({
    ...STAGE,
    heights: Array.from({ length: h }, () => Array.from({ length: w }, () => 0)),
    water: 1,
  })

  it('물 칸마다 겹치지 않는 차례를 매기고 물이 없으면 없다', () => {
    const slots = [...idleRipples(pond(4, 3)).values()].sort((a, b) => a - b)

    expect(slots).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
    expect(idleRipples(STAGE).size).toBe(2)
    expect(idleRipples({ ...STAGE, water: undefined }).size).toBe(0)
  })

  it('소용돌이 칸은 고르지 않고 같은 판은 늘 같은 칸을 고른다', () => {
    const stage: Stage = { ...pond(2, 1), entities: [{ type: 'whirlpool', x: 0, y: 0 }] }

    expect([...idleRipples(stage).keys()]).toEqual(['1-0'])
    expect([...idleRipples(pond(4, 3))]).toEqual([...idleRipples(pond(4, 3))])
  })
})

// 물 높이를 칸마다 따로 주는 판, (1,1)은 1.5층, 나머지는 판의 물 높이 2
const rising = (p: { x: number; y: number }) => (p.x === 1 && p.y === 1 ? 2.5 : 2)

describe('waterAt', () => {
  it('그 순간 칸의 물 높이로 깊이를 재고, 막 잠기는 옆 칸은 수면이 옅은 만큼 반사 띠를 남긴다', () => {
    expect(waterDepth(STAGE, { x: 1, y: 1 }, rising)).toBe(1.5)
    expect(waterDepth(STAGE, { x: 0, y: 0 }, () => 2.4)).toBeCloseTo(0.4)
    const look = waterLook(STAGE, { x: 1, y: 1 }, () => 2.4)
    expect(look.bankX).toBeCloseTo(0.5)
    expect(look.bankY).toBeCloseTo(0.5)
    expect(floatShownAt(STAGE, { x: 1, y: 1, level: 1.5 }, rising)).toBe(WATER.lip)
  })

  it('물 높이를 안 주면 판의 물 높이', () => {
    expect(waterDepth(STAGE, { x: 1, y: 1 })).toBe(waterDepth(STAGE, { x: 1, y: 1 }, () => 2))
  })

  it('잔물결은 그 물 높이로 잠긴 칸에서도 인다', () => {
    expect(idleRipples(STAGE, () => 3).size).toBe(8)
  })
})

describe('boatLook', () => {
  it('한 층 넘게 잠기면 수면 위 상자 윗면과 둑 높이만큼 보이는 몸', () => {
    expect(boatLook(1)).toEqual({ top: TILE.layer, shown: WATER.lip })
    expect(boatLook(2)).toEqual({ top: 2 * TILE.layer, shown: WATER.lip })
  })

  it('잠기는 땅 위 상자는 윗면 그대로 물이 차는 만큼 덜 보이는 몸', () => {
    expect(boatLook(0)).toEqual({ top: TILE.layer, shown: TILE.layer })
    expect(boatLook(0.5)).toEqual({ top: TILE.layer, shown: TILE.layer / 2 + WATER.lip })
  })
})

describe('waterTone 소수 깊이', () => {
  it('차오르는 중인 칸은 위아래 깊이의 색을 깊이만큼 섞는다', () => {
    expect(waterTone(0.3)).toBe(waterTone(1))
    expect(waterTone(1.5)).toBe(
      'color-mix(in srgb, var(--color-water-1), var(--color-water-2) 50%)',
    )
    expect(waterTone(3.5)).toBe(waterTone(3))
  })
})

describe('surfaceShown', () => {
  it('잠기는 땅 위로 올라오는 수면은 투명에서 또렷해지고 가만히 있는 물은 늘 또렷하다', () => {
    expect(surfaceShown(0.2)).toBe(0)
    expect(surfaceShown(0.4)).toBeCloseTo(0.5)
    expect(surfaceShown(1)).toBe(1)
  })
})

describe('sunkLift', () => {
  it('물에 잠긴 바닥은 수면 위 물 깊이의 0.3배만큼 떠 보이고 물 밖에서는 그대로다', () => {
    expect(sunkLift(0)).toBe(0)
    expect(sunkLift(0.2)).toBe(0)
    expect(sunkLift(1)).toBeCloseTo(0.3 * (TILE.layer - 6))
  })
})
