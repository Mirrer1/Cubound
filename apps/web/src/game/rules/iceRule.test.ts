import { describe, expect, it } from 'vitest'

import type { Stage } from '../types'
import { isIce } from './iceRule'
import { move } from './moveRule'
import { createState } from './stateRule'
import { isDoorOpen } from './switchRule'
import { FLAT_STAGE, ICE_STAGE, play } from './testStages'

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

    expect(state.carrying).toBe('ladder')
    expect(state.ladders).toEqual([{ x: 2, y: 1 }])
    expect(events).toContainEqual({ type: 'pickedUp', at: { x: 4, y: 1 }, item: 'ladder' })
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

describe('isIce', () => {
  const state = createState({ ...FLAT_STAGE, ice: ['.#.', '...', '..#'] })

  it("ice에서 '#'인 칸만 얼음이다", () => {
    expect(isIce(state, { x: 1, y: 0 })).toBe(true)
    expect(isIce(state, { x: 2, y: 2 })).toBe(true)
    expect(isIce(state, { x: 0, y: 0 })).toBe(false)
  })

  it('맵 밖과 얼음이 없는 스테이지는 얼음이 아니다', () => {
    expect(isIce(state, { x: 5, y: 5 })).toBe(false)
    expect(isIce(createState(FLAT_STAGE), { x: 1, y: 0 })).toBe(false)
  })
})
