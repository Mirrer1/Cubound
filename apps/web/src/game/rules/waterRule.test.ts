import { describe, expect, it } from 'vitest'

import type { GameState, Stage } from '../types'
import { move } from './moveRule'
import { createState, standHeight } from './stateRule'
import { play } from './testStages'

// 물 높이 1, 가운데 줄 x 2~4가 물 칸
const WATER_STAGE: Stage = {
  version: 1,
  id: 'test-water',
  name: '물 테스트',
  heights: [
    [1, 1, 1, 1, 1, 1],
    [1, 1, 0, 0, 0, 1],
    [1, 1, 1, 1, 1, 1],
  ],
  water: 1,
  start: { x: 0, y: 1 },
  goal: { x: 5, y: 0 },
  entities: [{ type: 'box', x: 1, y: 1 }],
}

// 상자 하나가 뜬 채로 시작하는 판
const floating = (x: number, rest: Partial<Stage> = {}): Stage => ({
  ...WATER_STAGE,
  start: { x: 1, y: 1 },
  entities: [{ type: 'box', x, y: 1 }],
  ...rest,
})

// 큐브가 x 칸의 뜬 상자를 타고 시작하는 판
const riding = (x: number, rest: Partial<Stage> = {}): Stage =>
  floating(x, { start: { x, y: 1 }, ...rest })

describe('move 물', () => {
  it('큐브는 빈 물 칸으로 못 들어간다', () => {
    const stage: Stage = { ...WATER_STAGE, start: { x: 1, y: 1 }, entities: [] }
    const { state, events } = move(createState(stage), 'right')

    expect(state.player).toEqual({ x: 1, y: 1 })
    expect(events).toEqual([{ type: 'blocked', direction: 'right' }])
  })

  it('높은 땅에서도 빈 물 칸으로는 못 떨어진다', () => {
    const stage: Stage = {
      ...WATER_STAGE,
      heights: [
        [1, 1, 1, 1, 1, 1],
        [1, 2, 0, 0, 0, 1],
        [1, 1, 1, 1, 1, 1],
      ],
      start: { x: 1, y: 1 },
      entities: [],
    }

    expect(move(createState(stage), 'right').events).toEqual([
      { type: 'blocked', direction: 'right' },
    ])
  })

  it('물에 밀린 상자는 메워지지 않고 떠서 윗면이 물 높이와 같다', () => {
    const { state, events } = move(createState(WATER_STAGE), 'right')

    expect(state.boxes).toEqual([{ x: 2, y: 1 }])
    expect(state.heights).toBe(WATER_STAGE.heights)
    expect(state.player).toEqual({ x: 1, y: 1 })
    expect(state.pushes).toBe(1)
    expect(standHeight(state, { x: 2, y: 1 })).toBe(1)
    expect(events).toEqual([
      { type: 'pushed', from: { x: 1, y: 1 }, to: { x: 2, y: 1 }, result: 'floated' },
      { type: 'moved', from: { x: 0, y: 1 }, to: { x: 1, y: 1 } },
    ])
  })

  it('높은 땅에서 밀어 떨어뜨린 상자도 물에 뜬다', () => {
    const stage: Stage = {
      ...WATER_STAGE,
      heights: [
        [2, 2, 1, 1, 1, 1],
        [2, 2, 0, 0, 0, 1],
        [2, 2, 1, 1, 1, 1],
      ],
    }
    const { state, events } = move(createState(stage), 'right')

    expect(state.boxes).toEqual([{ x: 2, y: 1 }])
    expect(standHeight(state, { x: 2, y: 1 })).toBe(1)
    expect(events[0]).toEqual({
      type: 'pushed',
      from: { x: 1, y: 1 },
      to: { x: 2, y: 1 },
      result: 'floated',
    })
  })

  it('물이 깊어도 뜬 상자 윗면은 물 높이와 같다', () => {
    const stage: Stage = {
      ...floating(2),
      heights: [
        [2, 2, 2, 2, 2, 2],
        [2, 2, 0, 1, 0, 2],
        [2, 2, 2, 2, 2, 2],
      ],
      water: 2,
    }

    expect(standHeight(createState(stage), { x: 2, y: 1 })).toBe(2)
  })

  it('버섯에 날린 상자도 물 칸에 떨어지면 뜬다', () => {
    const stage: Stage = {
      ...WATER_STAGE,
      heights: [
        [1, 1, 1, 1, 1, 1],
        [1, 1, 1, 1, 0, 1],
        [1, 1, 1, 1, 1, 1],
      ],
      mushroom: ['......', '..#...', '......'],
    }
    const { state, events } = move(createState(stage), 'right')

    expect(state.boxes).toEqual([{ x: 4, y: 1 }])
    expect(standHeight(state, { x: 4, y: 1 })).toBe(1)
    expect(events[0]).toEqual({
      type: 'pushed',
      from: { x: 1, y: 1 },
      to: { x: 4, y: 1 },
      result: 'floated',
    })
  })

  it('뜬 상자가 있는 물 칸으로는 땅 위 상자를 못 밀고 큐브가 상자에 올라선다', () => {
    const stage: Stage = {
      ...WATER_STAGE,
      entities: [
        { type: 'box', x: 1, y: 1 },
        { type: 'box', x: 2, y: 1 },
      ],
    }
    const { state, events } = move(createState(stage), 'right')

    expect(state.boxes).toEqual(stage.entities.map(({ x, y }) => ({ x, y })))
    expect(state.player).toEqual({ x: 1, y: 1 })
    expect(events).toEqual([
      { type: 'climbed', from: { x: 0, y: 1 }, to: { x: 1, y: 1 }, via: 'box' },
    ])
  })
})

