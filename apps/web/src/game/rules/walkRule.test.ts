import { describe, expect, it } from 'vitest'

import type { Stage } from '../types'
import { createState } from './stateRule'
import { FLAT_STAGE, LADDER_STAGE, WARP_STAGE } from './testStages'
import { arrive, walk } from './walkRule'

describe('walk', () => {
  it('같은 높이 칸으로 걸으면 이동 한 번으로 센다', () => {
    const { state, events } = walk(createState(FLAT_STAGE), { x: 2, y: 1 }, 0, 'right')

    expect(state.player).toEqual({ x: 2, y: 1 })
    expect(state.moves).toBe(1)
    expect(events).toEqual([{ type: 'moved', from: { x: 1, y: 1 }, to: { x: 2, y: 1 } }])
  })

  it('낮은 칸으로 걸으면 높이 차만큼 떨어진다', () => {
    const stage: Stage = {
      ...FLAT_STAGE,
      heights: [
        [0, 0, 0],
        [0, 1, 0],
        [0, 0, 0],
      ],
    }
    const { events } = walk(createState(stage), { x: 2, y: 1 }, 0, 'right')

    expect(events).toEqual([{ type: 'fell', from: { x: 1, y: 1 }, to: { x: 2, y: 1 }, drop: 1 }])
  })

  it('앞서 받은 이벤트를 걷기 앞에 둔다', () => {
    const { events } = walk(createState(FLAT_STAGE), { x: 2, y: 1 }, 0, 'right', [
      { type: 'limit', limit: 'pushes' },
    ])

    expect(events[0]).toEqual({ type: 'limit', limit: 'pushes' })
    expect(events[1]).toEqual({ type: 'moved', from: { x: 1, y: 1 }, to: { x: 2, y: 1 } })
  })
})

describe('arrive', () => {
  it('구멍에 닿으면 클리어된다', () => {
    const state = { ...createState(FLAT_STAGE), player: { x: 2, y: 1 } }
    const result = arrive(state, { x: 2, y: 0 }, 'up', {
      type: 'moved',
      from: { x: 2, y: 1 },
      to: { x: 2, y: 0 },
    })

    expect(result.state.cleared).toBe(true)
  })

  it('빈손으로 사다리 칸에 닿으면 사다리를 줍는다', () => {
    const { state, events } = arrive(createState(LADDER_STAGE), { x: 1, y: 1 }, 'right', {
      type: 'moved',
      from: { x: 0, y: 1 },
      to: { x: 1, y: 1 },
    })

    expect(state.carrying).toBe('ladder')
    expect(state.ladders).toEqual([])
    expect(events).toContainEqual({ type: 'pickedUp', at: { x: 1, y: 1 }, item: 'ladder' })
  })

  it('짝 칸에 닿으면 나머지 칸으로 나온다', () => {
    const { state, events } = arrive(createState(WARP_STAGE), { x: 1, y: 1 }, 'right', {
      type: 'moved',
      from: { x: 0, y: 1 },
      to: { x: 1, y: 1 },
    })

    expect(state.player).toEqual({ x: 4, y: 1 })
    expect(events).toContainEqual({ type: 'warped', from: { x: 1, y: 1 }, to: { x: 4, y: 1 } })
  })
})
