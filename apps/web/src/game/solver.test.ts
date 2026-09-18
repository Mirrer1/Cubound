import { describe, expect, it } from 'vitest'

import { createState, move } from './rules'
import { moveLimit, solve, stars } from './solver'
import type { Stage } from './types'

const STAGE: Stage = {
  version: 1,
  id: 'test-solver',
  name: '풀이 테스트',
  heights: [
    [0, 0, 0],
    [0, -1, 0],
    [0, 0, 0],
  ],
  start: { x: 0, y: 0 },
  goal: { x: 2, y: 2 },
  entities: [],
}

describe('solve', () => {
  it('최소 이동 수와 그대로 따라 하면 클리어되는 경로를 돌려준다', () => {
    const result = solve(STAGE)

    expect(result.status).toBe('solved')
    if (result.status !== 'solved') return
    expect(result.moves).toBe(4)
    expect(result.path).toHaveLength(4)

    const end = result.path.reduce((state, d) => move(state, d).state, createState(STAGE))
    expect(end.cleared).toBe(true)
  })

  it('목표에 갈 수 없으면 unsolvable을 돌려준다', () => {
    const stage: Stage = {
      ...STAGE,
      heights: [
        [0, 0, 0],
        [0, 0, 1],
        [0, 1, 1],
      ],
      goal: { x: 2, y: 2 },
    }

    expect(solve(stage).status).toBe('unsolvable')
  })

  it('상자를 밀어야 하는 경로도 찾는다', () => {
    const stage: Stage = {
      ...STAGE,
      heights: [[0, 0, 0, 1, 1]],
      start: { x: 0, y: 0 },
      goal: { x: 4, y: 0 },
      entities: [{ type: 'box', x: 1, y: 0 }],
    }
    const result = solve(stage)

    expect(result).toEqual({
      status: 'solved',
      moves: 4,
      path: ['right', 'right', 'right', 'right'],
    })
  })

  it('탐색 상태 수 한도를 넘으면 limit을 돌려준다', () => {
    expect(solve(STAGE, { maxStates: 2 }).status).toBe('limit')
  })

  it('보스 이동 제한이 있어도 최소 이동 수는 달라지지 않는다', () => {
    const limited: Stage = { ...STAGE, rules: { moveLimit: 1 } }

    expect(solve(limited)).toEqual(solve(STAGE))
  })
})

describe('moveLimit', () => {
  it('최소 이동 수에 20% 여유를 올림해 더한다', () => {
    expect(moveLimit(20)).toBe(24)
    expect(moveLimit(7)).toBe(9)
  })
})

describe('stars', () => {
  it('최소 이동이면 3개, 여유 안이면 2개, 그 밖은 1개다', () => {
    expect(stars(20, 20)).toBe(3)
    expect(stars(24, 20)).toBe(2)
    expect(stars(25, 20)).toBe(1)
  })

  it('보스 이동 제한을 넘기면 그 제한을 별 기준으로 쓴다', () => {
    expect(stars(20, 20, 22)).toBe(3)
    expect(stars(22, 20, 22)).toBe(2)
    expect(stars(23, 20, 22)).toBe(1)
  })

  it('제한 안에 클리어하면 항상 별이 2개 이상이다', () => {
    const limit = 22
    const inside = Array.from({ length: limit - 20 + 1 }, (_, i) => stars(20 + i, 20, limit))

    expect(inside.every((count) => count >= 2)).toBe(true)
  })
})
