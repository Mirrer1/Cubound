import { describe, expect, it } from 'vitest'

import type { Direction, Stage } from '../types'
import { move } from './moveRule'
import { createState } from './stateRule'
import { play } from './testStages'

// 물 높이 1, x 2~5와 y 1~2가 물 칸, (2,0) 말뚝에 줄 길이 2로 묶인 배가 (2,1)
const TETHER_STAGE: Stage = {
  version: 1,
  id: 'test-tether',
  name: '묶인 배 테스트',
  heights: [
    [1, 1, 1, 1, 1, 1, 1],
    [1, 1, 0, 0, 0, 0, 1],
    [1, 1, 0, 0, 0, 0, 1],
    [1, 1, 1, 1, 1, 1, 1],
  ],
  water: 1,
  start: { x: 1, y: 1 },
  goal: { x: 6, y: 3 },
  entities: [
    { type: 'box', x: 2, y: 1 },
    { type: 'post', x: 2, y: 0, length: 2, boat: { x: 2, y: 1 } },
  ],
}

// 한 줄 땅에 (3,0) 말뚝만 박힌 판
const POST_ROW: Stage = {
  ...TETHER_STAGE,
  heights: [[0, 0, 0, 0, 0]],
  water: undefined,
  start: { x: 0, y: 0 },
  goal: { x: 4, y: 0 },
  entities: [{ type: 'post', x: 3, y: 0, length: 1, boat: { x: 3, y: 1 } }],
}

describe('createState 묶인 배', () => {
  it('말뚝 순서대로 묶인 배의 처음 자리를 기억한다', () => {
    const stage: Stage = {
      ...TETHER_STAGE,
      entities: [
        { type: 'post', x: 6, y: 1, length: 3, boat: { x: 5, y: 2 } },
        ...TETHER_STAGE.entities,
        { type: 'box', x: 5, y: 2 },
      ],
    }

    expect(createState(TETHER_STAGE).tethered).toEqual([{ x: 2, y: 1 }])
    expect(createState(stage).tethered).toEqual([
      { x: 5, y: 2 },
      { x: 2, y: 1 },
    ])
  })
})

describe('move 묶인 배', () => {
  it('줄 길이 안의 물 칸으로는 배와 큐브가 같이 저어 간다', () => {
    const { state, events } = play(TETHER_STAGE, ['right', 'right'])

    expect(state.player).toEqual({ x: 3, y: 1 })
    expect(state.boxes).toEqual([{ x: 3, y: 1 }])
    expect(state.tethered).toEqual([{ x: 3, y: 1 }])
    expect(events).toEqual([{ type: 'rowed', from: { x: 2, y: 1 }, to: { x: 3, y: 1 } }])
  })

  it('줄 길이 밖의 물 칸으로 저으면 막히고 상태는 그대로다', () => {
    const at = play(TETHER_STAGE, ['right', 'right']).state

    for (const direction of ['right', 'down'] as Direction[]) {
      const { state, events } = move(at, direction)
      expect(state).toBe(at)
      expect(events).toEqual([{ type: 'blocked', direction }])
    }
  })

  it('거리는 가로와 세로 칸 수의 합이라 같은 거리의 다른 칸으로는 저어 간다', () => {
    const { state } = play(TETHER_STAGE, ['right', 'down'])

    expect(state.player).toEqual({ x: 2, y: 2 })
    expect(state.tethered).toEqual([{ x: 2, y: 2 }])
  })

  it('묶인 배에서 땅으로 내리면 배는 저어 간 자리에 남는다', () => {
    const { state } = play(TETHER_STAGE, ['right', 'right', 'up'])

    expect(state.player).toEqual({ x: 3, y: 0 })
    expect(state.boxes).toEqual([{ x: 3, y: 1 }])
    expect(state.tethered).toEqual([{ x: 3, y: 1 }])
  })

  it('묶인 배에서 줄 길이 밖의 자유 배로 옮겨 타고 그 배는 멀리 저어 간다', () => {
    const stage: Stage = {
      ...TETHER_STAGE,
      entities: [...TETHER_STAGE.entities, { type: 'box', x: 4, y: 1 }],
    }
    const { state } = play(stage, ['right', 'right', 'right', 'right'])

    expect(state.player).toEqual({ x: 5, y: 1 })
    expect(state.boxes).toEqual([
      { x: 3, y: 1 },
      { x: 5, y: 1 },
    ])
    expect(state.tethered).toEqual([{ x: 3, y: 1 }])
  })

  it('땅 상자를 물에 밀어 띄운 배는 거리 제한 없이 저어 간다', () => {
    const stage: Stage = {
      ...TETHER_STAGE,
      start: { x: 0, y: 2 },
      entities: [...TETHER_STAGE.entities, { type: 'box', x: 1, y: 2 }],
    }
    const { state } = play(stage, ['right', 'right', 'right', 'right', 'right'])

    expect(state.player).toEqual({ x: 5, y: 2 })
    expect(state.tethered).toEqual([{ x: 2, y: 1 }])
  })

  it('땅 상자를 묶인 배 쪽으로 밀면 상자 위에 올라서고 배는 그대로다', () => {
    const stage: Stage = {
      ...TETHER_STAGE,
      start: { x: 0, y: 1 },
      entities: [...TETHER_STAGE.entities, { type: 'box', x: 1, y: 1 }],
    }
    const { state } = play(stage, ['right'])

    expect(state.player).toEqual({ x: 1, y: 1 })
    expect(state.tethered).toEqual([{ x: 2, y: 1 }])
    expect(state.boxes).toContainEqual({ x: 2, y: 1 })
  })

  it('높은 땅에서 묶인 배로 떨어져 타도 배는 그대로다', () => {
    const stage: Stage = {
      ...TETHER_STAGE,
      heights: TETHER_STAGE.heights.map((row, y) =>
        y === 1 ? row.map((h, x) => (x === 1 ? 2 : h)) : row,
      ),
    }
    const { state, events } = play(stage, ['right'])

    expect(state.player).toEqual({ x: 2, y: 1 })
    expect(state.tethered).toEqual([{ x: 2, y: 1 }])
    expect(events).toEqual([{ type: 'fell', from: { x: 1, y: 1 }, to: { x: 2, y: 1 }, drop: 1 }])
  })

  it('묶인 배를 탄 큐브에게 바람이 불어도 배는 그대로다', () => {
    const stage: Stage = { ...TETHER_STAGE, rules: { wind: 'right' } }
    const { state, events } = play(stage, ['right', 'down', 'up', 'down'])

    expect(state.moves).toBe(4)
    expect(state.player).toEqual({ x: 2, y: 2 })
    expect(state.tethered).toEqual([{ x: 2, y: 2 }])
    expect(state.boxes).toEqual([{ x: 2, y: 2 }])
    expect(events.at(-1)).toEqual({ type: 'braced', direction: 'right' })
  })
})

