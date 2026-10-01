import { describe, expect, it } from 'vitest'

import type { GameState, Stage } from '../types'
import { vinesLeft } from './limitRule'
import { move } from './moveRule'
import { createState } from './stateRule'
import { play } from './testStages'

// 뿌리 (1,1)에서 오른쪽으로 세 칸 구덩이를 메우는 덩굴
const VINE_STAGE: Stage = {
  version: 1,
  id: 'test-vine',
  name: '덩굴 테스트',
  heights: [
    [0, 0, 0, 0, 0, 0],
    [0, 0, -1, -1, -1, 0],
    [0, 0, 0, 0, 0, 0],
  ],
  start: { x: 0, y: 0 },
  goal: { x: 5, y: 0 },
  entities: [
    {
      type: 'vine',
      id: 'a',
      x: 1,
      y: 1,
      cells: [
        { x: 2, y: 1 },
        { x: 3, y: 1 },
        { x: 4, y: 1 },
      ],
    },
  ],
}

const grownOf = (state: GameState) => state.vines.map(({ grown }) => grown)

describe('move 덩굴', () => {
  it('한 수에 한 칸씩 구덩이를 높이 0의 땅으로 메운다', () => {
    const one = move(createState(VINE_STAGE), 'down')
    const two = move(one.state, 'up')

    expect(grownOf(one.state)).toEqual([1])
    expect(one.state.heights[1]).toEqual([0, 0, 0, -1, -1, 0])
    expect(one.events).toContainEqual({ type: 'grew', id: 'a', at: { x: 2, y: 1 } })
    expect(grownOf(two.state)).toEqual([2])
    expect(two.state.heights[1]).toEqual([0, 0, 0, 0, -1, 0])
  })

  it('길 끝에 닿으면 더 자라지 않는다', () => {
    const { state, events } = play(VINE_STAGE, ['down', 'up', 'down', 'up', 'down'])

    expect(grownOf(state)).toEqual([3])
    expect(state.heights[1]).toEqual([0, 0, 0, 0, 0, 0])
    expect(events.some((e) => e.type === 'grew')).toBe(false)
  })

  it('막힌 이동은 수로 세지 않아 자라지 않는다', () => {
    const { state } = move(createState(VINE_STAGE), 'up')

    expect(state.moves).toBe(0)
    expect(grownOf(state)).toEqual([0])
  })

  it('여럿이면 한 수에 다 같이 자란다', () => {
    const stage: Stage = {
      ...VINE_STAGE,
      heights: [
        [0, 0, 0, 0, 0, 0],
        [0, 0, -1, -1, -1, 0],
        [0, 0, -1, -1, -1, 0],
      ],
      entities: [
        ...VINE_STAGE.entities,
        {
          type: 'vine',
          id: 'b',
          x: 1,
          y: 2,
          cells: [
            { x: 2, y: 2 },
            { x: 3, y: 2 },
          ],
        },
      ],
    }
    const { state } = move(createState(stage), 'right')

    expect(grownOf(state)).toEqual([1, 1])
    expect(state.heights[1][2]).toBe(0)
    expect(state.heights[2][2]).toBe(0)
  })

  it('자란 칸을 걸어 다닌다', () => {
    const { state } = play(VINE_STAGE, ['down', 'up', 'down', 'right', 'right', 'right', 'right'])

    expect(state.player).toEqual({ x: 4, y: 1 })
  })

  it('자란 칸에 상자가 올라간다', () => {
    const stage: Stage = {
      ...VINE_STAGE,
      entities: [...VINE_STAGE.entities, { type: 'box', x: 1, y: 1 }],
    }
    const { state, events } = play(stage, ['down', 'right'])

    expect(state.boxes).toEqual([{ x: 2, y: 1 }])
    expect(state.heights[1][2]).toBe(0)
    expect(events).toContainEqual({
      type: 'pushed',
      from: { x: 1, y: 1 },
      to: { x: 2, y: 1 },
      result: 'slid',
    })
  })

  it('상자로 구덩이를 먼저 메우면 덩굴이 거기서 멈춘다', () => {
    const stage: Stage = {
      ...VINE_STAGE,
      heights: [
        [0, 0, 0, 0, 0, 0],
        [0, 0, -1, -1, -1, 0],
        [0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0],
      ],
      start: { x: 3, y: 3 },
      entities: [...VINE_STAGE.entities, { type: 'box', x: 3, y: 2 }],
    }
    const { state, events } = play(stage, ['up', 'down', 'up', 'down'])

    expect(grownOf(state)).toEqual([1])
    expect(state.heights[1]).toEqual([0, 0, 0, 0, -1, 0])
    expect(events.some((e) => e.type === 'grew')).toBe(false)
  })

  it('무너지는 칸이 사라져 구덩이가 되면 다시 뻗는다', () => {
    const stage: Stage = {
      ...VINE_STAGE,
      heights: [
        [0, 0, 0, 0, 0, 0],
        [0, 0, 0, -1, -1, 0],
        [0, 0, 0, 0, 0, 0],
      ],
      start: { x: 2, y: 0 },
      cracks: ['......', '..1...', '......'],
    }
    const stepped = move(createState(stage), 'down')
    const left = move(stepped.state, 'up')

    expect(grownOf(stepped.state)).toEqual([0])
    expect(left.events).toContainEqual({
      type: 'cracked',
      at: { x: 2, y: 1 },
      left: 0,
      gone: true,
    })
    expect(grownOf(left.state)).toEqual([1])
    expect(left.state.heights[1][2]).toBe(0)
  })

  it('꺾이는 덩굴이 길을 따라 자란다', () => {
    const stage: Stage = {
      ...VINE_STAGE,
      heights: [
        [0, 0, 0, 0, 0, 0],
        [0, 0, -1, -1, 0, 0],
        [0, 0, 0, -1, 0, 0],
      ],
      entities: [
        {
          type: 'vine',
          id: 'a',
          x: 1,
          y: 1,
          cells: [
            { x: 2, y: 1 },
            { x: 3, y: 1 },
            { x: 3, y: 2 },
          ],
        },
      ],
    }
    const { state, events } = play(stage, ['down', 'up', 'down'])

    expect(grownOf(state)).toEqual([3])
    expect(events).toContainEqual({ type: 'grew', id: 'a', at: { x: 3, y: 2 } })
    expect(state.heights[2][3]).toBe(0)
  })
})

