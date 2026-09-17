import { describe, expect, it } from 'vitest'

import { createState, move } from './rules'
import type { Stage } from './types'

const FLAT_STAGE: Stage = {
  id: 'test',
  name: '테스트',
  heights: [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ],
  start: { x: 1, y: 1 },
  goal: { x: 2, y: 0 },
  entities: [],
}

describe('createState', () => {
  it('시작 위치에서 이동 수 0으로 시작한다', () => {
    const state = createState(FLAT_STAGE)

    expect(state.player).toEqual({ x: 1, y: 1 })
    expect(state.moves).toBe(0)
    expect(state.cleared).toBe(false)
  })
})

describe('move', () => {
  it('방향에 맞춰 한 칸 이동하고 이동 수를 올린다', () => {
    const cases = [
      { direction: 'up', to: { x: 1, y: 0 } },
      { direction: 'right', to: { x: 2, y: 1 } },
      { direction: 'down', to: { x: 1, y: 2 } },
      { direction: 'left', to: { x: 0, y: 1 } },
    ] as const

    for (const { direction, to } of cases) {
      const { state, events } = move(createState(FLAT_STAGE), direction)

      expect(state.player).toEqual(to)
      expect(state.moves).toBe(1)
      expect(events).toEqual([{ type: 'moved', from: { x: 1, y: 1 }, to }])
    }
  })

  it('필드 밖으로는 이동하지 않고 blocked 이벤트를 돌려준다', () => {
    const start = createState({ ...FLAT_STAGE, start: { x: 0, y: 0 } })
    const { state, events } = move(start, 'left')

    expect(state).toBe(start)
    expect(events).toEqual([{ type: 'blocked', direction: 'left' }])
  })

  it('바닥 없는 칸으로는 이동하지 않는다', () => {
    const stage = {
      ...FLAT_STAGE,
      heights: [
        [0, 0, 0],
        [-1, 0, 0],
        [0, 0, 0],
      ],
    }
    const { state, events } = move(createState(stage), 'left')

    expect(state.player).toEqual({ x: 1, y: 1 })
    expect(events).toEqual([{ type: 'blocked', direction: 'left' }])
  })

  it('높은 칸으로는 올라가지 않는다', () => {
    const stage = {
      ...FLAT_STAGE,
      heights: [
        [0, 0, 0],
        [0, 0, 1],
        [0, 0, 0],
      ],
    }
    const { state, events } = move(createState(stage), 'right')

    expect(state.moves).toBe(0)
    expect(events).toEqual([{ type: 'blocked', direction: 'right' }])
  })

  it('같은 높이 칸으로는 높이가 0이 아니어도 이동한다', () => {
    const stage = {
      ...FLAT_STAGE,
      heights: [
        [0, 0, 0],
        [0, 2, 2],
        [0, 0, 0],
      ],
    }
    const { events } = move(createState(stage), 'right')

    expect(events[0].type).toBe('moved')
  })

  it('낮은 칸으로는 여러 층이어도 내려가고 fell 이벤트를 돌려준다', () => {
    const stage = {
      ...FLAT_STAGE,
      heights: [
        [0, 0, 0],
        [0, 3, 1],
        [0, 0, 0],
      ],
    }
    const { state, events } = move(createState(stage), 'right')

    expect(state.player).toEqual({ x: 2, y: 1 })
    expect(state.moves).toBe(1)
    expect(events).toEqual([{ type: 'fell', from: { x: 1, y: 1 }, to: { x: 2, y: 1 }, drop: 2 }])
  })

  it('목표 칸에 도착하면 클리어한다', () => {
    const start = createState({ ...FLAT_STAGE, start: { x: 2, y: 1 } })
    const { state, events } = move(start, 'up')

    expect(state.cleared).toBe(true)
    expect(events).toEqual([
      { type: 'moved', from: { x: 2, y: 1 }, to: { x: 2, y: 0 } },
      { type: 'cleared' },
    ])
  })

  it('클리어한 뒤에는 이동하지 않는다', () => {
    const cleared = { ...createState(FLAT_STAGE), cleared: true }
    const { state, events } = move(cleared, 'left')

    expect(state).toBe(cleared)
    expect(events).toEqual([])
  })

  it('입력 상태를 바꾸지 않는다', () => {
    const start = createState(FLAT_STAGE)
    move(start, 'up')

    expect(start.player).toEqual({ x: 1, y: 1 })
    expect(start.moves).toBe(0)
  })
})

const BOX_STAGE: Stage = {
  id: 'test-box',
  name: '상자 테스트',
  heights: [
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
  ],
  start: { x: 0, y: 1 },
  goal: { x: 4, y: 0 },
  entities: [{ type: 'box', x: 1, y: 1 }],
}

const withMiddleRow = (row: number[]) => [BOX_STAGE.heights[0], row, BOX_STAGE.heights[2]]