describe('move 말뚝 칸', () => {
  it('큐브는 말뚝 칸으로 들어가지 못한다', () => {
    const { state, events } = play(POST_ROW, ['right', 'right', 'right'])

    expect(state.player).toEqual({ x: 2, y: 0 })
    expect(events).toEqual([{ type: 'blocked', direction: 'right' }])
  })

  it('상자를 말뚝 쪽으로 밀면 밀리지 않고 큐브가 상자 위에 올라선다', () => {
    const stage: Stage = {
      ...POST_ROW,
      start: { x: 1, y: 0 },
      entities: [...POST_ROW.entities, { type: 'box', x: 2, y: 0 }],
    }
    const { state, events } = play(stage, ['right'])

    expect(state.player).toEqual({ x: 2, y: 0 })
    expect(state.boxes).toEqual([{ x: 2, y: 0 }])
    expect(events).toEqual([
      { type: 'climbed', from: { x: 1, y: 0 }, to: { x: 2, y: 0 }, via: 'box' },
    ])
  })

  it('버섯에 튕긴 큐브는 말뚝 칸에 내리지 못해 버섯에 올라선다', () => {
    const stage: Stage = { ...POST_ROW, mushroom: ['.#...'] }
    const { state } = play(stage, ['right'])

    expect(state.player).toEqual({ x: 1, y: 0 })
  })

  it('버섯으로 튕길 상자도 말뚝 칸에 내리지 못해 밀리지 않는다', () => {
    const stage: Stage = {
      ...POST_ROW,
      heights: [[0, 0, 0, 0, 0, 0]],
      start: { x: 0, y: 0 },
      goal: { x: 5, y: 0 },
      mushroom: ['..#...'],
      entities: [
        { type: 'post', x: 4, y: 0, length: 1, boat: { x: 4, y: 1 } },
        { type: 'box', x: 1, y: 0 },
      ],
    }
    const { state } = play(stage, ['right'])

    expect(state.boxes).toEqual([{ x: 1, y: 0 }])
    expect(state.player).toEqual({ x: 1, y: 0 })
  })

  it('바람이 큐브를 말뚝 쪽으로 밀면 버틴다', () => {
    const stage: Stage = { ...POST_ROW, start: { x: 2, y: 0 }, rules: { wind: 'right' } }
    const { state, events } = play(stage, ['left', 'right', 'left', 'right'])

    expect(state.player).toEqual({ x: 2, y: 0 })
    expect(events.at(-1)).toEqual({ type: 'braced', direction: 'right' })
  })
})
