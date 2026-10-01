import { describe, expect, it } from 'vitest'

import type { Stage } from '../types'
import { movesLeft } from './limitRule'
import { move } from './moveRule'
import { createState } from './stateRule'
import { WARP_STAGE, play } from './testStages'

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
