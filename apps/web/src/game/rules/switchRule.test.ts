import { describe, expect, it } from 'vitest'

import type { Stage } from '../types'
import { move } from './moveRule'
import { createState, standHeight } from './stateRule'
import { isDoorOpen, isLiftRaised } from './switchRule'
import { LIFT_STAGE, play } from './testStages'

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
