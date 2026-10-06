import { describe, expect, it } from 'vitest'

import type { GameState, Stage } from '../types'
import { isWater } from './cellRule'
import { move } from './moveRule'
import { floodsPlayer, isFloodable, waterLevel } from './sluiceRule'
import { createState, standHeight } from './stateRule'
import { play } from './testStages'

// 물 높이 1, (2,1)과 (3,1)이 잠기는 줄, (4,1)은 늘 물, (0,2) 수위 장치
const SLUICE_STAGE: Stage = {
  version: 1,
  id: 'test-sluice',
  heights: [
    [2, 2, 2, 2, 2, 2],
    [2, 2, 1, 1, 0, 2],
    [2, 2, 2, 2, 2, 2],
  ],
  water: 1,
  start: { x: 2, y: 2 },
  goal: { x: 5, y: 0 },
  entities: [
    { type: 'sluice', x: 0, y: 2 },
    { type: 'box', x: 1, y: 2 },
  ],
}

const ROW = [
  { x: 2, y: 1 },
  { x: 3, y: 1 },
]

// 큐브가 (1,2)에서 바로 왼쪽 장치로 오르내리는 판
const stepOn = (rest: Partial<Stage> = {}): Stage => ({
  ...SLUICE_STAGE,
  start: { x: 1, y: 2 },
  entities: [{ type: 'sluice', x: 0, y: 2 }],
  ...rest,
})

// 물 높이 1, 가 웅덩이 (1,1)과 (2,1), 나 웅덩이 (4,1)과 (5,1), 사이 (3,1)이 수위 장치
const LOCK_STAGE: Stage = {
  version: 1,
  id: 'test-lock',
  heights: [
    [2, 2, 2, 2, 2, 2, 2],
    [2, 0, 1, 2, 1, 0, 2],
    [2, 2, 2, 2, 2, 2, 2],
  ],
  water: 1,
  start: { x: 3, y: 0 },
  goal: { x: 6, y: 0 },
  entities: [{ type: 'sluice', x: 3, y: 1 }],
  rules: { lock: { x: 1, y: 1 } },
}

const pressed = (state: GameState): GameState => ({
  ...state,
  boxes: [...state.boxes, { x: 0, y: 2 }],
})

describe('waterLevel', () => {
  it('장치가 비면 판의 물 높이 그대로', () => {
    const state = createState(SLUICE_STAGE)

    expect(waterLevel(state, { x: 2, y: 1 })).toBe(1)
    expect(isWater(state, { x: 2, y: 1 })).toBe(false)
  })

  it('장치에 상자가 있으면 한 층 높은 물', () => {
    const state = pressed(createState(stepOn()))

    expect(waterLevel(state, { x: 2, y: 1 })).toBe(2)
    expect(ROW.every((p) => isWater(state, p))).toBe(true)
  })

  it('장치가 없는 판은 판의 물 높이 그대로', () => {
    const state = createState({ ...SLUICE_STAGE, entities: [{ type: 'box', x: 0, y: 2 }] })

    expect(waterLevel(state, { x: 2, y: 1 })).toBe(1)
  })

  it('갑문은 장치가 비면 가 웅덩이, 눌리면 나 웅덩이가 높음', () => {
    const state = createState(LOCK_STAGE)
    const on = { ...state, player: { x: 3, y: 1 } }

    expect(waterLevel(state, { x: 2, y: 1 })).toBe(2)
    expect(waterLevel(state, { x: 4, y: 1 })).toBe(1)
    expect(waterLevel(on, { x: 2, y: 1 })).toBe(1)
    expect(waterLevel(on, { x: 4, y: 1 })).toBe(2)
  })
})

describe('isFloodable', () => {
  it('장치가 있는 판에서 물 높이와 같은 땅만 잠기는 칸', () => {
    expect(isFloodable(SLUICE_STAGE, { x: 2, y: 1 })).toBe(true)
    expect(isFloodable(SLUICE_STAGE, { x: 4, y: 1 })).toBe(false)
    expect(isFloodable(SLUICE_STAGE, { x: 1, y: 1 })).toBe(false)
    expect(isFloodable({ ...SLUICE_STAGE, entities: [] }, { x: 2, y: 1 })).toBe(false)
  })
})

