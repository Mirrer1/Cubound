import { describe, expect, it } from 'vitest'

import {
  climbsLeft,
  createState,
  dirLeft,
  isDoorOpen,
  isLiftRaised,
  move,
  movesLeft,
  nextSwampCost,
  pushesLeft,
  ridesLeft,
  standHeight,
} from './rules'
import type { Direction, Entity, GameState, MoveResult, Point, Stage } from './types'

const FLAT_STAGE: Stage = {
  version: 1,
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
  version: 1,
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
    expect(events).toEqual([
      { type: 'climbed', from: { x: 0, y: 1 }, to: { x: 1, y: 1 }, via: 'box' },
    ])
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

const SWITCH_STAGE: Stage = {
  version: 1,
  id: 'test-switch',
  name: '스위치 테스트',
  heights: [
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
  ],
  start: { x: 0, y: 0 },
  goal: { x: 4, y: 1 },
  entities: [
    { type: 'switch', x: 1, y: 0, target: 'a' },
    { type: 'door', x: 3, y: 1, id: 'a' },
  ],
}

describe('move 스위치와 문', () => {
  it('닫힌 문으로는 이동하지 않는다', () => {
    const stage: Stage = { ...SWITCH_STAGE, start: { x: 2, y: 1 } }
    const { events } = move(createState(stage), 'right')

    expect(events).toEqual([{ type: 'blocked', direction: 'right' }])
  })

  it('스위치를 밟으면 문이 열리고 내려오면 닫힌다', () => {
    const on = move(createState(SWITCH_STAGE), 'right')
    const off = move(on.state, 'down')

    expect(isDoorOpen(on.state, 'a')).toBe(true)
    expect(on.events).toContainEqual({ type: 'door', id: 'a', open: true })
    expect(isDoorOpen(off.state, 'a')).toBe(false)
    expect(off.events).toContainEqual({ type: 'door', id: 'a', open: false })
  })

  it('상자로 스위치를 눌러 두면 열린 문을 지나 클리어한다', () => {
    const stage: Stage = {
      ...SWITCH_STAGE,
      start: { x: 1, y: 2 },
      entities: [...SWITCH_STAGE.entities, { type: 'box', x: 1, y: 1 }],
    }
    const pushed = move(createState(stage), 'up')
    const end = (['right', 'right', 'right'] as const).reduce(
      (s, d) => move(s, d).state,
      pushed.state,
    )

    expect(pushed.events).toContainEqual({ type: 'door', id: 'a', open: true })
    expect(end.cleared).toBe(true)
  })

  it('닫힌 문 쪽으로는 상자를 밀지 못해 상자 위로 올라간다', () => {
    const stage: Stage = {
      ...SWITCH_STAGE,
      start: { x: 1, y: 1 },
      entities: [...SWITCH_STAGE.entities, { type: 'box', x: 2, y: 1 }],
    }
    const { events } = move(createState(stage), 'right')

    expect(events[0].type).toBe('climbed')
  })

  it('스위치에서 벗어나도 문 위에 무언가 있으면 열려 있고 비면 닫힌다', () => {
    const stage: Stage = {
      ...SWITCH_STAGE,
      start: { x: 0, y: 1 },
      goal: { x: 4, y: 0 },
      entities: [
        { type: 'switch', x: 0, y: 1, target: 'a' },
        { type: 'door', x: 2, y: 1, id: 'a' },
        { type: 'box', x: 1, y: 1 },
      ],
    }
    const boxOnDoor = move(createState(stage), 'right')
    const playerOnDoor = move(boxOnDoor.state, 'right')
    const offDoor = move(playerOnDoor.state, 'right')

    expect(boxOnDoor.state.boxes).toEqual([{ x: 2, y: 1 }])
    expect(isDoorOpen(boxOnDoor.state, 'a')).toBe(true)
    expect(boxOnDoor.events.some((e) => e.type === 'door')).toBe(false)
    expect(playerOnDoor.state.player).toEqual({ x: 2, y: 1 })
    expect(isDoorOpen(playerOnDoor.state, 'a')).toBe(true)
    expect(offDoor.state.player).toEqual({ x: 3, y: 1 })
    expect(isDoorOpen(offDoor.state, 'a')).toBe(false)
    expect(offDoor.events).toContainEqual({ type: 'door', id: 'a', open: false })
  })

  it('연결된 스위치 중 하나만 눌려도 문이 열린다', () => {
    const stage: Stage = {
      ...SWITCH_STAGE,
      entities: [...SWITCH_STAGE.entities, { type: 'switch', x: 0, y: 2, target: 'a' }],
    }
    const { state } = move(createState(stage), 'right')

    expect(isDoorOpen(state, 'a')).toBe(true)
  })
})

const LADDER_STAGE: Stage = {
  version: 1,
  id: 'test-ladder',
  name: '사다리 테스트',
  heights: [
    [0, 0, 0, 1, 1],
    [0, 0, 0, 1, 1],
    [0, 0, 0, 1, 1],
  ],
  start: { x: 0, y: 1 },
  goal: { x: 4, y: 0 },
  entities: [{ type: 'ladder', x: 1, y: 1 }],
}

const play = (stage: Stage, directions: Direction[]) =>
  directions.reduce<MoveResult>((result, d) => move(result.state, d), {
    state: createState(stage),
    events: [],
  })

describe('move 사다리', () => {
  it('바닥의 사다리 칸으로 이동하면 사다리를 줍는다', () => {
    const { state, events } = move(createState(LADDER_STAGE), 'right')

    expect(state.carrying).toBe(true)
    expect(state.ladders).toEqual([])
    expect(state.moves).toBe(1)
    expect(events).toEqual([
      { type: 'moved', from: { x: 0, y: 1 }, to: { x: 1, y: 1 } },
      { type: 'pickedUp', at: { x: 1, y: 1 } },
    ])
  })

  it('사다리를 들고 있으면 다른 사다리는 줍지 않고 지나간다', () => {
    const stage: Stage = {
      ...LADDER_STAGE,
      entities: [...LADDER_STAGE.entities, { type: 'ladder', x: 2, y: 1 }],
    }
    const { state, events } = play(stage, ['right', 'right'])

    expect(state.ladders).toEqual([{ x: 2, y: 1 }])
    expect(events).toEqual([{ type: 'moved', from: { x: 1, y: 1 }, to: { x: 2, y: 1 } }])
  })

  it('들고 있을 때 한 층 높은 칸 쪽으로 가면 제자리에서 사다리를 기대 놓는다', () => {
    const { state, events } = play(LADDER_STAGE, ['right', 'right', 'right'])

    expect(state.player).toEqual({ x: 2, y: 1 })
    expect(state.carrying).toBe(false)
    expect(state.moves).toBe(3)
    expect(state.leaningLadders).toEqual([{ x: 2, y: 1, direction: 'right' }])
    expect(events).toEqual([{ type: 'placed', ladder: { x: 2, y: 1, direction: 'right' } }])
  })

  it('기대 놓은 사다리 쪽으로 한 번 더 가면 올라간다', () => {
    const { state, events } = play(LADDER_STAGE, ['right', 'right', 'right', 'right'])

    expect(state.player).toEqual({ x: 3, y: 1 })
    expect(state.leaningLadders).toEqual([{ x: 2, y: 1, direction: 'right' }])
    expect(events).toEqual([
      { type: 'climbed', from: { x: 2, y: 1 }, to: { x: 3, y: 1 }, via: 'ladder' },
    ])
  })

  it('사다리를 타고 내려오면 사다리를 다시 든다', () => {
    const { state, events } = play(LADDER_STAGE, ['right', 'right', 'right', 'right', 'left'])

    expect(state.player).toEqual({ x: 2, y: 1 })
    expect(state.carrying).toBe(true)
    expect(state.leaningLadders).toEqual([])
    expect(events).toEqual([
      { type: 'fell', from: { x: 3, y: 1 }, to: { x: 2, y: 1 }, drop: 1 },
      { type: 'pickedUp', at: { x: 2, y: 1 } },
    ])
  })

  it('사다리가 없는 곳으로 내려오면 사다리는 제자리에 남는다', () => {
    const { state } = play(LADDER_STAGE, ['right', 'right', 'right', 'right', 'up', 'left'])

    expect(state.player).toEqual({ x: 2, y: 0 })
    expect(state.carrying).toBe(false)
    expect(state.leaningLadders).toEqual([{ x: 2, y: 1, direction: 'right' }])
  })

  it('두 층 이상 높은 칸에는 사다리를 놓지 않는다', () => {
    const stage: Stage = {
      ...LADDER_STAGE,
      heights: [
        [0, 0, 0, 2, 2],
        [0, 0, 0, 2, 2],
        [0, 0, 0, 2, 2],
      ],
    }
    const { state, events } = play(stage, ['right', 'right', 'right'])

    expect(state.carrying).toBe(true)
    expect(events).toEqual([{ type: 'blocked', direction: 'right' }])
  })

  it('사다리가 없으면 한 층 높은 칸으로 올라가지 못한다', () => {
    const stage: Stage = { ...LADDER_STAGE, entities: [] }
    const { events } = play(stage, ['right', 'right', 'right'])

    expect(events).toEqual([{ type: 'blocked', direction: 'right' }])
  })

  it('상자를 바닥의 사다리 칸으로 밀지 못해 상자 위로 올라간다', () => {
    const stage: Stage = {
      ...LADDER_STAGE,
      entities: [
        { type: 'box', x: 1, y: 1 },
        { type: 'ladder', x: 2, y: 1 },
      ],
    }
    const { events } = move(createState(stage), 'right')

    expect(events[0].type).toBe('climbed')
  })
})

const ICE_STAGE: Stage = {
  version: 1,
  id: 'test-ice',
  name: '얼음 테스트',
  heights: [
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
  ],
  start: { x: 0, y: 1 },
  goal: { x: 4, y: 0 },
  entities: [],
  ice: ['.....', '.###.', '.....'],
}

const withHeights = (row: number[]) => [ICE_STAGE.heights[0], row, ICE_STAGE.heights[2]]

describe('move 얼음', () => {
  it('얼음에 올라서면 보통 칸에 닿을 때까지 미끄러지고 이동 수는 1이다', () => {
    const { state, events } = move(createState(ICE_STAGE), 'right')

    expect(state.player).toEqual({ x: 4, y: 1 })
    expect(state.moves).toBe(1)
    expect(events).toEqual([
      { type: 'moved', from: { x: 0, y: 1 }, to: { x: 1, y: 1 } },
      { type: 'slid', subject: 'player', from: { x: 1, y: 1 }, to: { x: 4, y: 1 } },
    ])
  })

  it('높은 칸에 막히면 얼음 마지막 칸에서 멈춘다', () => {
    const stage: Stage = { ...ICE_STAGE, heights: withHeights([0, 0, 0, 0, 1]) }
    const { state, events } = move(createState(stage), 'right')

    expect(state.player).toEqual({ x: 3, y: 1 })
    expect(events).toEqual([
      { type: 'moved', from: { x: 0, y: 1 }, to: { x: 1, y: 1 } },
      { type: 'slid', subject: 'player', from: { x: 1, y: 1 }, to: { x: 3, y: 1 } },
    ])
  })

  it('필드 밖으로는 나가지 않고 가장자리 얼음에서 멈춘다', () => {
    const stage: Stage = { ...ICE_STAGE, ice: ['.....', '.####', '.....'] }
    const { state } = move(createState(stage), 'right')

    expect(state.player).toEqual({ x: 4, y: 1 })
  })

  it('닫힌 문 앞에서 멈춘다', () => {
    const stage: Stage = { ...ICE_STAGE, entities: [{ type: 'door', x: 3, y: 1, id: 'a' }] }
    const { state } = move(createState(stage), 'right')

    expect(state.player).toEqual({ x: 2, y: 1 })
  })

  it('미끄러지다 낮은 칸을 만나면 그 칸이 얼음이어도 떨어지고 멈춘다', () => {
    const stage: Stage = {
      ...ICE_STAGE,
      heights: [
        [1, 1, 1, 1, 1],
        [1, 1, 1, 0, 0],
        [1, 1, 1, 1, 1],
      ],
      ice: ['.....', '.####', '.....'],
    }
    const { state, events } = move(createState(stage), 'right')

    expect(state.player).toEqual({ x: 3, y: 1 })
    expect(state.moves).toBe(1)
    expect(events).toEqual([
      { type: 'moved', from: { x: 0, y: 1 }, to: { x: 1, y: 1 } },
      { type: 'slid', subject: 'player', from: { x: 1, y: 1 }, to: { x: 2, y: 1 } },
      { type: 'fell', from: { x: 2, y: 1 }, to: { x: 3, y: 1 }, drop: 1 },
    ])
  })

  it('떨어져 내려온 칸이 얼음이어도 미끄러지지 않는다', () => {
    const stage: Stage = { ...ICE_STAGE, heights: withHeights([1, 0, 0, 0, 0]) }
    const { state, events } = move(createState(stage), 'right')

    expect(state.player).toEqual({ x: 1, y: 1 })
    expect(events).toEqual([{ type: 'fell', from: { x: 0, y: 1 }, to: { x: 1, y: 1 }, drop: 1 }])
  })

  it('미끄러져 목표 칸에 들어가면 클리어한다', () => {
    const stage: Stage = { ...ICE_STAGE, goal: { x: 4, y: 1 } }
    const { state, events } = move(createState(stage), 'right')

    expect(state.cleared).toBe(true)
    expect(events).toContainEqual({ type: 'cleared' })
  })

  it('지나친 칸의 사다리는 줍지 않고 멈춘 칸의 사다리만 줍는다', () => {
    const stage: Stage = {
      ...ICE_STAGE,
      entities: [
        { type: 'ladder', x: 2, y: 1 },
        { type: 'ladder', x: 4, y: 1 },
      ],
    }
    const { state, events } = move(createState(stage), 'right')

    expect(state.carrying).toBe(true)
    expect(state.ladders).toEqual([{ x: 2, y: 1 }])
    expect(events).toContainEqual({ type: 'pickedUp', at: { x: 4, y: 1 } })
  })

  it('지나친 칸의 스위치는 눌리지 않고 멈춘 칸의 스위치만 눌린다', () => {
    const door = { type: 'door', x: 0, y: 0, id: 'a' } as const
    const passed = move(
      createState({ ...ICE_STAGE, entities: [{ type: 'switch', x: 2, y: 1, target: 'a' }, door] }),
      'right',
    )
    const pressed = move(
      createState({ ...ICE_STAGE, entities: [{ type: 'switch', x: 4, y: 1, target: 'a' }, door] }),
      'right',
    )

    expect(isDoorOpen(passed.state, 'a')).toBe(false)
    expect(isDoorOpen(pressed.state, 'a')).toBe(true)
  })

  it('다음 칸이 상자면 얼음 첫 칸에서 멈춘다', () => {
    const stage: Stage = { ...ICE_STAGE, entities: [{ type: 'box', x: 2, y: 1 }] }
    const { state, events } = move(createState(stage), 'right')

    expect(state.player).toEqual({ x: 1, y: 1 })
    expect(events).toEqual([{ type: 'moved', from: { x: 0, y: 1 }, to: { x: 1, y: 1 } }])
  })

  it('얼음 칸의 상자 위에 올라서면 미끄러지지 않는다', () => {
    const stage: Stage = {
      ...ICE_STAGE,
      entities: [
        { type: 'box', x: 1, y: 1 },
        { type: 'box', x: 2, y: 1 },
      ],
    }
    const { state, events } = move(createState(stage), 'right')

    expect(state.player).toEqual({ x: 1, y: 1 })
    expect(events).toEqual([
      { type: 'climbed', from: { x: 0, y: 1 }, to: { x: 1, y: 1 }, via: 'box' },
    ])
  })

  it('사다리로 올라간 칸이 얼음이면 미끄러진다', () => {
    const stage: Stage = {
      ...ICE_STAGE,
      heights: [
        [0, 0, 0, 1, 1],
        [0, 0, 0, 1, 1],
        [0, 0, 0, 1, 1],
      ],
      ice: ['.....', '...##', '.....'],
      entities: [{ type: 'ladder', x: 1, y: 1 }],
    }
    const { state, events } = play(stage, ['right', 'right', 'right', 'right'])

    expect(state.player).toEqual({ x: 4, y: 1 })
    expect(events).toEqual([
      { type: 'climbed', from: { x: 2, y: 1 }, to: { x: 3, y: 1 }, via: 'ladder' },
      { type: 'slid', subject: 'player', from: { x: 3, y: 1 }, to: { x: 4, y: 1 } },
    ])
  })

  it('얼음으로 밀린 상자는 이어서 미끄러진다', () => {
    const stage: Stage = {
      ...ICE_STAGE,
      ice: ['.....', '..##.', '.....'],
      entities: [{ type: 'box', x: 1, y: 1 }],
    }
    const { state, events } = move(createState(stage), 'right')

    expect(state.boxes).toEqual([{ x: 4, y: 1 }])
    expect(state.player).toEqual({ x: 1, y: 1 })
    expect(state.moves).toBe(1)
    expect(events).toEqual([
      { type: 'pushed', from: { x: 1, y: 1 }, to: { x: 2, y: 1 }, result: 'slid' },
      { type: 'slid', subject: 'box', from: { x: 2, y: 1 }, to: { x: 4, y: 1 } },
      { type: 'moved', from: { x: 0, y: 1 }, to: { x: 1, y: 1 } },
    ])
  })

  it('미끄러지던 상자가 바닥 없는 칸을 메우고 멈춘다', () => {
    const stage: Stage = {
      ...ICE_STAGE,
      heights: withHeights([0, 0, 0, 0, -1]),
      ice: ['.....', '..##.', '.....'],
      entities: [{ type: 'box', x: 1, y: 1 }],
    }
    const { state, events } = move(createState(stage), 'right')

    expect(state.boxes).toEqual([])
    expect(state.heights[1][4]).toBe(0)
    expect(events).toEqual([
      { type: 'pushed', from: { x: 1, y: 1 }, to: { x: 2, y: 1 }, result: 'slid' },
      { type: 'slid', subject: 'box', from: { x: 2, y: 1 }, to: { x: 3, y: 1 } },
      { type: 'pushed', from: { x: 3, y: 1 }, to: { x: 4, y: 1 }, result: 'filled' },
      { type: 'moved', from: { x: 0, y: 1 }, to: { x: 1, y: 1 } },
    ])
  })

  it('상자를 민 뒤 선 칸이 얼음이면 큐브도 이어서 미끄러진다', () => {
    const stage: Stage = {
      ...ICE_STAGE,
      ice: ['.....', '.####', '.....'],
      entities: [{ type: 'box', x: 1, y: 1 }],
    }
    const { state, events } = move(createState(stage), 'right')

    expect(state.boxes).toEqual([{ x: 4, y: 1 }])
    expect(state.player).toEqual({ x: 3, y: 1 })
    expect(state.moves).toBe(1)
    expect(events).toEqual([
      { type: 'pushed', from: { x: 1, y: 1 }, to: { x: 2, y: 1 }, result: 'slid' },
      { type: 'slid', subject: 'box', from: { x: 2, y: 1 }, to: { x: 4, y: 1 } },
      { type: 'moved', from: { x: 0, y: 1 }, to: { x: 1, y: 1 } },
      { type: 'slid', subject: 'player', from: { x: 1, y: 1 }, to: { x: 3, y: 1 } },
    ])
  })
})

const LIFT_STAGE: Stage = {
  version: 1,
  id: 'test-lift',
  name: '발판 테스트',
  heights: [
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
  ],
  start: { x: 0, y: 1 },
  goal: { x: 4, y: 0 },
  entities: [
    { type: 'switch', x: 2, y: 1, target: 'a' },
    { type: 'lift', x: 4, y: 1, id: 'a' },
  ],
}

const LIFT = { x: 4, y: 1 }

// 스위치 칸이 한 층 높아 큐브가 올라간 발판으로 옮겨 설 수 있다
const RIDE_STAGE: Stage = {
  ...LIFT_STAGE,
  heights: [
    [0, 0, 0, 1, 0],
    [0, 0, 0, 1, 0],
    [0, 0, 0, 0, 0],
  ],
  start: { x: 3, y: 0 },
  entities: [
    { type: 'switch', x: 3, y: 1, target: 'a' },
    { type: 'lift', x: 4, y: 1, id: 'a' },
  ],
}

describe('move 발판', () => {
  const HELD_STAGE: Stage = {
    ...LIFT_STAGE,
    entities: [...LIFT_STAGE.entities, { type: 'box', x: 1, y: 1 }],
  }

  it('스위치를 밟으면 발판이 한 층 올라간다', () => {
    const { state, events } = play(LIFT_STAGE, ['right', 'right'])

    expect(isLiftRaised(state, 'a')).toBe(true)
    expect(standHeight(state, LIFT)).toBe(1)
    expect(events).toContainEqual({ type: 'lift', id: 'a', up: true })
  })

  it('스위치에서 내려오면 발판이 원래 높이로 돌아온다', () => {
    const { state, events } = play(LIFT_STAGE, ['right', 'right', 'down'])

    expect(isLiftRaised(state, 'a')).toBe(false)
    expect(standHeight(state, LIFT)).toBe(0)
    expect(events).toContainEqual({ type: 'lift', id: 'a', up: false })
  })

  it('상자로 스위치를 눌러 두면 발판이 계속 올라가 있다', () => {
    const { state, events } = play(HELD_STAGE, ['right', 'up'])

    expect(state.boxes).toEqual([{ x: 2, y: 1 }])
    expect(isLiftRaised(state, 'a')).toBe(true)
    expect(events.some((e) => e.type === 'lift')).toBe(false)
  })

  it('올라간 발판으로는 그냥 올라가지 못한다', () => {
    const { state, events } = play(HELD_STAGE, ['right', 'up', 'right', 'right', 'down', 'right'])

    expect(state.player).toEqual({ x: 3, y: 1 })
    expect(events).toEqual([{ type: 'blocked', direction: 'right' }])
  })

  it('내려간 발판은 보통 칸처럼 지나간다', () => {
    const { state, events } = move(createState({ ...LIFT_STAGE, start: { x: 3, y: 1 } }), 'right')

    expect(state.player).toEqual(LIFT)
    expect(events).toEqual([{ type: 'moved', from: { x: 3, y: 1 }, to: LIFT }])
  })

  it('큐브가 스위치에서 발판으로 옮겨 서면 발판과 함께 내려앉는다', () => {
    const { state, events } = play(RIDE_STAGE, ['down', 'right'])

    expect(state.player).toEqual(LIFT)
    expect(isLiftRaised(state, 'a')).toBe(false)
    expect(standHeight(state, LIFT)).toBe(0)
    expect(events).toContainEqual({ type: 'lift', id: 'a', up: false })
  })

  it('발판 위의 상자도 스위치가 풀리면 같이 내려온다', () => {
    const stage: Stage = {
      ...LIFT_STAGE,
      heights: [
        [0, 0, 0, 0, 0],
        [1, 1, 1, 1, 0],
        [0, 0, 0, 0, 0],
      ],
      entities: [...LIFT_STAGE.entities, { type: 'box', x: 3, y: 1 }],
    }
    const { state, events } = play(stage, ['right', 'right', 'right'])

    expect(state.boxes).toEqual([LIFT])
    expect(isLiftRaised(state, 'a')).toBe(false)
    expect(standHeight(state, LIFT)).toBe(1)
    expect(events).toContainEqual({ type: 'lift', id: 'a', up: false })
  })

  it('올라간 발판 쪽으로는 상자를 밀지 못해 상자 위로 올라간다', () => {
    const stage: Stage = {
      ...LIFT_STAGE,
      entities: [...LIFT_STAGE.entities, { type: 'box', x: 3, y: 1 }],
    }
    const { state, events } = play(stage, ['right', 'right', 'right'])

    expect(state.boxes).toEqual([{ x: 3, y: 1 }])
    expect(state.player).toEqual({ x: 3, y: 1 })
    expect(events[0].type).toBe('climbed')
  })

  it('미끄러지다 올라간 발판을 만나면 그 앞에서 멈춘다', () => {
    const stage: Stage = { ...LIFT_STAGE, ice: ['.....', '...#.', '.....'] }
    const { state } = play(stage, ['right', 'right', 'right'])

    expect(state.player).toEqual({ x: 3, y: 1 })
  })
})

describe('move 이동 제한', () => {
  const LIMITED_STAGE: Stage = { ...FLAT_STAGE, rules: { moveLimit: 2 } }

  it('제한이 없으면 이동 수에 상관없이 계속 움직인다', () => {
    const { state } = play(FLAT_STAGE, ['left', 'right', 'left', 'right'])

    expect(state.moves).toBe(4)
    expect(state.player).toEqual({ x: 1, y: 1 })
  })

  it('제한 안에서는 그대로 움직인다', () => {
    const { state } = play(LIMITED_STAGE, ['left', 'right'])

    expect(state.moves).toBe(2)
    expect(state.player).toEqual({ x: 1, y: 1 })
  })

  it('남은 이동을 다 쓰면 움직이지 않고 blocked 이벤트를 돌려준다', () => {
    const used = play(LIMITED_STAGE, ['left', 'right']).state
    const { state, events } = move(used, 'up')

    expect(state).toBe(used)
    expect(events).toEqual([
      { type: 'blocked', direction: 'up' },
      { type: 'limit', limit: 'moves' },
    ])
  })

  it('제한을 다 쓰면 목표 칸을 바로 앞에 두고도 클리어하지 못한다', () => {
    const stage: Stage = { ...FLAT_STAGE, start: { x: 1, y: 0 }, rules: { moveLimit: 1 } }
    const { state } = play(stage, ['left', 'right'])

    expect(state.moves).toBe(1)
    expect(state.cleared).toBe(false)
  })
})

describe('movesLeft', () => {
  it('제한이 없으면 null을 돌려준다', () => {
    expect(movesLeft(createState(FLAT_STAGE))).toBe(null)
  })

  it('제한이 있으면 남은 이동 수를 돌려준다', () => {
    const stage: Stage = { ...FLAT_STAGE, rules: { moveLimit: 2 } }

    expect(movesLeft(createState(stage))).toBe(2)
    expect(movesLeft(play(stage, ['left']).state)).toBe(1)
    expect(movesLeft(play(stage, ['left', 'right']).state)).toBe(0)
  })
})

describe('move 민 횟수', () => {
  it('상자를 밀면 민 횟수가 1 오른다', () => {
    const { state } = move(createState(BOX_STAGE), 'right')

    expect(state.pushes).toBe(1)
  })

  it('상자를 밀지 않은 이동은 민 횟수가 오르지 않는다', () => {
    const { state } = play(BOX_STAGE, ['up', 'right', 'right'])

    expect(state.pushes).toBe(0)
  })

  it('얼음에서 상자가 여러 칸 미끄러져도 민 횟수는 1 오른다', () => {
    const stage: Stage = { ...BOX_STAGE, ice: ['.....', '..##.', '.....'] }
    const { state } = move(createState(stage), 'right')

    expect(state.boxes).toEqual([{ x: 4, y: 1 }])
    expect(state.pushes).toBe(1)
  })

  it('상자가 미끄러지다 구멍을 메워도 민 횟수는 1 오른다', () => {
    const stage: Stage = {
      ...BOX_STAGE,
      heights: withMiddleRow([0, 0, 0, 0, -1]),
      ice: ['.....', '..##.', '.....'],
    }
    const { state, events } = move(createState(stage), 'right')

    expect(state.boxes).toEqual([])
    expect(events.filter((e) => e.type === 'pushed')).toHaveLength(2)
    expect(state.pushes).toBe(1)
  })
})

describe('move 밀기 제한', () => {
  const LIMITED_STAGE: Stage = { ...BOX_STAGE, rules: { pushLimit: 1 } }

  it('제한 안에서는 그대로 민다', () => {
    const { state } = move(createState(LIMITED_STAGE), 'right')

    expect(state.boxes).toEqual([{ x: 2, y: 1 }])
    expect(state.player).toEqual({ x: 1, y: 1 })
  })

  it('제한을 다 쓰면 상자가 밀리지 않고 큐브가 상자 위로 올라선다', () => {
    const { state, events } = play(LIMITED_STAGE, ['right', 'right'])

    expect(state.boxes).toEqual([{ x: 2, y: 1 }])
    expect(state.player).toEqual({ x: 2, y: 1 })
    expect(state.pushes).toBe(1)
    expect(events).toEqual([
      { type: 'limit', limit: 'pushes' },
      { type: 'climbed', from: { x: 1, y: 1 }, to: { x: 2, y: 1 }, via: 'box' },
    ])
  })

  it('제한을 다 써도 상자가 없는 쪽으로는 계속 이동한다', () => {
    const { state } = play(LIMITED_STAGE, ['right', 'up'])

    expect(state.player).toEqual({ x: 1, y: 0 })
    expect(state.moves).toBe(2)
  })

  it('이동 제한과 밀기 제한을 함께 두면 각자 동작한다', () => {
    const stage: Stage = { ...BOX_STAGE, rules: { moveLimit: 3, pushLimit: 1 } }
    const used = play(stage, ['right', 'right', 'right'])

    expect(used.state.pushes).toBe(1)
    expect(used.state.moves).toBe(3)
    expect(move(used.state, 'right').state).toBe(used.state)
  })
})

describe('pushesLeft', () => {
  it('제한이 없으면 null을 돌려준다', () => {
    expect(pushesLeft(createState(BOX_STAGE))).toBe(null)
  })

  it('제한이 있으면 남은 밀기 수를 돌려준다', () => {
    const stage: Stage = { ...BOX_STAGE, rules: { pushLimit: 2 } }

    expect(pushesLeft(createState(stage))).toBe(2)
    expect(pushesLeft(play(stage, ['right']).state)).toBe(1)
    expect(pushesLeft(play(stage, ['right', 'right']).state)).toBe(0)
  })
})

// 상자 오른쪽 칸이 한 층 높아 상자가 밀리지 않고 큐브가 딛고 오른다
const CLIMB_BOX_STAGE: Stage = { ...BOX_STAGE, heights: withMiddleRow([0, 0, 1, 0, 0]) }

describe('move 오른 횟수', () => {
  it('상자를 딛고 오르면 오른 횟수가 1 오른다', () => {
    const { state, events } = move(createState(CLIMB_BOX_STAGE), 'right')

    expect(events).toEqual([
      { type: 'climbed', from: { x: 0, y: 1 }, to: { x: 1, y: 1 }, via: 'box' },
    ])
    expect(state.climbs).toBe(1)
  })

  it('기대 놓은 사다리로 오르면 오른 횟수가 1 오른다', () => {
    const { state } = play(LADDER_STAGE, ['right', 'right', 'right', 'right'])

    expect(state.climbs).toBe(1)
  })

  it('사다리를 줍거나 놓는 이동은 오른 횟수가 오르지 않는다', () => {
    expect(move(createState(LADDER_STAGE), 'right').state.climbs).toBe(0)
    expect(play(LADDER_STAGE, ['right', 'right', 'right']).state.climbs).toBe(0)
  })

  it('사다리를 타고 내려오는 이동은 오른 횟수가 오르지 않는다', () => {
    const { state } = play(LADDER_STAGE, ['right', 'right', 'right', 'right', 'left'])

    expect(state.player).toEqual({ x: 2, y: 1 })
    expect(state.climbs).toBe(1)
  })

  it('발판을 타고 높이가 올라가도 오른 횟수가 오르지 않는다', () => {
    const stage: Stage = {
      ...LIFT_STAGE,
      start: { x: 1, y: 1 },
      entities: [
        { type: 'switch', x: 3, y: 1, target: 'a' },
        { type: 'lift', x: 2, y: 1, id: 'a' },
        { type: 'box', x: 2, y: 1 },
      ],
    }
    const { state } = move(createState(stage), 'right')

    expect(state.player).toEqual({ x: 2, y: 1 })
    expect(standHeight(state, { x: 2, y: 1 })).toBe(1)
    expect(state.climbs).toBe(0)
  })
})

describe('move 올라가기 제한', () => {
  const LIMITED_STAGE: Stage = { ...CLIMB_BOX_STAGE, rules: { climbLimit: 1 } }

  it('제한 안에서는 그대로 오른다', () => {
    const { state } = move(createState(LIMITED_STAGE), 'right')

    expect(state.player).toEqual({ x: 1, y: 1 })
    expect(state.climbs).toBe(1)
  })

  it('제한을 다 쓰면 상자를 딛고 오르지 못한다', () => {
    const { state, events } = play(LIMITED_STAGE, ['right', 'left', 'right'])

    expect(state.player).toEqual({ x: 0, y: 1 })
    expect(events).toEqual([
      { type: 'blocked', direction: 'right' },
      { type: 'limit', limit: 'climbs' },
    ])
  })

  it('제한을 다 쓰면 기대 놓은 사다리로도 오르지 못한다', () => {
    const stage: Stage = { ...LADDER_STAGE, rules: { climbLimit: 1 } }
    const { state, events } = play(stage, [
      'right',
      'right',
      'right',
      'right',
      'left',
      'right',
      'right',
    ])

    expect(state.player).toEqual({ x: 2, y: 1 })
    expect(state.leaningLadders).toEqual([{ x: 2, y: 1, direction: 'right' }])
    expect(events).toEqual([
      { type: 'blocked', direction: 'right' },
      { type: 'limit', limit: 'climbs' },
    ])
  })

  it('제한을 다 써도 오르지 않는 쪽으로는 계속 이동한다', () => {
    const { state } = play(LIMITED_STAGE, ['right', 'left', 'up'])

    expect(state.player).toEqual({ x: 0, y: 0 })
    expect(state.moves).toBe(3)
  })
})

describe('climbsLeft', () => {
  it('제한이 없으면 null을 돌려준다', () => {
    expect(climbsLeft(createState(CLIMB_BOX_STAGE))).toBe(null)
  })

  it('제한이 있으면 남은 올라가기 수를 돌려준다', () => {
    const stage: Stage = { ...CLIMB_BOX_STAGE, rules: { climbLimit: 2 } }

    expect(climbsLeft(createState(stage))).toBe(2)
    expect(climbsLeft(play(stage, ['right']).state)).toBe(1)
    expect(climbsLeft(play(stage, ['right', 'left', 'right']).state)).toBe(0)
  })
})

const CRACK_STAGE: Stage = {
  version: 1,
  id: 'test-crack',
  name: '무너지는 칸 테스트',
  heights: [
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  start: { x: 0, y: 1 },
  goal: { x: 3, y: 0 },
  entities: [],
  cracks: ['....', '.2..', '....'],
}

const CRACK: Point = { x: 1, y: 1 }

const withCrackRow = (row: number[]) => [CRACK_STAGE.heights[0], row, CRACK_STAGE.heights[2]]

const leftAt = (state: GameState, p: Point) =>
  state.cracks.find((crack) => crack.x === p.x && crack.y === p.y)?.left

describe('move 무너지는 칸', () => {
  // 왼쪽 끝 무너지는 칸 옆에 얼음 길이 있어 닳아 사라진 자리로 미끄러져 들어갈 수 있다
  const CRACK_ICE_STAGE: Stage = {
    ...CRACK_STAGE,
    heights: [
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
    ],
    start: { x: 0, y: 0 },
    goal: { x: 4, y: 2 },
    cracks: ['.....', '1....', '.....'],
    ice: ['.....', '.##..', '.....'],
  }

  it('올라선 동안에는 남은 횟수가 그대로다', () => {
    const { state, events } = move(createState(CRACK_STAGE), 'right')

    expect(state.player).toEqual(CRACK)
    expect(leftAt(state, CRACK)).toBe(2)
    expect(events.some((e) => e.type === 'cracked')).toBe(false)
  })

  it('떠나면 남은 횟수가 하나 준다', () => {
    const { state, events } = play(CRACK_STAGE, ['right', 'right'])

    expect(leftAt(state, CRACK)).toBe(1)
    expect(state.heights[1][1]).toBe(0)
    expect(events).toContainEqual({ type: 'cracked', at: CRACK, left: 1, gone: false })
  })

  it('남은 횟수를 다 쓰면 바닥 없는 칸이 되어 다시 지나가지 못한다', () => {
    const { state, events } = play(CRACK_STAGE, ['right', 'right', 'left', 'left'])

    expect(state.heights[1][1]).toBe(-1)
    expect(events).toContainEqual({ type: 'cracked', at: CRACK, left: 0, gone: true })
    expect(move(state, 'right').events).toEqual([{ type: 'blocked', direction: 'right' }])
  })

  it('막혀서 제자리로 돌아오면 줄지 않는다', () => {
    const stage: Stage = { ...CRACK_STAGE, cracks: ['....', '2...', '....'] }
    const start = createState(stage)
    const { state, events } = move(start, 'left')

    expect(state).toBe(start)
    expect(events).toEqual([{ type: 'blocked', direction: 'left' }])
  })

  it('상자가 남아 있으면 큐브가 떠나도 줄지 않는다', () => {
    const stage: Stage = {
      ...CRACK_STAGE,
      heights: withCrackRow([0, 0, 1, 0]),
      entities: [{ type: 'box', x: 1, y: 1 }],
    }
    const { state, events } = play(stage, ['right', 'up'])

    expect(state.player).toEqual({ x: 1, y: 0 })
    expect(state.boxes).toEqual([CRACK])
    expect(leftAt(state, CRACK)).toBe(2)
    expect(events.some((e) => e.type === 'cracked')).toBe(false)
  })

  it('상자가 밀려 나가면 남은 횟수가 준다', () => {
    const stage: Stage = { ...CRACK_STAGE, entities: [{ type: 'box', x: 1, y: 1 }] }
    const { state, events } = move(createState(stage), 'right')

    expect(state.boxes).toEqual([{ x: 2, y: 1 }])
    expect(state.player).toEqual(CRACK)
    expect(leftAt(state, CRACK)).toBe(1)
    expect(events).toContainEqual({ type: 'cracked', at: CRACK, left: 1, gone: false })
  })

  it('한 번 남은 칸의 상자를 밀면 큐브가 선 동안은 바닥이 남고 떠날 때 사라진다', () => {
    const stage: Stage = {
      ...CRACK_STAGE,
      cracks: ['....', '.1..', '....'],
      entities: [{ type: 'box', x: 1, y: 1 }],
    }
    const pushed = move(createState(stage), 'right')
    const away = move(pushed.state, 'up')

    expect(pushed.state.heights[1][1]).toBe(0)
    expect(pushed.events).toContainEqual({ type: 'cracked', at: CRACK, left: 0, gone: false })
    expect(away.state.heights[1][1]).toBe(-1)
    expect(away.events).toContainEqual({ type: 'cracked', at: CRACK, left: 0, gone: true })
  })

  it('무너진 칸에 상자를 밀어 넣으면 다시 바닥이 되고 다시 무너지지 않는다', () => {
    const stage: Stage = {
      ...CRACK_STAGE,
      cracks: ['....', '.1..', '....'],
      entities: [{ type: 'box', x: 2, y: 1 }],
    }
    const { state } = play(stage, ['right', 'down', 'right', 'right', 'up', 'left'])
    const onFill = move(state, 'left')
    const offFill = move(onFill.state, 'left')

    expect(state.heights[1][1]).toBe(0)
    expect(state.boxes).toEqual([])
    expect(onFill.state.player).toEqual(CRACK)
    expect(offFill.state.heights[1][1]).toBe(0)
    expect(offFill.events.some((e) => e.type === 'cracked')).toBe(false)
  })

  it('떨어지거나 올라가며 떠나도 남은 횟수가 준다', () => {
    const cliff: Stage = { ...CRACK_STAGE, heights: withCrackRow([1, 1, 0, 0]) }
    const fallen = play(cliff, ['right', 'right'])

    expect(fallen.events).toContainEqual({ type: 'cracked', at: CRACK, left: 1, gone: false })

    const wall: Stage = {
      ...CRACK_STAGE,
      heights: withCrackRow([0, 0, 0, 1]),
      entities: [{ type: 'box', x: 2, y: 1 }],
    }
    const climbed = play(wall, ['right', 'right'])

    expect(climbed.state.player).toEqual({ x: 2, y: 1 })
    expect(climbed.events).toContainEqual({ type: 'cracked', at: CRACK, left: 1, gone: false })
  })

  it('기대 놓은 사다리가 있으면 다 닳아도 무너지지 않는다', () => {
    const stage: Stage = {
      ...CRACK_STAGE,
      heights: withCrackRow([0, 0, 1, 0]),
      cracks: ['....', '.1..', '....'],
      entities: [{ type: 'ladder', x: 0, y: 2 }],
    }
    // 사다리를 주워 와 무너지는 칸에서 오른쪽 턱에 기대 놓고 오른다
    const leaned = play(stage, ['down', 'up', 'right', 'right'])

    expect(leaned.state.leaningLadders).toEqual([{ x: 1, y: 1, direction: 'right' }])
    expect(leaned.state.heights[1][1]).toBe(0)

    const climbed = move(leaned.state, 'right')
    expect(climbed.state.player).toEqual({ x: 2, y: 1 })
    expect(climbed.state.heights[1][1]).toBe(0)
    expect(climbed.events.every((e) => e.type !== 'cracked' || !e.gone)).toBe(true)
  })

  it('다 닳은 칸의 기대 놓은 사다리를 도로 들고 떠나면 그때 무너진다', () => {
    const stage: Stage = {
      ...CRACK_STAGE,
      heights: withCrackRow([0, 0, 1, 0]),
      cracks: ['....', '.1..', '....'],
      entities: [{ type: 'ladder', x: 0, y: 2 }],
    }
    const picked = play(stage, ['down', 'up', 'right', 'right', 'right', 'left'])
    const { state, events } = move(picked.state, 'left')

    expect(picked.state.carrying).toBe(true)
    expect(picked.state.leaningLadders).toEqual([])
    expect(picked.state.heights[1][1]).toBe(0)
    expect(state.heights[1][1]).toBe(-1)
    expect(events).toContainEqual({ type: 'cracked', at: CRACK, left: 0, gone: true })
  })

  it('얼음으로 미끄러져 떠나도 남은 횟수가 준다', () => {
    const stage: Stage = { ...CRACK_STAGE, ice: ['....', '..##', '....'] }
    const { state, events } = play(stage, ['right', 'right'])

    expect(state.player).toEqual({ x: 3, y: 1 })
    expect(leftAt(state, CRACK)).toBe(1)
    expect(events).toContainEqual({ type: 'cracked', at: CRACK, left: 1, gone: false })
  })

  it('미끄러져 무너지는 칸에 도착해 멈추면 줄지 않는다', () => {
    const stage: Stage = {
      ...CRACK_STAGE,
      cracks: ['....', '...2', '....'],
      ice: ['....', '.##.', '....'],
    }
    const { state, events } = move(createState(stage), 'right')

    expect(state.player).toEqual({ x: 3, y: 1 })
    expect(leftAt(state, { x: 3, y: 1 })).toBe(2)
    expect(events.some((e) => e.type === 'cracked')).toBe(false)
  })

  it('순간이동으로 떠나도 남은 횟수가 준다', () => {
    const stage: Stage = {
      ...CRACK_STAGE,
      entities: [
        { type: 'warp', x: 2, y: 1, id: 'a' },
        { type: 'warp', x: 3, y: 2, id: 'a' },
      ],
    }
    const { state, events } = play(stage, ['right', 'right'])

    expect(state.player).toEqual({ x: 3, y: 2 })
    expect(leftAt(state, CRACK)).toBe(1)
    expect(events).toContainEqual({ type: 'cracked', at: CRACK, left: 1, gone: false })
  })

  it('미끄러지다 무너져 사라진 자리를 만나면 그 앞에서 멈춘다', () => {
    const { state, events } = play(CRACK_ICE_STAGE, [
      'down',
      'up',
      'right',
      'right',
      'right',
      'down',
      'left',
    ])

    expect(state.heights[1][0]).toBe(-1)
    expect(state.player).toEqual({ x: 1, y: 1 })
    expect(events).toEqual([
      { type: 'moved', from: { x: 3, y: 1 }, to: { x: 2, y: 1 } },
      { type: 'slid', subject: 'player', from: { x: 2, y: 1 }, to: { x: 1, y: 1 } },
    ])
  })

  it('미끄러지던 상자가 무너져 사라진 자리를 메운다', () => {
    const stage: Stage = { ...CRACK_ICE_STAGE, entities: [{ type: 'box', x: 3, y: 1 }] }
    const { state, events } = play(stage, [
      'down',
      'up',
      'right',
      'right',
      'right',
      'right',
      'down',
      'left',
    ])

    expect(state.boxes).toEqual([])
    expect(state.heights[1][0]).toBe(0)
    expect(state.player).toEqual({ x: 3, y: 1 })
    expect(events).toEqual([
      { type: 'pushed', from: { x: 3, y: 1 }, to: { x: 2, y: 1 }, result: 'slid' },
      { type: 'slid', subject: 'box', from: { x: 2, y: 1 }, to: { x: 1, y: 1 } },
      { type: 'pushed', from: { x: 1, y: 1 }, to: { x: 0, y: 1 }, result: 'filled' },
      { type: 'moved', from: { x: 4, y: 1 }, to: { x: 3, y: 1 } },
    ])
  })

  it('상자가 얼음을 타고 다른 무너지는 칸에 멈추면 떠난 칸만 닳는다', () => {
    const stage: Stage = {
      ...CRACK_ICE_STAGE,
      start: { x: 0, y: 1 },
      cracks: ['.....', '.2.2.', '.....'],
      ice: ['.....', '..#..', '.....'],
      entities: [{ type: 'box', x: 1, y: 1 }],
    }
    const { state, events } = move(createState(stage), 'right')

    expect(state.boxes).toEqual([{ x: 3, y: 1 }])
    expect(leftAt(state, { x: 1, y: 1 })).toBe(1)
    expect(leftAt(state, { x: 3, y: 1 })).toBe(2)
    expect(events.filter((e) => e.type === 'cracked')).toEqual([
      { type: 'cracked', at: { x: 1, y: 1 }, left: 1, gone: false },
    ])
  })

  it('올라가기 제한을 다 써 오르지 못하면 제자리라 남은 횟수가 줄지 않는다', () => {
    const stage: Stage = {
      ...CRACK_STAGE,
      heights: withCrackRow([0, 0, 0, 1]),
      entities: [{ type: 'box', x: 2, y: 1 }],
      rules: { climbLimit: 1 },
    }
    const onCrack = play(stage, ['right', 'right', 'left']).state
    const { state, events } = move(onCrack, 'right')

    expect(onCrack.player).toEqual(CRACK)
    expect(state).toBe(onCrack)
    expect(events).toEqual([
      { type: 'blocked', direction: 'right' },
      { type: 'limit', limit: 'climbs' },
    ])
    expect(leftAt(state, CRACK)).toBe(1)
  })
})

const WARP_STAGE: Stage = {
  version: 1,
  id: 'test-warp',
  name: '짝 칸 테스트',
  heights: [
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
  ],
  start: { x: 0, y: 1 },
  goal: { x: 4, y: 0 },
  entities: [
    { type: 'warp', x: 1, y: 1, id: 'a' },
    { type: 'warp', x: 4, y: 1, id: 'a' },
  ],
}

describe('move 짝 칸', () => {
  it('짝 칸에 들어가면 짝인 칸에 서고 이동 수는 1이다', () => {
    const { state, events } = move(createState(WARP_STAGE), 'right')

    expect(state.player).toEqual({ x: 4, y: 1 })
    expect(state.moves).toBe(1)
    expect(events).toEqual([
      { type: 'moved', from: { x: 0, y: 1 }, to: { x: 1, y: 1 } },
      { type: 'warped', from: { x: 1, y: 1 }, to: { x: 4, y: 1 } },
    ])
  })

  it('순간이동으로 도착한 칸에서는 다시 순간이동하지 않는다', () => {
    const { state, events } = move(createState(WARP_STAGE), 'right')

    expect(state.player).toEqual({ x: 4, y: 1 })
    expect(events.filter((e) => e.type === 'warped')).toHaveLength(1)
  })

  it('나올 칸에 상자가 있으면 들어간 칸에 그대로 선다', () => {
    const stage: Stage = {
      ...WARP_STAGE,
      entities: [...WARP_STAGE.entities, { type: 'box', x: 4, y: 1 }],
    }
    const { state, events } = move(createState(stage), 'right')

    expect(state.player).toEqual({ x: 1, y: 1 })
    expect(events).toEqual([{ type: 'moved', from: { x: 0, y: 1 }, to: { x: 1, y: 1 } }])
  })

  it('상자는 순간이동하지 않고 짝 칸 위에 올라가 있는다', () => {
    const stage: Stage = {
      ...WARP_STAGE,
      entities: [
        { type: 'warp', x: 2, y: 1, id: 'a' },
        { type: 'warp', x: 4, y: 1, id: 'a' },
        { type: 'box', x: 1, y: 1 },
      ],
    }
    const { state, events } = move(createState(stage), 'right')

    expect(state.boxes).toEqual([{ x: 2, y: 1 }])
    expect(state.player).toEqual({ x: 1, y: 1 })
    expect(events.some((e) => e.type === 'warped')).toBe(false)
  })

  it('짝 칸의 상자 위에 올라서면 순간이동하지 않는다', () => {
    const stage: Stage = {
      ...WARP_STAGE,
      heights: [
        [0, 0, 0, 0, 0],
        [0, 0, 0, 2, 0],
        [0, 0, 0, 0, 0],
      ],
      start: { x: 1, y: 1 },
      entities: [
        { type: 'warp', x: 2, y: 1, id: 'a' },
        { type: 'warp', x: 4, y: 1, id: 'a' },
        { type: 'box', x: 2, y: 1 },
      ],
    }
    const { state, events } = move(createState(stage), 'right')

    expect(state.player).toEqual({ x: 2, y: 1 })
    expect(events.some((e) => e.type === 'warped')).toBe(false)
  })

  it('얼음을 타고 미끄러져 짝 칸에서 멈추면 순간이동한다', () => {
    const stage: Stage = {
      ...WARP_STAGE,
      ice: ['.....', '.##..', '.....'],
      entities: [
        { type: 'warp', x: 3, y: 1, id: 'a' },
        { type: 'warp', x: 4, y: 2, id: 'a' },
      ],
    }
    const { state, events } = move(createState(stage), 'right')

    expect(state.player).toEqual({ x: 4, y: 2 })
    expect(state.moves).toBe(1)
    expect(events).toEqual([
      { type: 'moved', from: { x: 0, y: 1 }, to: { x: 1, y: 1 } },
      { type: 'slid', subject: 'player', from: { x: 1, y: 1 }, to: { x: 3, y: 1 } },
      { type: 'warped', from: { x: 3, y: 1 }, to: { x: 4, y: 2 } },
    ])
  })

  it('떨어져 내려와 짝 칸에 착지해도 순간이동한다', () => {
    const stage: Stage = {
      ...WARP_STAGE,
      heights: [
        [0, 0, 0, 0, 0],
        [1, 0, 0, 0, 0],
        [0, 0, 0, 0, 0],
      ],
    }
    const { state, events } = move(createState(stage), 'right')

    expect(state.player).toEqual({ x: 4, y: 1 })
    expect(events).toEqual([
      { type: 'fell', from: { x: 0, y: 1 }, to: { x: 1, y: 1 }, drop: 1 },
      { type: 'warped', from: { x: 1, y: 1 }, to: { x: 4, y: 1 } },
    ])
  })

  it('미끄러져 멈춘 짝 칸의 나올 칸에 상자가 있으면 멈춘 그 칸에 선다', () => {
    const stage: Stage = {
      ...WARP_STAGE,
      ice: ['.....', '.##..', '.....'],
      entities: [
        { type: 'warp', x: 3, y: 1, id: 'a' },
        { type: 'warp', x: 4, y: 2, id: 'a' },
        { type: 'box', x: 4, y: 2 },
      ],
    }
    const { state, events } = move(createState(stage), 'right')

    expect(state.player).toEqual({ x: 3, y: 1 })
    expect(state.moves).toBe(1)
    expect(events).toEqual([
      { type: 'moved', from: { x: 0, y: 1 }, to: { x: 1, y: 1 } },
      { type: 'slid', subject: 'player', from: { x: 1, y: 1 }, to: { x: 3, y: 1 } },
    ])
  })

  it('상자를 민 뒤 선 칸이 짝 칸이면 순간이동한다', () => {
    const stage: Stage = {
      ...WARP_STAGE,
      start: { x: 1, y: 1 },
      goal: { x: 0, y: 0 },
      entities: [
        { type: 'warp', x: 3, y: 1, id: 'a' },
        { type: 'warp', x: 4, y: 2, id: 'a' },
        { type: 'box', x: 2, y: 1 },
      ],
    }
    const { state, events } = play(stage, ['right', 'right'])

    expect(state.player).toEqual({ x: 4, y: 2 })
    expect(state.boxes).toEqual([{ x: 4, y: 1 }])
    expect(events).toEqual([
      { type: 'pushed', from: { x: 3, y: 1 }, to: { x: 4, y: 1 }, result: 'slid' },
      { type: 'moved', from: { x: 2, y: 1 }, to: { x: 3, y: 1 } },
      { type: 'warped', from: { x: 3, y: 1 }, to: { x: 4, y: 2 } },
    ])
  })

  it('순간이동한 이동도 이동 제한을 1만 쓴다', () => {
    const stage: Stage = { ...WARP_STAGE, rules: { moveLimit: 2 } }
    const { state } = move(createState(stage), 'right')

    expect(state.player).toEqual({ x: 4, y: 1 })
    expect(state.moves).toBe(1)
    expect(movesLeft(state)).toBe(1)
  })

  it('순간이동으로 도착한 칸이 목표면 클리어한다', () => {
    const stage: Stage = { ...WARP_STAGE, goal: { x: 4, y: 1 } }
    const { state, events } = move(createState(stage), 'right')

    expect(state.player).toEqual({ x: 4, y: 1 })
    expect(state.cleared).toBe(true)
    expect(events).toContainEqual({ type: 'cleared' })
  })
})

const TRAM_CELLS: Point[] = [
  { x: 1, y: 1 },
  { x: 2, y: 1 },
  { x: 3, y: 1 },
]

const TRAM_STAGE: Stage = {
  version: 1,
  id: 'test-tram',
  name: '움직이는 발판 테스트',
  heights: [
    [0, 0, 0, 0, 0, 0],
    [0, -1, -1, -1, 0, 0],
    [0, 0, 0, 0, 0, 0],
  ],
  start: { x: 0, y: 1 },
  goal: { x: 5, y: 2 },
  entities: [{ type: 'tram', x: 1, y: 1, id: 'tram-a', level: 0, cells: TRAM_CELLS, dir: 1 }],
}

const withTram = (tram: Partial<Extract<Entity, { type: 'tram' }>>, rest?: Partial<Stage>) => {
  const base = TRAM_STAGE.entities[0] as Extract<Entity, { type: 'tram' }>
  return { ...TRAM_STAGE, ...rest, entities: [{ ...base, ...tram }, ...(rest?.entities ?? [])] }
}

describe('move 움직이는 발판', () => {
  it('큐브가 한 칸 움직이면 발판도 한 칸 가고 위에 선 큐브가 같이 간다', () => {
    const { state, events } = move(createState(TRAM_STAGE), 'right')

    expect(state.player).toEqual({ x: 2, y: 1 })
    expect(state.moves).toBe(1)
    expect(state.trams).toEqual([{ id: 'tram-a', at: 1, dir: 1 }])
    expect(events).toEqual([
      { type: 'moved', from: { x: 0, y: 1 }, to: { x: 1, y: 1 } },
      { type: 'tram', id: 'tram-a', from: { x: 1, y: 1 }, to: { x: 2, y: 1 } },
    ])
  })

  it('벽에 막혀 제자리면 발판도 가지 않는다', () => {
    const start = createState(TRAM_STAGE)
    const { state, events } = move(start, 'left')

    expect(state).toBe(start)
    expect(state.trams).toEqual([{ id: 'tram-a', at: 0, dir: 1 }])
    expect(events).toEqual([{ type: 'blocked', direction: 'left' }])
  })

  it('얼음에서 여러 칸 미끄러져도 발판은 한 칸만 간다', () => {
    const stage = withTram({}, { start: { x: 0, y: 0 }, ice: ['.##...', '......', '......'] })
    const { state, events } = move(createState(stage), 'right')

    expect(state.player).toEqual({ x: 3, y: 0 })
    expect(state.moves).toBe(1)
    expect(state.trams).toEqual([{ id: 'tram-a', at: 1, dir: 1 }])
    expect(events.filter((e) => e.type === 'tram')).toHaveLength(1)
  })

  it('길 끝에 닿으면 방향을 뒤집어 돌아온다', () => {
    const { state } = play(TRAM_STAGE, ['up', 'down', 'up'])

    expect(state.trams).toEqual([{ id: 'tram-a', at: 1, dir: -1 }])
  })

  it('발판이 없는 길 칸에는 들어갈 수 없다', () => {
    const { state, events } = move(createState(withTram({ x: 3, y: 1 })), 'right')

    expect(state.player).toEqual({ x: 0, y: 1 })
    expect(events.some((e) => e.type === 'moved')).toBe(false)
  })

  it('발판 윗면이 선 높이와 같으면 걸어 들어가고 낮으면 떨어진다', () => {
    const ledge = [
      [0, 0, 0, 0, 0, 0],
      [1, -1, -1, -1, 0, 0],
      [0, 0, 0, 0, 0, 0],
    ]
    const level = move(createState(withTram({ level: 1 }, { heights: ledge })), 'right')

    expect(level.state.player).toEqual({ x: 2, y: 1 })
    expect(level.events[0]).toEqual({ type: 'moved', from: { x: 0, y: 1 }, to: { x: 1, y: 1 } })

    const low = move(createState(withTram({}, { heights: ledge })), 'right')

    expect(low.events[0]).toEqual({
      type: 'fell',
      from: { x: 0, y: 1 },
      to: { x: 1, y: 1 },
      drop: 1,
    })
  })

  it('발판 윗면이 한 층 높으면 그냥은 올라가지 못한다', () => {
    const { state, events } = move(createState(withTram({ level: 1 })), 'right')

    expect(state.player).toEqual({ x: 0, y: 1 })
    expect(events.some((e) => e.type === 'moved')).toBe(false)
  })

  it('발판이 없는 길 칸으로는 상자를 밀 수 없다', () => {
    const stage = withTram({}, { start: { x: 5, y: 1 }, entities: [{ type: 'box', x: 4, y: 1 }] })
    const { state } = move(createState(stage), 'left')

    expect(state.pushes).toBe(0)
    expect(state.boxes).toEqual([{ x: 4, y: 1 }])
    expect(state.heights[1][3]).toBe(-1)
  })

  it('발판 위로 상자를 밀 수 있고 상자가 발판과 같이 간다', () => {
    const stage = withTram(
      { x: 3, y: 1 },
      { start: { x: 5, y: 1 }, entities: [{ type: 'box', x: 4, y: 1 }] },
    )
    const first = move(createState(stage), 'left')

    expect(first.state.pushes).toBe(1)
    expect(first.state.player).toEqual({ x: 4, y: 1 })
    expect(first.state.boxes).toEqual([{ x: 2, y: 1 }])
    expect(first.events).toContainEqual({
      type: 'pushed',
      from: { x: 4, y: 1 },
      to: { x: 3, y: 1 },
      result: 'slid',
    })

    const second = move(first.state, 'up')

    expect(second.state.boxes).toEqual([{ x: 1, y: 1 }])
  })
})

const BOX_RIDE_STAGE: Stage = {
  version: 1,
  id: 'test-tram-box',
  name: '발판 상자 테스트',
  heights: [
    [0, 0, 0, 0, 0],
    [0, -1, -1, -1, 0],
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
  ],
  ice: ['.....', '.....', '.#...', '.....'],
  start: { x: 2, y: 3 },
  goal: { x: 4, y: 3 },
  entities: [
    {
      type: 'tram',
      x: 2,
      y: 1,
      id: 'tram-a',
      level: 0,
      cells: TRAM_CELLS,
      dir: 1,
    },
    { type: 'box', x: 2, y: 2 },
  ],
}

describe('move 발판 위에서 막힌 이동', () => {
  it('세 칸 길을 발판을 타고 건너간다', () => {
    const { state } = play(TRAM_STAGE, ['right', 'right', 'right'])

    expect(state.player).toEqual({ x: 4, y: 1 })
    expect(state.moves).toBe(3)
  })

  it('발판 위에서 막히면 이동 수가 오르고 발판을 따라 실려 간다', () => {
    const onTram = move(createState(TRAM_STAGE), 'right').state
    const { state } = move(onTram, 'right')

    expect(onTram.player).toEqual({ x: 2, y: 1 })
    expect(state.player).toEqual({ x: 3, y: 1 })
    expect(state.moves).toBe(2)
  })

  it('발판 위에서 막힌 이동은 blocked 없이 발판 이벤트만 남긴다', () => {
    const onTram = move(createState(TRAM_STAGE), 'right').state
    const { events } = move(onTram, 'right')

    expect(events).toEqual([
      { type: 'tram', id: 'tram-a', from: { x: 2, y: 1 }, to: { x: 3, y: 1 } },
    ])
  })

  it('땅 위에서 막힌 이동은 이동 수를 늘리지 않는다', () => {
    const start = createState(TRAM_STAGE)
    const { state, events } = move(start, 'left')

    expect(state.moves).toBe(0)
    expect(events).toEqual([{ type: 'blocked', direction: 'left' }])
  })

  it('발판 위에서 내릴 수 있는 쪽으로 가면 평소대로 내린다', () => {
    const onTram = move(createState(TRAM_STAGE), 'right').state
    const { state, events } = move(onTram, 'up')

    expect(state.player).toEqual({ x: 2, y: 0 })
    expect(events[0]).toEqual({ type: 'moved', from: { x: 2, y: 1 }, to: { x: 2, y: 0 } })
  })

  it('보스 이동 제한이 있으면 발판 위에서 막힌 이동도 제한을 쓴다', () => {
    const stage: Stage = { ...TRAM_STAGE, rules: { moveLimit: 2 } }
    const onTram = move(createState(stage), 'right').state
    const { state } = move(onTram, 'right')

    expect(state.moves).toBe(2)
    expect(movesLeft(state)).toBe(0)
  })

  it('발판 위 상자에 올라선 큐브도 상자와 함께 실려 간다', () => {
    const climbed = play(BOX_RIDE_STAGE, ['up', 'left', 'up', 'right']).state

    expect(climbed.player).toEqual({ x: 2, y: 1 })
    expect(climbed.boxes).toEqual([{ x: 2, y: 1 }])

    const { state } = move(climbed, 'right')

    expect(state.player).toEqual({ x: 3, y: 1 })
    expect(state.boxes).toEqual([{ x: 3, y: 1 }])
    expect(state.moves).toBe(5)
  })
})

describe('move 발판 기다리기', () => {
  it('발판이 없는 길 칸 쪽으로 밀면 제자리에 서고 이동 수가 오른다', () => {
    const { state } = move(createState(withTram({ x: 3, y: 1 })), 'right')

    expect(state.player).toEqual({ x: 0, y: 1 })
    expect(state.moves).toBe(1)
  })

  it('기다리는 동안 발판이 한 칸 간다', () => {
    const { state } = move(createState(withTram({ x: 3, y: 1 })), 'right')

    expect(state.trams).toEqual([{ id: 'tram-a', at: 1, dir: -1 }])
  })

  it('기다린 이동은 blocked 없이 발판 이벤트만 남긴다', () => {
    const { events } = move(createState(withTram({ x: 3, y: 1 })), 'right')

    expect(events).toEqual([
      { type: 'tram', id: 'tram-a', from: { x: 3, y: 1 }, to: { x: 2, y: 1 } },
    ])
  })

  it('두 수를 이어 기다리면 발판이 두 칸 간다', () => {
    const { state } = play(withTram({ x: 3, y: 1 }), ['right', 'right'])

    expect(state.moves).toBe(2)
    expect(state.trams).toEqual([{ id: 'tram-a', at: 0, dir: -1 }])
  })

  it('발판 길이 아닌 벽이나 바닥 없는 칸 쪽으로 밀면 이동 수가 오르지 않는다', () => {
    const wall = createState(withTram({ x: 3, y: 1 }))
    const blocked = move(wall, 'left')

    expect(blocked.state).toBe(wall)
    expect(blocked.events).toEqual([{ type: 'blocked', direction: 'left' }])

    const pit = createState(
      withTram(
        { x: 3, y: 1 },
        {
          start: { x: 0, y: 0 },
          heights: [
            [0, -1, 0, 0, 0, 0],
            [0, -1, -1, -1, 0, 0],
            [0, 0, 0, 0, 0, 0],
          ],
        },
      ),
    )
    const fell = move(pit, 'right')

    expect(fell.state).toBe(pit)
    expect(fell.events).toEqual([{ type: 'blocked', direction: 'right' }])
  })

  it('발판이 와 있으면 기다리지 않고 평소대로 올라탄다', () => {
    const { state, events } = move(createState(TRAM_STAGE), 'right')

    expect(state.player).toEqual({ x: 2, y: 1 })
    expect(events[0]).toEqual({ type: 'moved', from: { x: 0, y: 1 }, to: { x: 1, y: 1 } })
  })

  it('발판 자리와 홀짝이 어긋나도 한 수 기다렸다가 탈 수 있다', () => {
    const { state } = play(withTram({ x: 3, y: 1 }), ['right', 'right', 'right'])

    expect(state.player).toEqual({ x: 2, y: 1 })
    expect(state.moves).toBe(3)
  })

  it('보스 이동 제한이 있으면 기다린 이동도 제한을 쓴다', () => {
    const stage = { ...withTram({ x: 3, y: 1 }), rules: { moveLimit: 1 } }
    const waited = move(createState(stage), 'right')

    expect(waited.state.moves).toBe(1)
    expect(movesLeft(waited.state)).toBe(0)

    const { state, events } = move(waited.state, 'right')

    expect(state.moves).toBe(1)
    expect(events).toEqual([
      { type: 'blocked', direction: 'right' },
      { type: 'limit', limit: 'moves' },
    ])
  })
})

const TRANSFER_STAGE: Stage = {
  version: 1,
  id: 'test-tram-transfer',
  name: '발판 옮겨 타기 테스트',
  heights: [
    [0, 0, 0, 0, 0],
    [0, -1, -1, -1, 0],
    [0, -1, -1, -1, 0],
  ],
  start: { x: 0, y: 1 },
  goal: { x: 4, y: 1 },
  entities: [
    { type: 'tram', x: 1, y: 1, id: 'tram-a', level: 0, cells: TRAM_CELLS, dir: 1 },
    {
      type: 'tram',
      x: 1,
      y: 2,
      id: 'tram-b',
      level: 0,
      cells: [
        { x: 1, y: 2 },
        { x: 2, y: 2 },
        { x: 3, y: 2 },
      ],
      dir: 1,
    },
  ],
}

describe('move 발판에 탄 횟수', () => {
  it('땅에서 발판으로 올라타면 한 번으로 센다', () => {
    const { state } = move(createState(TRAM_STAGE), 'right')

    expect(state.player).toEqual({ x: 2, y: 1 })
    expect(state.rides).toBe(1)
  })

  it('탄 채로 여러 칸 실려 가도 더 세지 않는다', () => {
    const { state } = play(TRAM_STAGE, ['right', 'right', 'right'])

    expect(state.player).toEqual({ x: 4, y: 1 })
    expect(state.moves).toBe(3)
    expect(state.rides).toBe(1)
  })

  it('기다린 이동은 세지 않는다', () => {
    const { state } = move(createState(withTram({ x: 3, y: 1 })), 'right')

    expect(state.moves).toBe(1)
    expect(state.rides).toBe(0)
  })

  it('발판에서 다른 발판으로 옮겨 타면 다시 센다', () => {
    const { state } = play(TRANSFER_STAGE, ['right', 'down'])

    expect(state.player).toEqual({ x: 3, y: 2 })
    expect(state.rides).toBe(2)
  })

  it('상자가 발판에 실리는 것은 세지 않는다', () => {
    const stage = withTram(
      { x: 3, y: 1 },
      { start: { x: 5, y: 1 }, entities: [{ type: 'box', x: 4, y: 1 }] },
    )
    const { state } = move(createState(stage), 'left')

    expect(state.boxes).toEqual([{ x: 2, y: 1 }])
    expect(state.player).toEqual({ x: 4, y: 1 })
    expect(state.rides).toBe(0)
  })

  it('발판 위 상자에 올라서는 것도 탄 것으로 센다', () => {
    const { state } = play(BOX_RIDE_STAGE, ['up', 'left', 'up', 'right'])

    expect(state.player).toEqual({ x: 2, y: 1 })
    expect(state.rides).toBe(1)
  })
})

describe('보스 타는 횟수 제한', () => {
  const LIMITED_STAGE: Stage = { ...TRAM_STAGE, rules: { rideLimit: 1 } }

  it('제한이 남아 있으면 평소대로 올라탄다', () => {
    const { state } = move(createState(LIMITED_STAGE), 'right')

    expect(state.player).toEqual({ x: 2, y: 1 })
    expect(state.rides).toBe(1)
  })

  it('제한을 다 쓰면 올라타지 못하고 이동 수도 늘지 않는다', () => {
    const used: GameState = { ...createState(LIMITED_STAGE), rides: 1 }
    const { state, events } = move(used, 'right')

    expect(state).toBe(used)
    expect(state.moves).toBe(0)
    expect(state.trams).toEqual([{ id: 'tram-a', at: 0, dir: 1 }])
    expect(events).toEqual([
      { type: 'blocked', direction: 'right' },
      { type: 'limit', limit: 'rides' },
    ])
  })

  it('제한을 다 써도 발판 길 쪽으로 밀어 기다리면 이동 수 1을 쓴다', () => {
    const stage: Stage = { ...withTram({ x: 3, y: 1 }), rules: { rideLimit: 1 } }
    const used: GameState = { ...createState(stage), rides: 1 }
    const { state, events } = move(used, 'right')

    expect(state.player).toEqual({ x: 0, y: 1 })
    expect(state.moves).toBe(1)
    expect(events).toEqual([
      { type: 'tram', id: 'tram-a', from: { x: 3, y: 1 }, to: { x: 2, y: 1 } },
    ])
  })

  it('제한을 다 써도 발판을 타지 않는 이동은 그대로 된다', () => {
    const used: GameState = { ...createState(LIMITED_STAGE), rides: 1 }
    const { state } = move(used, 'up')

    expect(state.player).toEqual({ x: 0, y: 0 })
    expect(state.moves).toBe(1)
  })
})

describe('ridesLeft', () => {
  it('제한이 없으면 null을 돌려준다', () => {
    expect(ridesLeft(createState(TRAM_STAGE))).toBe(null)
  })

  it('제한이 있으면 남은 횟수를 돌려준다', () => {
    const stage: Stage = { ...TRAM_STAGE, rules: { rideLimit: 2 } }

    expect(ridesLeft(createState(stage))).toBe(2)
    expect(ridesLeft(move(createState(stage), 'right').state)).toBe(1)
  })
})

const DIR_STAGE: Stage = {
  version: 1,
  id: 'test-dir',
  name: '방향 제한 테스트',
  heights: [
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
  ],
  start: { x: 2, y: 1 },
  goal: { x: 4, y: 0 },
  entities: [],
}

const withDirLimit = (stage: Stage, dir: Direction, count: number): Stage => ({
  ...stage,
  rules: { dirLimit: { dir, count } },
})

describe('보스 방향 제한', () => {
  it('제한한 방향으로 한 칸 가면 쓴 횟수가 는다', () => {
    const { state } = move(createState(withDirLimit(DIR_STAGE, 'left', 3)), 'left')

    expect(state.player).toEqual({ x: 1, y: 1 })
    expect(state.dirUses).toBe(1)
  })

  it('다른 방향으로 가면 쓴 횟수가 늘지 않는다', () => {
    const { state } = move(createState(withDirLimit(DIR_STAGE, 'left', 3)), 'right')

    expect(state.player).toEqual({ x: 3, y: 1 })
    expect(state.dirUses).toBe(0)
  })

  it('벽에 막혀 제자리면 쓴 횟수가 늘지 않는다', () => {
    const stage = withDirLimit({ ...DIR_STAGE, start: { x: 0, y: 1 } }, 'left', 3)
    const { state, events } = move(createState(stage), 'left')

    expect(state.dirUses).toBe(0)
    expect(events).toEqual([{ type: 'blocked', direction: 'left' }])
  })

  it('얼음으로 여러 칸 미끄러져도 한 번만 쓴다', () => {
    const { state } = move(createState(withDirLimit(ICE_STAGE, 'right', 3)), 'right')

    expect(state.player).toEqual({ x: 4, y: 1 })
    expect(state.dirUses).toBe(1)
  })

  it('상자를 밀어도 한 번 쓴다', () => {
    const stage = withDirLimit(
      { ...DIR_STAGE, entities: [{ type: 'box', x: 3, y: 1 }] },
      'right',
      3,
    )
    const { state } = move(createState(stage), 'right')

    expect(state.player).toEqual({ x: 3, y: 1 })
    expect(state.pushes).toBe(1)
    expect(state.dirUses).toBe(1)
  })

  it('짝 칸으로 튀어 나가도 한 번 쓴다', () => {
    const { state } = move(createState(withDirLimit(WARP_STAGE, 'right', 3)), 'right')

    expect(state.player).toEqual({ x: 4, y: 1 })
    expect(state.dirUses).toBe(1)
  })

  it('발판 길 쪽으로 밀어 기다려도 한 번 쓴다', () => {
    const stage = withDirLimit(withTram({ x: 3, y: 1 }), 'right', 3)
    const { state } = move(createState(stage), 'right')

    expect(state.player).toEqual({ x: 0, y: 1 })
    expect(state.moves).toBe(1)
    expect(state.dirUses).toBe(1)
  })

  it('제한을 다 쓰면 그 방향만 막히고 다른 방향은 그대로 된다', () => {
    const stage = withDirLimit(DIR_STAGE, 'left', 1)
    const used: GameState = { ...createState(stage), dirUses: 1 }
    const { state, events } = move(used, 'left')

    expect(state).toBe(used)
    expect(events).toEqual([
      { type: 'blocked', direction: 'left' },
      { type: 'limit', limit: 'dir' },
    ])
    expect(move(used, 'right').state.player).toEqual({ x: 3, y: 1 })
  })
})

describe('dirLeft', () => {
  it('제한이 없으면 null을 돌려준다', () => {
    expect(dirLeft(createState(DIR_STAGE))).toBe(null)
  })

  it('제한이 있으면 남은 횟수를 돌려준다', () => {
    const stage = withDirLimit(DIR_STAGE, 'left', 2)

    expect(dirLeft(createState(stage))).toBe(2)
    expect(dirLeft(move(createState(stage), 'left').state)).toBe(1)
  })
})

describe('보스 제약에 막힌 신호', () => {
  it('이동 제한을 다 쓰면 limit 이벤트를 낸다', () => {
    const used = play({ ...FLAT_STAGE, rules: { moveLimit: 2 } }, ['left', 'right']).state
    const { events } = move(used, 'up')

    expect(events).toContainEqual({ type: 'limit', limit: 'moves' })
  })

  it('밀기 제한을 다 쓰면 상자 위로 오르면서 limit 이벤트를 낸다', () => {
    const stage: Stage = { ...BOX_STAGE, rules: { pushLimit: 1 } }
    const { events } = play(stage, ['right', 'right'])

    expect(events).toContainEqual({ type: 'limit', limit: 'pushes' })
    expect(events).toContainEqual({
      type: 'climbed',
      from: { x: 1, y: 1 },
      to: { x: 2, y: 1 },
      via: 'box',
    })
  })

  it('올라가기 제한을 다 쓰면 limit 이벤트를 낸다', () => {
    const stage: Stage = { ...CLIMB_BOX_STAGE, rules: { climbLimit: 1 } }
    const { events } = play(stage, ['right', 'left', 'right'])

    expect(events).toContainEqual({ type: 'limit', limit: 'climbs' })
  })

  it('사다리로 오르지 못할 때도 limit 이벤트를 낸다', () => {
    const stage: Stage = { ...LADDER_STAGE, rules: { climbLimit: 1 } }
    const { events } = play(stage, ['right', 'right', 'right', 'right', 'left', 'right', 'right'])

    expect(events).toContainEqual({ type: 'limit', limit: 'climbs' })
  })

  it('타는 횟수 제한을 다 쓰면 limit 이벤트를 낸다', () => {
    const stage: Stage = { ...TRAM_STAGE, rules: { rideLimit: 1 } }
    const used: GameState = { ...createState(stage), rides: 1 }

    expect(move(used, 'right').events).toContainEqual({ type: 'limit', limit: 'rides' })
  })

  it('방향 제한을 다 쓰면 limit 이벤트를 낸다', () => {
    const used: GameState = { ...createState(withDirLimit(DIR_STAGE, 'left', 1)), dirUses: 1 }

    expect(move(used, 'left').events).toContainEqual({ type: 'limit', limit: 'dir' })
  })

  it('제한이 없는 판에서는 막혀도 limit 이벤트가 나오지 않는다', () => {
    const cases: MoveResult[] = [
      play(BOX_STAGE, ['right', 'right']),
      play(CLIMB_BOX_STAGE, ['right']),
      play(FLAT_STAGE, ['up', 'up']),
      move(createState(TRAM_STAGE), 'right'),
    ]

    for (const { events } of cases) {
      expect(events.some((e) => e.type === 'limit')).toBe(false)
    }
  })
})

const SWAMP_STAGE: Stage = {
  version: 1,
  id: 'test-swamp',
  name: '늪 테스트',
  heights: [
    [0, -1, 0, 0, 0],
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
  ],
  start: { x: 0, y: 1 },
  goal: { x: 4, y: 0 },
  entities: [],
  swamp: ['.....', '.#...', '.....'],
}

const SWAMP_TRAM_STAGE: Stage = {
  version: 1,
  id: 'test-swamp-tram',
  name: '늪과 발판 테스트',
  heights: [
    [0, 0, 0, 0, 0, 0],
    [0, -1, -1, -1, 0, 0],
    [0, 0, 0, 0, 0, 0],
  ],
  start: { x: 0, y: 2 },
  goal: { x: 5, y: 0 },
  entities: [{ type: 'tram', x: 1, y: 1, id: 'tram-a', level: 0, cells: TRAM_CELLS, dir: 1 }],
  swamp: ['......', '......', '.#....'],
}

describe('move 늪', () => {
  it('늪 칸 목록을 읽어 버둥 횟수 0으로 시작한다', () => {
    const state = createState(SWAMP_STAGE)

    expect(state.swamps).toEqual([{ x: 1, y: 1 }])
    expect(state.struggles).toBe(0)
  })

  it('늪 칸으로 들어가는 이동은 보통 이동과 같다', () => {
    const { state, events } = move(createState(SWAMP_STAGE), 'right')

    expect(state.player).toEqual({ x: 1, y: 1 })
    expect(state.moves).toBe(1)
    expect(state.struggles).toBe(0)
    expect(events).toEqual([{ type: 'moved', from: { x: 0, y: 1 }, to: { x: 1, y: 1 } }])
  })

  it('늪에서 두 수는 어느 방향을 눌러도 제자리에서 버둥거린다', () => {
    const first = play(SWAMP_STAGE, ['right', 'down'])
    const second = move(first.state, 'right')

    expect(first.state.player).toEqual({ x: 1, y: 1 })
    expect(first.state.moves).toBe(2)
    expect(first.state.struggles).toBe(1)
    expect(first.events).toEqual([{ type: 'struggled', at: { x: 1, y: 1 } }])
    expect(second.state.player).toEqual({ x: 1, y: 1 })
    expect(second.state.moves).toBe(3)
    expect(second.state.struggles).toBe(2)
  })

  it('갈 수 없는 방향을 눌러도 버둥으로 센다', () => {
    const { state, events } = play(SWAMP_STAGE, ['right', 'up'])

    expect(state.moves).toBe(2)
    expect(state.struggles).toBe(1)
    expect(events).toEqual([{ type: 'struggled', at: { x: 1, y: 1 } }])
  })

  it('세 번째에 누른 방향으로 나가고 버둥 횟수가 0으로 돌아간다', () => {
    const { state, events } = play(SWAMP_STAGE, ['right', 'up', 'left', 'down'])

    expect(state.player).toEqual({ x: 1, y: 2 })
    expect(state.moves).toBe(4)
    expect(state.struggles).toBe(0)
    expect(events).toEqual([{ type: 'moved', from: { x: 1, y: 1 }, to: { x: 1, y: 2 } }])
  })

  it('세 번째에 갈 수 없는 방향을 누르면 수를 쓰지 않고 버둥 횟수도 그대로다', () => {
    const struggled = play(SWAMP_STAGE, ['right', 'left', 'left']).state
    const { state, events } = move(struggled, 'up')
    const out = move(state, 'right')

    expect(state).toBe(struggled)
    expect(state.moves).toBe(3)
    expect(state.struggles).toBe(2)
    expect(events).toEqual([{ type: 'blocked', direction: 'up' }])
    expect(out.state.player).toEqual({ x: 2, y: 1 })
    expect(out.state.moves).toBe(4)
  })

  it('늪에서 다른 늪으로 나가면 다시 버둥거린다', () => {
    const stage: Stage = { ...SWAMP_STAGE, swamp: ['.....', '.##..', '.....'] }
    const { state } = play(stage, ['right', 'right', 'right', 'right'])

    expect(state.player).toEqual({ x: 2, y: 1 })
    expect(state.struggles).toBe(0)
  })

  it('버둥거리는 수에는 상자를 밀지 않고 나가는 수에 민다', () => {
    const stage: Stage = { ...SWAMP_STAGE, entities: [{ type: 'box', x: 2, y: 1 }] }
    const struggled = play(stage, ['right', 'right', 'right'])
    const out = move(struggled.state, 'right')

    expect(struggled.state.boxes).toEqual([{ x: 2, y: 1 }])
    expect(struggled.state.pushes).toBe(0)
    expect(out.state.boxes).toEqual([{ x: 3, y: 1 }])
    expect(out.state.player).toEqual({ x: 2, y: 1 })
    expect(out.state.pushes).toBe(1)
  })

  it('버둥거리는 수에는 사다리를 놓지 않는다', () => {
    const stage: Stage = {
      ...SWAMP_STAGE,
      heights: [
        [0, -1, 0, 0, 0],
        [0, 0, 1, 0, 0],
        [0, 0, 0, 0, 0],
      ],
    }
    const entered: GameState = { ...move(createState(stage), 'right').state, carrying: true }
    const { state } = move(entered, 'right')

    expect(state.leaningLadders).toEqual([])
    expect(state.carrying).toBe(true)
    expect(state.struggles).toBe(1)
  })

  it('버둥거리는 수에도 발판이 한 칸 간다', () => {
    const { state, events } = play(SWAMP_TRAM_STAGE, ['right', 'right'])

    expect(state.player).toEqual({ x: 1, y: 2 })
    expect(state.trams).toEqual([{ id: 'tram-a', at: 2, dir: 1 }])
    expect(events).toEqual([
      { type: 'struggled', at: { x: 1, y: 2 } },
      { type: 'tram', id: 'tram-a', from: { x: 2, y: 1 }, to: { x: 3, y: 1 } },
    ])
  })

  it('버둥거리는 수도 이동 제한을 쓴다', () => {
    const stage: Stage = { ...SWAMP_STAGE, rules: { moveLimit: 2 } }
    const used = play(stage, ['right', 'right'])
    const { state, events } = move(used.state, 'right')

    expect(used.state.moves).toBe(2)
    expect(used.state.struggles).toBe(1)
    expect(state).toBe(used.state)
    expect(events).toContainEqual({ type: 'limit', limit: 'moves' })
  })

  it('버둥거리는 수는 방향 제한에 세지 않고 나가는 수만 센다', () => {
    const stage: Stage = { ...SWAMP_STAGE, rules: { dirLimit: { dir: 'right', count: 2 } } }
    const struggled = play(stage, ['right', 'right', 'right'])
    const out = move(struggled.state, 'right')

    expect(struggled.state.dirUses).toBe(1)
    expect(out.state.player).toEqual({ x: 2, y: 1 })
    expect(out.state.dirUses).toBe(2)
  })

  it('제한한 방향을 다 써도 버둥거리는 수는 막지 않는다', () => {
    const stage: Stage = { ...SWAMP_STAGE, rules: { dirLimit: { dir: 'right', count: 1 } } }
    const { state, events } = play(stage, ['right', 'right'])

    expect(state.moves).toBe(2)
    expect(state.struggles).toBe(1)
    expect(state.dirUses).toBe(1)
    expect(events).toEqual([{ type: 'struggled', at: { x: 1, y: 1 } }])
  })

  it('늪에 밀어 넣은 상자는 가라앉고 그 칸은 보통 땅이 된다', () => {
    const stage: Stage = {
      ...SWAMP_STAGE,
      swamp: ['.....', '..#..', '.....'],
      entities: [{ type: 'box', x: 1, y: 1 }],
    }
    const { state, events } = move(createState(stage), 'right')

    expect(state.boxes).toEqual([])
    expect(state.swamps).toEqual([])
    expect(state.heights).toEqual(stage.heights)
    expect(state.player).toEqual({ x: 1, y: 1 })
    expect(state.pushes).toBe(1)
    expect(events).toContainEqual({ type: 'sank', at: { x: 2, y: 1 } })
  })

  it('가라앉은 칸에서는 갇히지 않는다', () => {
    const stage: Stage = {
      ...SWAMP_STAGE,
      swamp: ['.....', '..#..', '.....'],
      entities: [{ type: 'box', x: 1, y: 1 }],
    }
    const { state } = play(stage, ['right', 'right', 'right'])

    expect(state.player).toEqual({ x: 3, y: 1 })
    expect(state.moves).toBe(3)
    expect(state.struggles).toBe(0)
  })

  it('얼음을 타고 미끄러져 닿은 상자도 가라앉는다', () => {
    const stage: Stage = {
      ...SWAMP_STAGE,
      ice: ['.....', '..#..', '.....'],
      swamp: ['.....', '...#.', '.....'],
      entities: [{ type: 'box', x: 1, y: 1 }],
    }
    const { state, events } = move(createState(stage), 'right')

    expect(state.boxes).toEqual([])
    expect(state.swamps).toEqual([])
    expect(events).toContainEqual({ type: 'sank', at: { x: 3, y: 1 } })
  })
})

const DEEP_SWAMP_STAGE: Stage = {
  version: 1,
  id: 'test-swamp-deepen',
  name: '깊어지는 늪 테스트',
  heights: [
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
  ],
  start: { x: 0, y: 1 },
  goal: { x: 4, y: 0 },
  entities: [],
  swamp: ['.....', '.#.#.', '.....'],
  rules: { swampDeepen: true },
}

describe('move 깊어지는 늪', () => {
  it('걸어서 늪에 들어가면 빠진 횟수가 는다', () => {
    const { state } = move(createState(DEEP_SWAMP_STAGE), 'right')

    expect(state.player).toEqual({ x: 1, y: 1 })
    expect(state.sinks).toBe(1)
  })

  it('버둥거리는 수는 빠진 횟수를 세지 않는다', () => {
    const { state } = play(DEEP_SWAMP_STAGE, ['right', 'right', 'right'])

    expect(state.struggles).toBe(2)
    expect(state.sinks).toBe(1)
  })

  it('늪에서 나가는 수는 빠진 횟수를 세지 않는다', () => {
    const { state } = play(DEEP_SWAMP_STAGE, ['right', 'right', 'right', 'right'])

    expect(state.player).toEqual({ x: 2, y: 1 })
    expect(state.sinks).toBe(1)
  })

  it('두 번째 늪은 버둥이 한 수 더 든다', () => {
    const entered = play(DEEP_SWAMP_STAGE, ['right', 'right', 'right', 'right', 'right'])
    const struggled = play(DEEP_SWAMP_STAGE, Array<Direction>(8).fill('right'))
    const out = move(struggled.state, 'right')

    expect(entered.state.player).toEqual({ x: 3, y: 1 })
    expect(entered.state.sinks).toBe(2)
    expect(struggled.state.player).toEqual({ x: 3, y: 1 })
    expect(struggled.state.struggles).toBe(3)
    expect(out.state.player).toEqual({ x: 4, y: 1 })
    expect(out.state.moves).toBe(9)
  })

  it('같은 늪에 다시 들어가도 센다', () => {
    const back = play(DEEP_SWAMP_STAGE, ['right', 'right', 'right', 'right', 'left'])
    const struggled = play(DEEP_SWAMP_STAGE, [
      'right',
      'right',
      'right',
      'right',
      'left',
      'up',
      'up',
    ])

    expect(back.state.player).toEqual({ x: 1, y: 1 })
    expect(back.state.sinks).toBe(2)
    expect(struggled.state.player).toEqual({ x: 1, y: 1 })
    expect(struggled.state.struggles).toBe(2)
  })

  it('떨어져서 늪에 착지해도 센다', () => {
    const stage: Stage = {
      ...DEEP_SWAMP_STAGE,
      heights: [
        [0, 0, 0, 0, 0],
        [1, 0, 0, 0, 0],
        [0, 0, 0, 0, 0],
      ],
    }
    const { state, events } = move(createState(stage), 'right')

    expect(state.sinks).toBe(1)
    expect(events).toContainEqual({
      type: 'fell',
      from: { x: 0, y: 1 },
      to: { x: 1, y: 1 },
      drop: 1,
    })
  })

  it('상자가 늪에 가라앉은 것은 세지 않는다', () => {
    const stage: Stage = {
      ...DEEP_SWAMP_STAGE,
      swamp: ['.....', '..#..', '.....'],
      entities: [{ type: 'box', x: 1, y: 1 }],
    }
    const { state, events } = move(createState(stage), 'right')

    expect(state.player).toEqual({ x: 1, y: 1 })
    expect(state.sinks).toBe(0)
    expect(events).toContainEqual({ type: 'sank', at: { x: 2, y: 1 } })
  })

  it('깊어짐을 켜지 않은 판은 버둥이 언제나 두 수다', () => {
    const stage: Stage = { ...DEEP_SWAMP_STAGE, rules: undefined }
    const struggled = play(stage, Array<Direction>(7).fill('right'))
    const out = move(struggled.state, 'right')

    expect(struggled.state.player).toEqual({ x: 3, y: 1 })
    expect(struggled.state.sinks).toBe(2)
    expect(struggled.state.struggles).toBe(2)
    expect(out.state.player).toEqual({ x: 4, y: 1 })
    expect(out.state.moves).toBe(8)
  })

  it('다음에 빠질 늪 칸에 드는 총 수를 알려준다', () => {
    const start = createState(DEEP_SWAMP_STAGE)

    expect(nextSwampCost(start)).toBe(4)
    expect(nextSwampCost(move(start, 'right').state)).toBe(5)
    expect(nextSwampCost(createState({ ...DEEP_SWAMP_STAGE, rules: undefined }))).toBeNull()
  })
})
