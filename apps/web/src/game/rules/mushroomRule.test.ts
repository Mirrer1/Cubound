import { describe, expect, it } from 'vitest'

import type { Stage } from '../types'
import { capsLeft, dirLeft, movesLeft } from './limitRule'
import { move } from './moveRule'
import { isMushroom } from './mushroomRule'
import { createState, standHeight } from './stateRule'
import { FLAT_STAGE, play } from './testStages'

const MUSHROOM_STAGE: Stage = {
  version: 1,
  id: 'test-mushroom',
  name: '버섯 테스트',
  heights: [
    [0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0],
  ],
  start: { x: 0, y: 1 },
  goal: { x: 5, y: 0 },
  entities: [],
  mushroom: ['......', '.#....', '......'],
}

// 오른쪽으로 뛰지 못해 (1,1) 버섯 위에 올라서는 판
const STUCK_STAGE: Stage = {
  ...MUSHROOM_STAGE,
  heights: [
    [0, 0, 0, 0, 0, 0],
    [0, 0, 0, 2, 0, 0],
    [0, 0, 0, 0, 0, 0],
  ],
}

describe('move 버섯', () => {
  it('버섯 칸 목록을 읽어 시작한다', () => {
    expect(createState(MUSHROOM_STAGE).mushrooms).toEqual([{ x: 1, y: 1 }])
  })

  it('평지에서 버섯을 밟으면 두 칸 앞에 선다', () => {
    const { state } = move(createState(MUSHROOM_STAGE), 'right')

    expect(state.player).toEqual({ x: 3, y: 1 })
    expect(state.moves).toBe(1)
  })

  it('사이 칸이 두 층 벽이어도 넘는다', () => {
    const stage: Stage = {
      ...MUSHROOM_STAGE,
      heights: [
        [0, 0, 0, 0, 0, 0],
        [0, 0, 2, 0, 0, 0],
        [0, 0, 0, 0, 0, 0],
      ],
    }
    const { state } = move(createState(stage), 'right')

    expect(state.player).toEqual({ x: 3, y: 1 })
    expect(state.moves).toBe(1)
  })

  it('사이 칸이 바닥 없는 구덩이여도 넘는다', () => {
    const stage: Stage = {
      ...MUSHROOM_STAGE,
      heights: [
        [0, 0, 0, 0, 0, 0],
        [0, 0, -1, 0, 0, 0],
        [0, 0, 0, 0, 0, 0],
      ],
    }
    const { state } = move(createState(stage), 'right')

    expect(state.player).toEqual({ x: 3, y: 1 })
  })

  it('착지 칸이 한 층 높으면 뛰어오르고 올라가기로 세지 않는다', () => {
    const stage: Stage = {
      ...MUSHROOM_STAGE,
      heights: [
        [0, 0, 0, 0, 0, 0],
        [0, 0, 0, 1, 0, 0],
        [0, 0, 0, 0, 0, 0],
      ],
    }
    const { state } = move(createState(stage), 'right')

    expect(state.player).toEqual({ x: 3, y: 1 })
    expect(state.moves).toBe(1)
    expect(state.climbs).toBe(0)
  })

  it('착지 칸이 두 층 높으면 안 뛰고 버섯 칸에 올라선다', () => {
    const { state } = move(createState(STUCK_STAGE), 'right')

    expect(state.player).toEqual({ x: 1, y: 1 })
    expect(state.moves).toBe(1)
  })

  it('착지 칸이 맵 밖이면 버섯 칸에 올라선다', () => {
    const stage: Stage = { ...MUSHROOM_STAGE, mushroom: ['......', '....#.', '......'] }
    const { state } = play(stage, ['right', 'right', 'right', 'right'])

    expect(state.player).toEqual({ x: 4, y: 1 })
    expect(state.moves).toBe(4)
  })

  it('착지 칸이 바닥 없는 구덩이면 버섯 칸에 올라선다', () => {
    const stage: Stage = {
      ...MUSHROOM_STAGE,
      heights: [
        [0, 0, 0, 0, 0, 0],
        [0, 0, 0, -1, 0, 0],
        [0, 0, 0, 0, 0, 0],
      ],
    }
    const { state } = move(createState(stage), 'right')

    expect(state.player).toEqual({ x: 1, y: 1 })
  })

  it('착지 칸이 닫힌 문이면 버섯 칸에 올라선다', () => {
    const stage: Stage = {
      ...MUSHROOM_STAGE,
      entities: [{ type: 'door', x: 3, y: 1, id: 'a' }],
    }
    const { state } = move(createState(stage), 'right')

    expect(state.player).toEqual({ x: 1, y: 1 })
  })

  it('착지 칸에 상자가 있고 한 층이면 상자 위에 선다', () => {
    const stage: Stage = { ...MUSHROOM_STAGE, entities: [{ type: 'box', x: 3, y: 1 }] }
    const { state } = move(createState(stage), 'right')

    expect(state.player).toEqual({ x: 3, y: 1 })
    expect(state.boxes).toEqual([{ x: 3, y: 1 }])
    expect(standHeight(state, state.player)).toBe(1)
    expect(state.pushes).toBe(0)
  })

  it('버섯 위에 선 뒤 다른 방향을 누르면 그쪽으로 두 칸 뛴다', () => {
    const stage: Stage = {
      ...STUCK_STAGE,
      heights: [
        [0, 0, 0, 0, 0, 0],
        [0, 0, 0, 2, 0, 0],
        [0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0],
      ],
      mushroom: ['......', '.#....', '......', '......'],
    }
    const { state } = play(stage, ['right', 'down'])

    expect(state.player).toEqual({ x: 1, y: 3 })
    expect(state.moves).toBe(2)
  })

  it('버섯 위에서 못 뛰는 방향을 누르면 제자리이고 이동 수가 안 는다', () => {
    const stood = move(createState(STUCK_STAGE), 'right')
    const { state, events } = move(stood.state, 'right')

    expect(state).toBe(stood.state)
    expect(state.player).toEqual({ x: 1, y: 1 })
    expect(state.moves).toBe(1)
    expect(events).toEqual([{ type: 'blocked', direction: 'right' }])
  })

  it('버섯 둘이 이어진 자리에서 네 칸을 가고 이동 수는 1이다', () => {
    const stage: Stage = { ...MUSHROOM_STAGE, mushroom: ['......', '.#.#..', '......'] }
    const { state } = move(createState(stage), 'right')

    expect(state.player).toEqual({ x: 5, y: 1 })
    expect(state.moves).toBe(1)
  })

  it('연쇄 중간에 못 뛰게 되면 그 버섯 칸에 선다', () => {
    const stage: Stage = {
      ...MUSHROOM_STAGE,
      heights: [
        [0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 2],
        [0, 0, 0, 0, 0, 0],
      ],
      mushroom: ['......', '.#.#..', '......'],
    }
    const { state } = move(createState(stage), 'right')

    expect(state.player).toEqual({ x: 3, y: 1 })
    expect(state.moves).toBe(1)
  })

  it('상자를 버섯 쪽으로 밀면 상자가 두 칸 날아가고 밀기 1회다', () => {
    const stage: Stage = {
      ...MUSHROOM_STAGE,
      mushroom: ['......', '..#...', '......'],
      entities: [{ type: 'box', x: 1, y: 1 }],
    }
    const { state } = move(createState(stage), 'right')

    expect(state.boxes).toEqual([{ x: 4, y: 1 }])
    expect(state.player).toEqual({ x: 1, y: 1 })
    expect(state.moves).toBe(1)
    expect(state.pushes).toBe(1)
  })

  it('상자가 착지할 수 없으면 안 밀리고 큐브가 상자 위로 올라선다', () => {
    const stage: Stage = {
      ...MUSHROOM_STAGE,
      heights: [
        [0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 2, 0],
        [0, 0, 0, 0, 0, 0],
      ],
      mushroom: ['......', '..#...', '......'],
      entities: [{ type: 'box', x: 1, y: 1 }],
    }
    const { state } = move(createState(stage), 'right')

    expect(state.boxes).toEqual([{ x: 1, y: 1 }])
    expect(state.player).toEqual({ x: 1, y: 1 })
    expect(standHeight(state, state.player)).toBe(1)
    expect(state.pushes).toBe(0)
    expect(state.climbs).toBe(1)
  })

  it('버섯 이동이 이동 제한을 1 쓴다', () => {
    const stage: Stage = { ...MUSHROOM_STAGE, rules: { moveLimit: 3 } }
    const { state } = move(createState(stage), 'right')

    expect(state.player).toEqual({ x: 3, y: 1 })
    expect(movesLeft(state)).toBe(2)
  })

  it('버섯 이동이 방향 제한에서 누른 방향 하나만 쓴다', () => {
    const stage: Stage = {
      ...MUSHROOM_STAGE,
      mushroom: ['......', '.#.#..', '......'],
      rules: { dirLimit: { dir: 'right', count: 2 } },
    }
    const { state } = move(createState(stage), 'right')

    expect(state.player).toEqual({ x: 5, y: 1 })
    expect(state.dirUses).toBe(1)
    expect(dirLeft(state)).toBe(1)
  })

  it('평소에는 밟은 버섯이 사라지지 않는다', () => {
    const { state } = move(createState(MUSHROOM_STAGE), 'right')

    expect(state.mushrooms).toEqual([{ x: 1, y: 1 }])
    expect(capsLeft(state)).toBeNull()
  })
})

