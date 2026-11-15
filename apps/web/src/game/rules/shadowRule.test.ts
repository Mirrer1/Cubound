import { describe, expect, it } from 'vitest'

import { solve } from '../solver'
import type { Stage } from '../types'
import { play } from './testStages'

// (3,0) (4,0)이 높이 0의 그림자 다리 두 칸, 그 아래 줄은 구덩이
const SHADOW_STAGE: Stage = {
  version: 1,
  id: 'test-shadow',
  heights: [
    [0, 0, 0, -1, -1, 0, 0],
    [0, 0, 0, -1, -1, 0, 0],
  ],
  shadow: ['...00..', '.......'],
  start: { x: 6, y: 0 },
  goal: { x: 0, y: 1 },
  entities: [],
}

// (2,0) 한 칸 다리
const ONE_STAGE: Stage = {
  ...SHADOW_STAGE,
  heights: [
    [0, 0, -1, 0, 0],
    [0, 0, -1, 0, 0],
  ],
  shadow: ['..0..', '.....'],
  start: { x: 0, y: 0 },
  goal: { x: 4, y: 1 },
}

// (3,0)~(5,0) 세 칸 다리와 (2,0) 상자
const BOX_STAGE: Stage = {
  ...SHADOW_STAGE,
  heights: [
    [0, 0, 0, -1, -1, -1, 0],
    [0, 0, 0, -1, -1, -1, 0],
  ],
  shadow: ['...000.', '.......'],
  start: { x: 0, y: 0 },
  goal: { x: 6, y: 1 },
  entities: [{ type: 'box', x: 2, y: 0 }],
}

const at = (stage: Stage, x: number, y: number): Stage => ({ ...stage, start: { x, y } })

describe('그림자 다리', () => {
  it('밝을 때 다리 칸은 바닥 없는 칸이다', () => {
    const { state } = play(at(SHADOW_STAGE, 5, 0), ['left'])

    expect(state.player).toEqual({ x: 5, y: 0 })
    expect(state.moves).toBe(0)
  })

  it('어둠 1수 전부터 올라 어둠 두 수 동안 두 칸 다리를 건넌다', () => {
    const path = ['down', 'left', 'up', 'left', 'left', 'left'] as const
    const { state } = play(SHADOW_STAGE, [...path])

    expect(play(SHADOW_STAGE, path.slice(0, 4)).state.player).toEqual({ x: 4, y: 0 })
    expect(state.player).toEqual({ x: 2, y: 0 })
    expect(state.moves).toBe(6)
  })

  it('밝아질 때 다리 위의 큐브는 다리에 오르기 전 칸으로 간다', () => {
    const path = ['right', 'right', 'down', 'up', 'right', 'right'] as const
    const { state, events } = play(at(SHADOW_STAGE, 0, 0), [...path])

    expect(state.player).toEqual({ x: 2, y: 0 })
    expect(state.moves).toBe(6)
    expect(events).toContainEqual({ type: 'returned', from: { x: 4, y: 0 }, to: { x: 2, y: 0 } })
  })

  it('두 칸 다리는 한쪽에서만 건너진다', () => {
    expect(solve({ ...at(SHADOW_STAGE, 0, 0), goal: { x: 6, y: 1 } }).status).toBe('unsolvable')
    expect(solve(SHADOW_STAGE).status).toBe('solved')
  })

  it('한 칸 다리는 양쪽에서 건너진다', () => {
    const fromLeft = play(ONE_STAGE, ['right', 'down', 'up', 'right', 'right'])
    const fromRight = play(at(ONE_STAGE, 4, 0), ['left', 'down', 'up', 'left', 'left'])

    expect(fromLeft.state.player).toEqual({ x: 3, y: 0 })
    expect(fromRight.state.player).toEqual({ x: 1, y: 0 })
  })

  it('어둠에 다리 위로 민 상자는 밝아질 때 그 칸을 다리 높이로 메운다', () => {
    const path = ['right', 'down', 'up', 'right', 'right', 'left'] as const
    const { state, events } = play(BOX_STAGE, [...path])

    expect(state.boxes).toEqual([])
    expect(state.heights[0].slice(3, 6)).toEqual([-1, 0, -1])
    expect(events).toContainEqual({ type: 'shadowFilled', at: { x: 4, y: 0 } })
  })

  it('밝을 때 다리 칸으로 민 상자는 첫 칸만 메운다', () => {
    const { state } = play(at(BOX_STAGE, 1, 0), ['right'])

    expect(state.heights[0].slice(3, 6)).toEqual([0, -1, -1])
  })

  it('메운 칸은 밝을 때도 바닥이다', () => {
    const { state } = play(at(BOX_STAGE, 1, 0), ['right', 'right', 'right'])

    expect(state.player).toEqual({ x: 3, y: 0 })
    expect(state.moves).toBe(2)
  })
})
