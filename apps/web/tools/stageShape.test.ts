import { describe, expect, it } from 'vitest'

import { shapeOf } from './stageShape'
import type { Stage } from '@/game/types'

const FLAT: Stage = {
  version: 1,
  id: 'test-shape',
  heights: [
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  start: { x: 0, y: 0 },
  goal: { x: 3, y: 3 },
  entities: [],
}

describe('shapeOf', () => {
  it('평평한 판은 걸리는 모양이 없다', () => {
    expect(shapeOf(FLAT)).toEqual({ tierPairs: [], pillars: [], grooves: [], rails: [] })
  })

  it('낮은 칸 바로 앞이 두 층 높은데 단 색 차이가 반 단 이하면 층 쌍으로 센다', () => {
    const stage: Stage = {
      ...FLAT,
      heights: [
        [0, 0, 0, 0],
        [2, 2, 2, 2],
        [2, 2, 2, 2],
        [2, 2, 2, 2],
      ],
    }
    expect(shapeOf(stage).tierPairs).toContain('(0,0)-(0,1)')
  })

  it('높은 땅이 뒤에 있으면 층 쌍이 아니다', () => {
    const stage: Stage = {
      ...FLAT,
      heights: [
        [2, 2, 2, 2],
        [2, 2, 2, 2],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ],
    }
    expect(shapeOf(stage).tierPairs).toEqual([])
  })

  it('양옆 땅보다 두 층 이상 높은 한 칸 폭 칸을 기둥으로 센다', () => {
    const stage: Stage = {
      ...FLAT,
      heights: [
        [0, 0, 0, 0],
        [0, 2, 0, 0],
        [0, 2, 0, 0],
        [0, 0, 0, 0],
      ],
    }
    expect(shapeOf(stage).pillars).toEqual(['(1,1)', '(1,2)'])
  })

  it('양옆 같은 높이 땅보다 낮은 한 칸 폭 칸이 두 칸 넘게 이어지면 홈으로 센다', () => {
    const stage: Stage = {
      ...FLAT,
      heights: [
        [1, 1, 1, 1],
        [1, -1, 1, 1],
        [1, -1, 1, 1],
        [1, 1, 1, 1],
      ],
    }
    expect(shapeOf(stage).grooves).toEqual(['(1,1)', '(1,2)'])
  })

  it('외딴 한 칸 구멍은 홈이 아니다', () => {
    const stage: Stage = {
      ...FLAT,
      heights: [
        [1, 1, 1, 1],
        [1, -1, 1, 1],
        [1, 1, 1, 1],
        [1, 1, 1, 1],
      ],
    }
    expect(shapeOf(stage).grooves).toEqual([])
  })

  it('한 칸만 솟은 칸은 기둥이 아니다', () => {
    const stage: Stage = {
      ...FLAT,
      heights: [
        [0, 0, 0, 0],
        [0, 2, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ],
    }
    expect(shapeOf(stage).pillars).toEqual([])
  })

  it('움직이는 발판마다 레일 칸 수를 센다', () => {
    const stage: Stage = {
      ...FLAT,
      entities: [
        {
          type: 'tram',
          id: 'a',
          x: 0,
          y: 1,
          level: 0,
          dir: 1,
          cells: [
            { x: 0, y: 1 },
            { x: 1, y: 1 },
            { x: 2, y: 1 },
          ],
        },
      ],
    }
    expect(shapeOf(stage).rails).toEqual([3])
  })
})