const WITHER_STAGE: Stage = {
  version: 1,
  id: 'test-mushroom-wither',
  name: '마른 자리 테스트',
  heights: [
    [0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0],
  ],
  start: { x: 0, y: 1 },
  goal: { x: 0, y: 0 },
  entities: [],
  mushroom: ['......', '..#...', '......'],
  rules: { mushroomWither: true },
}

describe('move 마른 자리', () => {
  it('밟고 튕긴 버섯이 목록에서 빠진다', () => {
    const { state } = play(WITHER_STAGE, ['right', 'right'])

    expect(state.player).toEqual({ x: 4, y: 1 })
    expect(state.mushrooms).toEqual([])
  })

  it('못 뛰어서 올라서기만 하면 빠지지 않는다', () => {
    const stage: Stage = {
      ...WITHER_STAGE,
      heights: [
        [0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 2, 0],
        [0, 0, 0, 0, 0, 0],
      ],
    }
    const { state } = play(stage, ['right', 'right'])

    expect(state.player).toEqual({ x: 2, y: 1 })
    expect(state.mushrooms).toEqual([{ x: 2, y: 1 }])
  })

  it('연쇄로 지나간 버섯이 전부 빠진다', () => {
    const stage: Stage = { ...WITHER_STAGE, mushroom: ['......', '.#.#..', '......'] }
    const { state } = move(createState(stage), 'right')

    expect(state.player).toEqual({ x: 5, y: 1 })
    expect(state.mushrooms).toEqual([])
  })

  it('상자가 밟은 버섯도 빠진다', () => {
    const stage: Stage = { ...WITHER_STAGE, entities: [{ type: 'box', x: 1, y: 1 }] }
    const { state } = move(createState(stage), 'right')

    expect(state.boxes).toEqual([{ x: 4, y: 1 }])
    expect(state.mushrooms).toEqual([])
  })

  it('버섯이 남아 있으면 구멍에 서도 클리어가 아니다', () => {
    const { state, events } = move(createState(WITHER_STAGE), 'up')

    expect(state.player).toEqual({ x: 0, y: 0 })
    expect(state.cleared).toBe(false)
    expect(events).not.toContainEqual({ type: 'cleared' })
  })

  it('버섯이 0개가 되면 구멍에서 클리어된다', () => {
    const { state } = play(WITHER_STAGE, ['right', 'right', 'left', 'left', 'left', 'left', 'up'])

    expect(state.player).toEqual({ x: 0, y: 0 })
    expect(state.mushrooms).toEqual([])
    expect(state.cleared).toBe(true)
  })

  it('남은 버섯 개수를 알려주고 시드는 판이 아니면 null이다', () => {
    const start = createState(WITHER_STAGE)

    expect(capsLeft(start)).toBe(1)
    expect(capsLeft(play(WITHER_STAGE, ['right', 'right']).state)).toBe(0)
    expect(capsLeft(createState({ ...WITHER_STAGE, rules: undefined }))).toBeNull()
  })
})

describe('isMushroom', () => {
  it('남아 있는 버섯 칸만 버섯이다', () => {
    const state = createState({ ...FLAT_STAGE, mushroom: ['...', '#..', '...'] })

    expect(isMushroom(state, { x: 0, y: 1 })).toBe(true)
    expect(isMushroom(state, { x: 1, y: 1 })).toBe(false)
    expect(isMushroom({ ...state, mushrooms: [] }, { x: 0, y: 1 })).toBe(false)
  })
})