describe('move 수위', () => {
  it('상자를 장치에 밀어 올리면 물이 오르고 잠긴 칸을 알림', () => {
    const { state, events } = move(createState(SLUICE_STAGE), 'left')

    expect(ROW.every((p) => isWater(state, p))).toBe(true)
    expect(events).toContainEqual({ type: 'sluice', up: true, cells: ROW })
  })

  it('큐브가 장치에서 내려오면 물이 빠짐', () => {
    const { state, events } = play(stepOn(), ['left', 'right'])

    expect(isWater(state, { x: 2, y: 1 })).toBe(false)
    expect(events).toContainEqual({ type: 'sluice', up: false, cells: ROW })
  })

  it('물이 그대로인 수에는 알림 없음', () => {
    const { events } = move(createState(stepOn()), 'up')

    expect(events.some((e) => e.type === 'sluice')).toBe(false)
  })

  it('장치가 여럿이면 하나라도 눌린 동안 높은 물', () => {
    const stage = stepOn({
      entities: [
        { type: 'sluice', x: 0, y: 2 },
        { type: 'sluice', x: 0, y: 0 },
        { type: 'box', x: 0, y: 0 },
      ],
    })
    const { state, events } = play(stage, ['left', 'right'])

    expect(isWater(state, { x: 2, y: 1 })).toBe(true)
    expect(events.some((e) => e.type === 'sluice')).toBe(false)
  })

  it('잠기는 줄의 땅 상자는 물이 오르면 같은 높이의 배', () => {
    const stage = stepOn({
      entities: [
        { type: 'sluice', x: 0, y: 2 },
        { type: 'box', x: 2, y: 1 },
      ],
    })
    const before = createState(stage)
    const { state } = move(before, 'left')

    expect(isWater(state, { x: 2, y: 1 })).toBe(true)
    expect(standHeight(state, { x: 2, y: 1 })).toBe(standHeight(before, { x: 2, y: 1 }))
  })

  it('물이 빠지면 배를 탄 큐브는 내려앉은 땅 상자 위', () => {
    const stage: Stage = {
      ...SLUICE_STAGE,
      heights: [
        [2, 2, 2],
        [2, 1, 2],
      ],
      start: { x: 0, y: 0 },
      goal: { x: 2, y: 0 },
      entities: [
        { type: 'sluice', x: 0, y: 1 },
        { type: 'box', x: 1, y: 1 },
      ],
    }
    const { state, events } = play(stage, ['down', 'right'])

    expect(state.player).toEqual({ x: 1, y: 1 })
    expect(isWater(state, state.player)).toBe(false)
    expect(standHeight(state, state.player)).toBe(2)
    expect(events).toContainEqual({ type: 'sluice', up: false, cells: [{ x: 1, y: 1 }] })
  })

  it('떠 있던 배와 그 위 큐브는 물이 오르면 한 층 위', () => {
    const riding = createState({ ...stepOn(), start: { x: 4, y: 1 } })
    const boat: GameState = { ...riding, boxes: [{ x: 4, y: 1 }] }

    expect(standHeight(boat, boat.player)).toBe(1)
    expect(standHeight(pressed(boat), boat.player)).toBe(2)
  })

  it('장치에서 배로 내려서면 물이 빠지며 배와 함께 한 층 아래', () => {
    const stage = stepOn({
      heights: [
        [2, 2, 2, 2, 2, 2],
        [0, 2, 1, 1, 0, 2],
        [2, 2, 2, 2, 2, 2],
      ],
      entities: [
        { type: 'sluice', x: 0, y: 2 },
        { type: 'box', x: 0, y: 1 },
      ],
    })
    const { state, events } = play(stage, ['left', 'up'])

    expect(state.player).toEqual({ x: 0, y: 1 })
    expect(standHeight(state, state.player)).toBe(1)
    expect(events).toContainEqual({ type: 'sluice', up: false, cells: ROW })
  })

  it('물이 높으면 잠기는 줄의 집에 못 들어감', () => {
    const stage: Stage = {
      ...SLUICE_STAGE,
      goal: { x: 1, y: 1 },
      heights: [
        [2, 2, 2, 2, 2, 2],
        [2, 1, 1, 1, 0, 2],
        [2, 2, 2, 2, 2, 2],
      ],
    }
    const { state, events } = play(stage, ['left', 'up'])

    expect(state.cleared).toBe(false)
    expect(events).toEqual([{ type: 'blocked', direction: 'up' }])
  })

  it('물이 오른 수에 떠오른 배는 같은 수에 소용돌이에 끌림', () => {
    const stage = stepOn({
      entities: [
        { type: 'sluice', x: 0, y: 2 },
        { type: 'box', x: 2, y: 1 },
        { type: 'whirlpool', x: 4, y: 1 },
      ],
    })
    const { state, events } = move(createState(stage), 'left')

    expect(state.boxes).toEqual([{ x: 3, y: 1 }])
    expect(events).toContainEqual({ type: 'pulled', from: { x: 2, y: 1 }, to: { x: 3, y: 1 } })
  })

  it('물이 빠지면 끄는 줄이 끊겨 땅 상자는 안 끌림', () => {
    const stage = stepOn({
      entities: [
        { type: 'sluice', x: 0, y: 2 },
        { type: 'box', x: 2, y: 1 },
        { type: 'whirlpool', x: 4, y: 1 },
      ],
    })
    const { state } = move(createState(stage), 'up')

    expect(state.boxes).toEqual([{ x: 2, y: 1 }])
  })

  it('새로 잠긴 칸도 얼음 돌 둘레면 얼고 드러나면 녹음', () => {
    const stage = stepOn({
      entities: [
        { type: 'sluice', x: 0, y: 2 },
        { type: 'iceStone', x: 2, y: 0 },
      ],
    })
    const up = move(createState(stage), 'left')
    const down = move(up.state, 'right')

    expect(up.events).toContainEqual({ type: 'froze', cells: [{ x: 2, y: 1 }] })
    expect(down.events).toContainEqual({ type: 'thawed', cells: [{ x: 2, y: 1 }] })
  })

  it('잠기는 줄의 땅 돌은 물이 오르면 뜬 돌', () => {
    const stage = stepOn({
      entities: [
        { type: 'sluice', x: 0, y: 2 },
        { type: 'iceStone', x: 3, y: 1 },
      ],
    })
    const { state } = move(createState(stage), 'left')

    expect(isWater(state, { x: 3, y: 1 })).toBe(true)
    expect(state.stones).toEqual([{ x: 3, y: 1 }])
  })

  it('잠기는 줄 칸에서는 사다리 놓기 불가', () => {
    const stage: Stage = {
      ...SLUICE_STAGE,
      heights: [
        [2, 2, 2, 2, 2, 2],
        [2, 2, 1, 2, 0, 2],
        [2, 2, 2, 2, 2, 2],
      ],
      start: { x: 2, y: 1 },
      entities: [{ type: 'sluice', x: 0, y: 2 }],
    }
    const holding: GameState = { ...createState(stage), carrying: 'ladder' }
    const { state, events } = move(holding, 'right')

    expect(state.leaningLadders).toEqual([])
    expect(events).toEqual([{ type: 'blocked', direction: 'right' }])
  })
})