describe('move 땅에서 뜬 상자 쪽', () => {
  it('너머가 빈 물이어도 밀지 않고 올라탄다', () => {
    const { state, events } = move(createState(floating(2)), 'right')

    expect(state.boxes).toEqual([{ x: 2, y: 1 }])
    expect(state.player).toEqual({ x: 2, y: 1 })
    expect(state.moves).toBe(1)
    expect(state.pushes).toBe(0)
    expect(events).toEqual([{ type: 'moved', from: { x: 1, y: 1 }, to: { x: 2, y: 1 } }])
  })

  it('너머가 땅이면 밀지 않고 올라탄다', () => {
    const { state, events } = move(createState(floating(4, { start: { x: 4, y: 0 } })), 'down')

    expect(state.boxes).toEqual([{ x: 4, y: 1 }])
    expect(state.player).toEqual({ x: 4, y: 1 })
    expect(state.pushes).toBe(0)
    expect(events).toEqual([{ type: 'moved', from: { x: 4, y: 0 }, to: { x: 4, y: 1 } }])
  })

  it('너머가 다른 뜬 상자면 올라탄다', () => {
    const stage = floating(2, {
      entities: [
        { type: 'box', x: 2, y: 1 },
        { type: 'box', x: 3, y: 1 },
      ],
    })
    const { state } = move(createState(stage), 'right')

    expect(state.player).toEqual({ x: 2, y: 1 })
    expect(state.boxes).toEqual([
      { x: 2, y: 1 },
      { x: 3, y: 1 },
    ])
  })

  it('너머가 바닥 없는 칸이면 메우지 않고 올라탄다', () => {
    const stage = floating(4, {
      heights: [
        [1, 1, 1, 1, 1, 1],
        [1, 1, 0, 0, 0, 1],
        [1, 1, 1, 1, -1, 1],
      ],
      start: { x: 4, y: 0 },
    })
    const { state } = move(createState(stage), 'down')

    expect(state.player).toEqual({ x: 4, y: 1 })
    expect(state.boxes).toEqual([{ x: 4, y: 1 }])
    expect(state.heights).toBe(stage.heights)
  })

  it('높은 땅에서는 밀지 않고 떨어지듯 내려 탄다', () => {
    const stage = floating(2, {
      heights: [
        [1, 1, 1, 1, 1, 1],
        [1, 2, 0, 0, 0, 1],
        [1, 1, 1, 1, 1, 1],
      ],
    })
    const { state, events } = move(createState(stage), 'right')

    expect(state.player).toEqual({ x: 2, y: 1 })
    expect(state.boxes).toEqual([{ x: 2, y: 1 }])
    expect(events).toEqual([{ type: 'fell', from: { x: 1, y: 1 }, to: { x: 2, y: 1 }, drop: 1 }])
  })
})

