/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import { baseOf, floorFaces, floorTier, tierScale } from './tierView'

const CSS = readFileSync(new URL('../../../index.css', import.meta.url), 'utf8')

describe('baseOf', () => {
  it('구멍을 뺀 땅 중 칸이 가장 많은 높이, 같으면 낮은 쪽', () => {
    expect(
      baseOf({
        heights: [
          [0, 1, 1],
          [1, 1, 0],
        ],
        entities: [],
        goal: { x: 0, y: 0 },
      }),
    ).toBe(1)
  })

  it('칸 수가 같으면 낮은 높이', () => {
    expect(
      baseOf({
        heights: [
          [-1, 2],
          [3, 1],
        ],
        entities: [],
        goal: { x: 0, y: 0 },
      }),
    ).toBe(1)
  })

  it('승강 발판 칸은 땅에서 제외', () => {
    expect(
      baseOf({
        heights: [
          [2, 2],
          [0, 2],
        ],
        entities: [{ type: 'lift', id: 'l', x: 0, y: 1 }],
        goal: { x: 1, y: 1 },
      }),
    ).toBe(2)
  })

  it('물에 잠긴 칸, 집, 얼음, 늪, 무너지는 칸, 숯, 짝 칸은 땅에서 제외', () => {
    expect(
      baseOf({
        heights: [
          [0, 1, 1, 1],
          [1, 1, 1, 2],
          [1, 1, 2, 2],
        ],
        water: 1,
        ice: ['....', '#...', '....'],
        swamp: ['....', '.#..', '....'],
        cracks: ['....', '..2.', '....'],
        fire: ['.#=@', '....', '....'],
        entities: [{ type: 'warp', id: 'w', x: 1, y: 2 }],
        goal: { x: 0, y: 2 },
      }),
    ).toBe(2)
    expect(
      baseOf({
        heights: [
          [1, 2],
          [2, 2],
        ],
        ice: ['#.', '..'],
        entities: [],
        goal: { x: 1, y: 1 },
      }),
    ).toBe(2)
  })
})

describe('tierScale', () => {
  const stage = (heights: number[][]) => ({ heights, entities: [], goal: { x: 9, y: 9 } })

  it('사이에 빈 층이 있어도 있는 높이끼리 한 단', () => {
    expect(tierScale(stage([[0, 0, 0, 2, 2]]))).toEqual([
      [0, 1],
      [2, 2],
    ])
  })

  it('가장 많은 높이가 1단이고 아래는 반 단씩 두 단까지', () => {
    expect(tierScale(stage([[0, 1, 2, 2, 3, 3, 3, 3]]))).toEqual([
      [0, 0],
      [1, 0],
      [2, 0.5],
      [3, 1],
    ])
  })

  it('가장 많은 높이와 비슷하게 넓은 낮은 높이가 있으면 그쪽이 1단', () => {
    expect(tierScale(stage([[...Array(9).fill(0), ...Array(10).fill(2)]]))).toEqual([
      [0, 1],
      [2, 2],
    ])
  })

  it('칸이 적은 높이는 단으로 세지 않음', () => {
    expect(tierScale(stage([[...Array(12).fill(0), 1, ...Array(8).fill(2)]]))).toEqual([
      [0, 1],
      [2, 2],
    ])
  })
})

describe('floorTier', () => {
  const scale: [number, number][] = [
    [0, 1],
    [2, 2],
  ]

  it('단으로 세는 높이는 그 단', () => {
    expect(floorTier(0, scale)).toBe(1)
    expect(floorTier(2, scale)).toBe(2)
  })

  it('사이 높이는 고르게 나눈 소수 단', () => {
    expect(floorTier(1, scale)).toBe(1.5)
  })

  it('맨 위 밖은 한 층에 한 단, 8단 상한', () => {
    expect(floorTier(3, scale)).toBe(3)
    expect(floorTier(20, scale)).toBe(8)
  })

  it('맨 아래 밖은 한 층에 반 단, 0 하한', () => {
    expect(floorTier(-1, scale)).toBe(0.5)
    expect(floorTier(-5, scale)).toBe(0)
  })
})

describe('floorFaces', () => {
  it('정수 단은 그 단 토큰', () => {
    expect(floorFaces(3, false)).toEqual({
      top: 'var(--color-floor-3-top)',
      left: 'var(--color-floor-3-left)',
      right: 'var(--color-floor-3-right)',
    })
  })

  it('(x+y) 홀수 칸은 top-alt', () => {
    expect(floorFaces(1, true).top).toBe('var(--color-floor-1-top-alt)')
  })

  it('1단보다 밝은 단은 1단을 바탕색 쪽으로 섞은 색, 옆면은 덜 섞음', () => {
    expect(floorFaces(0.5, false)).toEqual({
      top: 'color-mix(in oklab, var(--color-floor-1-top), var(--color-surface) 15%)',
      left: 'color-mix(in oklab, var(--color-floor-1-left), var(--color-surface) 6%)',
      right: 'color-mix(in oklab, var(--color-floor-1-right), var(--color-surface) 6%)',
    })
  })

  it('소수 단은 위아래 단을 oklab으로 섞은 색', () => {
    expect(floorFaces(2.25, false).left).toBe(
      'color-mix(in oklab, var(--color-floor-2-left), var(--color-floor-3-left) 25%)',
    )
  })
})

describe('단 토큰', () => {
  const blocks = CSS.split(/(?=@theme|html\[data-cycle=)/).filter(
    (block) => block.startsWith('@theme static') || block.startsWith('html[data-cycle='),
  )

  it('@theme과 챕터 블록 넷', () => {
    expect(blocks).toHaveLength(4)
  })

  it.each(blocks.map((block) => [block.slice(0, block.indexOf('{')).trim(), block]))(
    '%s에 1~8단 32개',
    (_, block) => {
      for (let tier = 1; tier <= 8; tier++) {
        for (const face of ['top', 'top-alt', 'left', 'right']) {
          expect(block).toMatch(new RegExp(`--color-floor-${tier}-${face}: #[0-9a-f]{6};`))
        }
      }
    },
  )
})
