import { describe, expect, it } from 'vitest'

import {
  createState,
  isDoorOpen,
  isLiftRaised,
  move,
  movesLeft,
  pushesLeft,
  standHeight,
} from './rules'
import type { Direction, GameState, MoveResult, Point, Stage } from './types'

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
    expect(events).toEqual([{ type: 'blocked', direction: 'up' }])
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
})