describe('move 뜬 상자를 타고', () => {
  it('앞이 빈 물이면 큐브와 상자가 같이 한 칸 가고 밀기로 세지 않는다', () => {
    const { state, events } = move(createState(riding(2)), 'right')

    expect(state.player).toEqual({ x: 3, y: 1 })
    expect(state.boxes).toEqual([{ x: 3, y: 1 }])
    expect(state.moves).toBe(1)
    expect(state.pushes).toBe(0)
    expect(events).toEqual([{ type: 'rowed', from: { x: 2, y: 1 }, to: { x: 3, y: 1 } }])
  })

  it('저어 가도 미끄러지지 않고 한 칸씩 간다', () => {
    const { state } = play(riding(2), ['right', 'right'])

    expect(state.player).toEqual({ x: 4, y: 1 })
    expect(state.boxes).toEqual([{ x: 4, y: 1 }])
  })

  it('앞이 같은 높이 땅이면 큐브만 걸어 내리고 상자는 남는다', () => {
    const { state, events } = move(createState(riding(4)), 'right')

    expect(state.player).toEqual({ x: 5, y: 1 })
    expect(state.boxes).toEqual([{ x: 4, y: 1 }])
    expect(events).toEqual([{ type: 'moved', from: { x: 4, y: 1 }, to: { x: 5, y: 1 } }])
  })

  it('앞이 다른 뜬 상자면 큐브만 옮겨 타고 두 상자는 제자리다', () => {
    const stage = riding(2, {
      entities: [
        { type: 'box', x: 2, y: 1 },
        { type: 'box', x: 3, y: 1 },
      ],
    })
    const { state, events } = move(createState(stage), 'right')

    expect(state.player).toEqual({ x: 3, y: 1 })
    expect(state.boxes).toEqual([
      { x: 2, y: 1 },
      { x: 3, y: 1 },
    ])
    expect(events).toEqual([{ type: 'moved', from: { x: 2, y: 1 }, to: { x: 3, y: 1 } }])
  })

  it('앞이 높은 땅이면 막힌다', () => {
    const stage = riding(2, {
      heights: [
        [1, 1, 2, 1, 1, 1],
        [1, 1, 0, 0, 0, 1],
        [1, 1, 1, 1, 1, 1],
      ],
    })
    const { state, events } = move(createState(stage), 'up')

    expect(state.player).toEqual({ x: 2, y: 1 })
    expect(events).toEqual([{ type: 'blocked', direction: 'up' }])
  })

  it('앞이 땅 위 상자면 땅에서처럼 밀고 그 칸으로 걸어 내린다', () => {
    const stage = riding(2, {
      heights: [...WATER_STAGE.heights, [1, 1, 1, 1, 1, 1]],
      entities: [
        { type: 'box', x: 2, y: 1 },
        { type: 'box', x: 2, y: 2 },
      ],
    })
    const { state } = move(createState(stage), 'down')

    expect(state.player).toEqual({ x: 2, y: 2 })
    expect(state.boxes).toContainEqual({ x: 2, y: 1 })
    expect(state.boxes).toContainEqual({ x: 2, y: 3 })
  })
})

describe('move 뜬 상자 위의 도구', () => {
  const CLIFF = [
    [1, 1, 2, 1, 1, 1],
    [1, 1, 0, 0, 0, 1],
    [1, 1, 1, 1, 1, 1],
  ]

  it('뜬 상자 위에서는 한 층 높은 칸 쪽으로 사다리를 놓지 않는다', () => {
    const state: GameState = {
      ...createState(riding(2, { heights: CLIFF })),
      carrying: 'ladder',
    }
    const { state: after, events } = move(state, 'up')

    expect(after.carrying).toBe('ladder')
    expect(after.leaningLadders).toEqual([])
    expect(events).toEqual([{ type: 'blocked', direction: 'up' }])
  })

  it('뜬 상자 위에서는 씨앗을 심지 않는다', () => {
    const state: GameState = { ...createState(riding(2, { heights: CLIFF })), carrying: 'seed' }
    const { state: after, events } = move(state, 'up')

    expect(after.carrying).toBe('seed')
    expect(after.planted).toEqual([])
    expect(events).toEqual([{ type: 'blocked', direction: 'up' }])
  })

  it('들고 있는 것은 저어 가는 동안 그대로다', () => {
    const state: GameState = { ...createState(riding(2)), carrying: 'ladder' }

    expect(move(state, 'right').state.carrying).toBe('ladder')
  })
})

describe('move 물과 바람', () => {
  // 물이 두 줄이라 위는 땅, 아래는 빈 물
  const WINDY: Stage = {
    ...riding(2),
    heights: [
      [1, 1, 1, 1, 1],
      [1, 0, 0, 0, 1],
      [1, 0, 0, 0, 1],
      [1, 1, 1, 1, 1],
    ],
    goal: { x: 4, y: 3 },
  }
  const gusty = (wind: 'up' | 'down'): GameState => ({
    ...createState({ ...WINDY, rules: { wind } }),
    moves: 3,
  })

  it('뜬 상자를 탄 큐브는 바람 쪽이 빈 물이면 버티고 상자도 안 밀린다', () => {
    const { state, events } = move(gusty('down'), 'left')

    expect(state.player).toEqual({ x: 1, y: 1 })
    expect(state.boxes).toEqual([{ x: 1, y: 1 }])
    expect(events.at(-1)).toEqual({ type: 'braced', direction: 'down' })
  })

  it('뜬 상자를 탄 큐브는 바람 쪽이 같은 높이 땅이면 밀려 내리고 상자는 남는다', () => {
    const { state, events } = move(gusty('up'), 'left')

    expect(state.player).toEqual({ x: 1, y: 0 })
    expect(state.boxes).toEqual([{ x: 1, y: 1 }])
    expect(events).toContainEqual({
      type: 'blown',
      from: { x: 1, y: 1 },
      to: { x: 1, y: 0 },
      direction: 'up',
    })
  })
})