describe('move 갑문', () => {
  it('장치를 누르면 가 웅덩이가 빠지고 나 웅덩이가 오름', () => {
    const { state, events } = move(createState(LOCK_STAGE), 'down')

    expect(isWater(state, { x: 2, y: 1 })).toBe(false)
    expect(isWater(state, { x: 4, y: 1 })).toBe(true)
    expect(events).toContainEqual({ type: 'sluice', up: false, pool: 0, cells: [{ x: 2, y: 1 }] })
    expect(events).toContainEqual({ type: 'sluice', up: true, pool: 1, cells: [{ x: 4, y: 1 }] })
  })

  it('가 웅덩이 배가 내려앉는 수에 나 웅덩이 배는 떠오름', () => {
    const stage: Stage = {
      ...LOCK_STAGE,
      entities: [
        { type: 'sluice', x: 3, y: 1 },
        { type: 'box', x: 2, y: 1 },
        { type: 'box', x: 4, y: 1 },
      ],
    }
    const { state } = move(createState(stage), 'down')

    expect(isWater(state, { x: 2, y: 1 })).toBe(false)
    expect(isWater(state, { x: 4, y: 1 })).toBe(true)
    expect(state.boxes).toEqual([
      { x: 2, y: 1 },
      { x: 4, y: 1 },
    ])
  })

  it('장치를 떠나 가 웅덩이의 드러난 칸으로 내려서는 수는 잠김 막힘', () => {
    const on = move(createState(LOCK_STAGE), 'down').state
    const { state, events } = move(on, 'left')

    expect(state).toBe(on)
    expect(events).toEqual([{ type: 'blocked', direction: 'left', flooded: true }])
  })
})

describe('floodsPlayer', () => {
  it('이동 전 물이 아니던 큐브 칸이 물이 되면 참', () => {
    const before = createState({ ...SLUICE_STAGE, start: { x: 2, y: 1 } })

    expect(floodsPlayer(before, pressed(before))).toBe(true)
  })

  it('큐브 칸에 상자가 있으면 배가 되어 거짓', () => {
    const before = {
      ...createState({ ...SLUICE_STAGE, start: { x: 2, y: 1 } }),
      boxes: [{ x: 2, y: 1 }],
    }

    expect(floodsPlayer(before, pressed(before))).toBe(false)
  })

  it('원래 물인 칸은 거짓', () => {
    const before = { ...createState({ ...SLUICE_STAGE, start: { x: 4, y: 1 } }), boxes: [] }

    expect(floodsPlayer(before, pressed(before))).toBe(false)
  })
})