describe('move 상자', () => {
  it('상자를 한 칸 밀고 상자가 있던 칸으로 이동한다', () => {
    const { state, events } = move(createState(BOX_STAGE), 'right')

    expect(state.boxes).toEqual([{ x: 2, y: 1 }])
    expect(state.player).toEqual({ x: 1, y: 1 })
    expect(state.moves).toBe(1)
    expect(events).toEqual([
      { type: 'pushed', from: { x: 1, y: 1 }, to: { x: 2, y: 1 }, result: 'slid' },
      { type: 'moved', from: { x: 0, y: 1 }, to: { x: 1, y: 1 } },
    ])
  })

  it('상자 뒤에 상자가 있으면 밀지 않고 상자 위로 올라간다', () => {
    const stage: Stage = {
      ...BOX_STAGE,
      entities: [
        { type: 'box', x: 1, y: 1 },
        { type: 'box', x: 2, y: 1 },
      ],
    }
    const { state, events } = move(createState(stage), 'right')

    expect(state.boxes).toEqual([
      { x: 1, y: 1 },
      { x: 2, y: 1 },
    ])
    expect(state.player).toEqual({ x: 1, y: 1 })
    expect(events).toEqual([{ type: 'climbed', from: { x: 0, y: 1 }, to: { x: 1, y: 1 } }])
  })

  it('상자 뒤가 필드 밖이면 상자 위로 올라간다', () => {
    const stage: Stage = {
      ...BOX_STAGE,
      start: { x: 3, y: 1 },
      entities: [{ type: 'box', x: 4, y: 1 }],
    }
    const { events } = move(createState(stage), 'right')

    expect(events[0].type).toBe('climbed')
  })

  it('상자 뒤가 높은 칸이면 상자 위로 올라가고 그 칸으로 이어서 갈 수 있다', () => {
    const stage: Stage = { ...BOX_STAGE, heights: withMiddleRow([0, 0, 1, 1, 1]) }
    const climbed = move(createState(stage), 'right')
    const next = move(climbed.state, 'right')

    expect(climbed.events[0].type).toBe('climbed')
    expect(next.state.player).toEqual({ x: 2, y: 1 })
    expect(next.events).toEqual([{ type: 'moved', from: { x: 1, y: 1 }, to: { x: 2, y: 1 } }])
  })

  it('상자 위에서 낮은 칸으로 내려간다', () => {
    const stage: Stage = { ...BOX_STAGE, heights: withMiddleRow([0, 0, 1, 1, 1]) }
    const climbed = move(createState(stage), 'right')
    const { events } = move(climbed.state, 'up')

    expect(events).toEqual([{ type: 'fell', from: { x: 1, y: 1 }, to: { x: 1, y: 0 }, drop: 1 }])
  })

  it('높은 곳에 놓인 상자는 밀지도 올라가지도 못한다', () => {
    const stage: Stage = { ...BOX_STAGE, heights: withMiddleRow([0, 1, 1, 1, 1]) }
    const { state, events } = move(createState(stage), 'right')

    expect(state.player).toEqual({ x: 0, y: 1 })
    expect(events).toEqual([{ type: 'blocked', direction: 'right' }])
  })

  it('높은 곳에서 한 층 낮은 상자 위로는 걸어서 올라선다', () => {
    const stage: Stage = { ...BOX_STAGE, heights: withMiddleRow([1, 0, 0, 0, 0]) }
    const { state, events } = move(createState(stage), 'right')

    expect(state.boxes).toEqual([{ x: 1, y: 1 }])
    expect(events).toEqual([{ type: 'moved', from: { x: 0, y: 1 }, to: { x: 1, y: 1 } }])
  })

  it('낮은 칸 쪽으로 밀면 상자가 떨어진다', () => {
    const stage: Stage = { ...BOX_STAGE, heights: withMiddleRow([1, 1, 0, 0, 0]) }
    const { state, events } = move(createState(stage), 'right')

    expect(state.boxes).toEqual([{ x: 2, y: 1 }])
    expect(events[0]).toEqual({
      type: 'pushed',
      from: { x: 1, y: 1 },
      to: { x: 2, y: 1 },
      result: 'fell',
    })
  })

  it('바닥 없는 칸으로 밀면 상자가 밀던 높이의 바닥으로 메운다', () => {
    const stage: Stage = { ...BOX_STAGE, heights: withMiddleRow([1, 1, -1, 1, 1]) }
    const pushed = move(createState(stage), 'right')
    const next = move(pushed.state, 'right')

    expect(pushed.state.boxes).toEqual([])
    expect(pushed.state.heights[1][2]).toBe(1)
    expect(pushed.events[0]).toEqual({
      type: 'pushed',
      from: { x: 1, y: 1 },
      to: { x: 2, y: 1 },
      result: 'filled',
    })
    expect(next.events[0].type).toBe('moved')
  })

  it('목표 칸으로는 밀지 않고 상자 위로 올라간다', () => {
    const stage: Stage = { ...BOX_STAGE, goal: { x: 2, y: 1 } }
    const { state, events } = move(createState(stage), 'right')

    expect(state.boxes).toEqual([{ x: 1, y: 1 }])
    expect(events[0].type).toBe('climbed')
  })

  it('입력 상태의 상자와 높이를 바꾸지 않는다', () => {
    const stage: Stage = { ...BOX_STAGE, heights: withMiddleRow([1, 1, -1, 1, 1]) }
    const start = createState(stage)
    move(start, 'right')

    expect(start.boxes).toEqual([{ x: 1, y: 1 }])
    expect(start.heights[1][2]).toBe(-1)
    expect(stage.heights[1][2]).toBe(-1)
  })
})
