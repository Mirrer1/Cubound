/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import { floorFaces, floorTier, lowestOf } from './tierView'

const CSS = readFileSync(new URL('../../../index.css', import.meta.url), 'utf8')

describe('lowestOf', () => {
  it('구멍을 뺀 가장 낮은 땅', () => {
    expect(
      lowestOf({
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
      lowestOf({
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
      lowestOf({
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
      lowestOf({
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

describe('floorTier', () => {
  it('가장 낮은 땅이 1단', () => {
    expect(floorTier(1, 1)).toBe(1)
  })

  it('한 층과 두 층 차이는 다른 단', () => {
    expect(floorTier(2, 1)).toBe(2)
    expect(floorTier(3, 1)).toBe(3)
  })

  it('8단 상한', () => {
    expect(floorTier(20, 0)).toBe(8)
  })

  it('깎여 더 낮아진 칸은 1단 하한', () => {
    expect(floorTier(0, 2)).toBe(1)
  })

  it('움직이는 중간 높이는 소수 단', () => {
    expect(floorTier(1.5, 0)).toBe(2.5)
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