const VINE_STOP_STAGE: Stage = {
  ...VINE_STAGE,
  heights: [
    [0, 0, 0, 0, 0, 0],
    [0, 0, -1, -1, -1, 0],
    [0, 0, -1, -1, -1, 0],
  ],
  start: { x: 1, y: 0 },
  entities: [
    ...VINE_STAGE.entities,
    {
      type: 'vine',
      id: 'b',
      x: 1,
      y: 2,
      cells: [
        { x: 2, y: 2 },
        { x: 3, y: 2 },
        { x: 4, y: 2 },
      ],
    },
  ],
  rules: { vineStop: true },
}

describe('move 굳는 자리', () => {
  it('큐브가 밟은 덩굴은 그 길이로 굳고 다른 덩굴은 계속 자란다', () => {
    const { state } = play(VINE_STOP_STAGE, ['down', 'right', 'left', 'up'])

    expect(state.vines).toEqual([
      { id: 'a', grown: 1, stopped: true },
      { id: 'b', grown: 3, stopped: false },
    ])
    expect(state.heights[1]).toEqual([0, 0, 0, -1, -1, 0])
  })

  it('밟는 그 수에 이미 자라지 않는다', () => {
    const { state, events } = play(VINE_STOP_STAGE, ['down', 'right'])

    expect(state.vines[0]).toEqual({ id: 'a', grown: 1, stopped: true })
    expect(events.some((e) => e.type === 'grew' && e.id === 'a')).toBe(false)
    expect(events).toContainEqual({ type: 'grew', id: 'b', at: { x: 3, y: 2 } })
  })

  it('굳은 덩굴도 계속 밟고 다닌다', () => {
    const { state } = play(VINE_STOP_STAGE, ['down', 'right', 'left', 'right'])

    expect(state.player).toEqual({ x: 2, y: 1 })
    expect(state.heights[1][3]).toBe(-1)
  })

  it('상자가 올라가는 것으로는 굳지 않는다', () => {
    const stage: Stage = {
      ...VINE_STOP_STAGE,
      start: { x: 0, y: 1 },
      entities: [...VINE_STOP_STAGE.entities, { type: 'box', x: 1, y: 1 }],
    }
    const { state } = play(stage, ['up', 'down', 'right'])

    expect(state.boxes).toEqual([{ x: 2, y: 1 }])
    expect(state.vines[0]).toEqual({ id: 'a', grown: 3, stopped: false })
  })

  it('아직 안 굳은 덩굴 수를 알려주고 굳는 자리가 아니면 null이다', () => {
    expect(vinesLeft(createState(VINE_STOP_STAGE))).toBe(2)
    expect(vinesLeft(play(VINE_STOP_STAGE, ['down', 'right']).state)).toBe(1)
    expect(vinesLeft(createState({ ...VINE_STOP_STAGE, rules: undefined }))).toBeNull()
  })

  it('굳는 자리가 아니면 밟아도 굳지 않는다', () => {
    const stage: Stage = { ...VINE_STOP_STAGE, rules: undefined }
    const { state } = play(stage, ['down', 'right', 'left', 'up'])

    expect(state.vines[0]).toEqual({ id: 'a', grown: 3, stopped: false })
  })
})
