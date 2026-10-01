import { describe, expect, it } from 'vitest'

import type { Stage } from '../types'
import { move } from './moveRule'
import { createState } from './stateRule'
import { LADDER_STAGE, play } from './testStages'

describe('move 사다리', () => {
  it('바닥의 사다리 칸으로 이동하면 사다리를 줍는다', () => {
    const { state, events } = move(createState(LADDER_STAGE), 'right')

    expect(state.carrying).toBe('ladder')
    expect(state.ladders).toEqual([])
    expect(state.moves).toBe(1)
    expect(events).toEqual([
      { type: 'moved', from: { x: 0, y: 1 }, to: { x: 1, y: 1 } },
      { type: 'pickedUp', at: { x: 1, y: 1 }, item: 'ladder' },
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
    expect(state.carrying).toBeNull()
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
    expect(state.carrying).toBe('ladder')
    expect(state.leaningLadders).toEqual([])
    expect(events).toEqual([
      { type: 'fell', from: { x: 3, y: 1 }, to: { x: 2, y: 1 }, drop: 1 },
      { type: 'pickedUp', at: { x: 2, y: 1 }, item: 'ladder' },
    ])
  })

  it('사다리가 없는 곳으로 내려오면 사다리는 제자리에 남는다', () => {
    const { state } = play(LADDER_STAGE, ['right', 'right', 'right', 'right', 'up', 'left'])

    expect(state.player).toEqual({ x: 2, y: 0 })
    expect(state.carrying).toBeNull()
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

    expect(state.carrying).toBe('ladder')
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
