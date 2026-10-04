import { describe, expect, it } from 'vitest'

import type { Direction, Entity, Stage } from '../types'
import { move } from './moveRule'
import { createState } from './stateRule'
import { play } from './testStages'

// 물 높이 1, x 1~5와 y 2~4가 물 칸, (1,2) 소용돌이가 끄는 오른쪽 줄 (2~5,2)과 아래 줄 (1,3~4)
const WHIRL_STAGE: Stage = {
  version: 1,
  id: 'test-whirlpool',
  name: '소용돌이 테스트',
  heights: [
    [1, 1, 1, 1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1, 1, 1, 1],
    [1, 0, 0, 0, 0, 0, 1, 1],
    [1, 0, 0, 0, 0, 0, 1, 1],
    [1, 0, 0, 0, 0, 0, 1, 1],
    [1, 1, 1, 1, 1, 1, 1, 1],
  ],
  water: 1,
  start: { x: 7, y: 0 },
  goal: { x: 7, y: 5 },
  entities: [{ type: 'whirlpool', x: 1, y: 2 }],
}

const withEntities = (entities: Entity[], rest?: Partial<Stage>): Stage => ({
  ...WHIRL_STAGE,
  ...rest,
  entities: [...WHIRL_STAGE.entities, ...entities],
})

const boat = (x: number, y: number): Entity => ({ type: 'box', x, y })

// 땅 위에서 제자리로 돌아오는 두 수
const PACE: Direction[] = ['left', 'right']

describe('move 소용돌이', () => {
  it('같은 줄의 먼 배를 매 수 한 칸씩 끌어 소용돌이 바로 앞에서 멈춘다', () => {
    const stage = withEntities([boat(5, 2)])
    const first = play(stage, ['left'])

    expect(first.state.boxes).toEqual([{ x: 4, y: 2 }])
    expect(first.events).toContainEqual({
      type: 'pulled',
      from: { x: 5, y: 2 },
      to: { x: 4, y: 2 },
    })

    const rest = play(stage, [...PACE, ...PACE, 'left'])
    expect(rest.state.boxes).toEqual([{ x: 2, y: 2 }])
    expect(rest.events.some((e) => e.type === 'pulled')).toBe(false)
  })

  it('세로줄의 배도 끌고 줄은 땅에서 끝난다', () => {
    const stage = withEntities([boat(1, 4)])

    expect(play(stage, ['left']).state.boxes).toEqual([{ x: 1, y: 3 }])
    expect(play(stage, PACE).state.boxes).toEqual([{ x: 1, y: 3 }])
  })

  it('사이에 땅이 있으면 그 너머 배는 안 끌린다', () => {
    const heights = WHIRL_STAGE.heights.map((row, y) =>
      y === 2 ? row.map((h, x) => (x === 3 ? 1 : h)) : row,
    )
    const { state, events } = play(withEntities([boat(5, 2)], { heights }), ['left'])

    expect(state.boxes).toEqual([{ x: 5, y: 2 }])
    expect(events.some((e) => e.type === 'pulled')).toBe(false)
  })

  it('대각선 배는 안 끌린다', () => {
    const { state } = play(withEntities([boat(2, 3)]), ['left'])

    expect(state.boxes).toEqual([{ x: 2, y: 3 }])
  })

  it('큐브가 탄 배는 안 끌린다', () => {
    const stage = withEntities([boat(3, 2)], { start: { x: 3, y: 1 } })
    const { state, events } = play(stage, ['down'])

    expect(state.player).toEqual({ x: 3, y: 2 })
    expect(state.boxes).toEqual([{ x: 3, y: 2 }])
    expect(events.some((e) => e.type === 'pulled')).toBe(false)
  })

  it('탄 배가 줄에 있으면 뒤 배는 그 뒤에서 멈춘다', () => {
    const stage = withEntities([boat(3, 2), boat(4, 2)], { start: { x: 3, y: 1 } })
    const { state } = play(stage, ['down'])

    expect(state.boxes).toEqual([
      { x: 3, y: 2 },
      { x: 4, y: 2 },
    ])
  })

  it('붙어 있는 두 배는 같은 수에 같이 한 칸 간다', () => {
    const { state, events } = play(withEntities([boat(5, 2), boat(4, 2)]), ['left'])

    expect(state.boxes).toEqual([
      { x: 4, y: 2 },
      { x: 3, y: 2 },
    ])
    expect(events.filter((e) => e.type === 'pulled')).toEqual([
      { type: 'pulled', from: { x: 4, y: 2 }, to: { x: 3, y: 2 } },
      { type: 'pulled', from: { x: 5, y: 2 }, to: { x: 4, y: 2 } },
    ])
  })

  it('큐브가 내린 배는 내린 수 끝에 바로 끌린다', () => {
    const stage = withEntities([boat(3, 2)], { start: { x: 3, y: 1 } })
    const { state, events } = play(stage, ['down', 'up'])

    expect(state.player).toEqual({ x: 3, y: 1 })
    expect(state.boxes).toEqual([{ x: 2, y: 2 }])
    expect(events).toEqual([
      { type: 'moved', from: { x: 3, y: 2 }, to: { x: 3, y: 1 } },
      { type: 'pulled', from: { x: 3, y: 2 }, to: { x: 2, y: 2 } },
    ])
  })

  it('땅 상자를 물에 밀어 띄운 수 끝에 바로 끌린다', () => {
    const stage = withEntities([boat(6, 2)], { start: { x: 7, y: 2 } })
    const { state, events } = play(stage, ['left'])

    expect(state.boxes).toEqual([{ x: 4, y: 2 }])
    expect(events).toEqual([
      { type: 'pushed', from: { x: 6, y: 2 }, to: { x: 5, y: 2 }, result: 'floated' },
      { type: 'moved', from: { x: 7, y: 2 }, to: { x: 6, y: 2 } },
      { type: 'pulled', from: { x: 5, y: 2 }, to: { x: 4, y: 2 } },
    ])
  })

  it('막힌 이동에서는 끌지 않는다', () => {
    const at = createState(withEntities([boat(5, 2)]))
    const { state, events } = move(at, 'up')

    expect(state).toBe(at)
    expect(events).toEqual([{ type: 'blocked', direction: 'up' }])
  })

  it('배로 소용돌이 칸에 저어 들어가면 막힌다', () => {
    const stage = withEntities([boat(2, 2)], { start: { x: 2, y: 1 } })
    const aboard = play(stage, ['down']).state
    const { state, events } = move(aboard, 'left')

    expect(state).toBe(aboard)
    expect(events).toEqual([{ type: 'blocked', direction: 'left' }])
  })

  it('마개가 없는 판에서 땅 상자를 소용돌이 쪽으로 밀면 큐브가 상자 위로 올라선다', () => {
    const high = WHIRL_STAGE.heights.map((row, y) =>
      y < 2 ? row.map((h, x) => (x === 1 ? 2 : h)) : row,
    )

    for (const heights of [WHIRL_STAGE.heights, high]) {
      const stage = withEntities([{ type: 'box', x: 1, y: 1 }], { heights, start: { x: 1, y: 0 } })
      const { state, events } = play(stage, ['down'])

      expect(state.player).toEqual({ x: 1, y: 1 })
      expect(state.boxes).toEqual([{ x: 1, y: 1 }])
      expect(state.plugged).toEqual([])
      expect(events[0]).toEqual({
        type: 'climbed',
        from: { x: 1, y: 0 },
        to: { x: 1, y: 1 },
        via: 'box',
      })
    }
  })
})

describe('move 마개', () => {
  // (1,1) 땅 상자를 위에서 밀어 넣는 자리, (2,2) 앞 칸 배와 (5,2) 먼 배
  const PLUG_STAGE = withEntities([{ type: 'box', x: 1, y: 1 }, boat(2, 2), boat(5, 2)], {
    start: { x: 1, y: 0 },
    rules: { plug: true },
  })

  it('땅 상자를 소용돌이로 밀면 상자가 사라지고 소용돌이가 막힌다', () => {
    const { state, events } = play(PLUG_STAGE, ['down'])

    expect(state.player).toEqual({ x: 1, y: 1 })
    expect(state.plugged).toEqual([{ x: 1, y: 2 }])
    expect(state.boxes).toEqual([
      { x: 2, y: 2 },
      { x: 5, y: 2 },
    ])
    expect(state.pushes).toBe(1)
    expect(events).toEqual([
      { type: 'pushed', from: { x: 1, y: 1 }, to: { x: 1, y: 2 }, result: 'floated' },
      { type: 'plugged', at: { x: 1, y: 2 } },
      { type: 'moved', from: { x: 1, y: 0 }, to: { x: 1, y: 1 } },
    ])
  })

  it('막힌 소용돌이는 더 끌지 않고 배가 그 칸으로 저어 간다', () => {
    const { state } = play(PLUG_STAGE, ['down', 'right', 'down', 'left'])

    expect(state.player).toEqual({ x: 1, y: 2 })
    expect(state.boxes).toEqual([
      { x: 1, y: 2 },
      { x: 5, y: 2 },
    ])
  })

  it('끌려온 뜬 상자는 앞 칸에서 멈출 뿐 마개가 되지 않는다', () => {
    const stage = withEntities([boat(4, 2)], { rules: { plug: true } })
    const { state } = play(stage, [...PACE, ...PACE])

    expect(state.boxes).toEqual([{ x: 2, y: 2 }])
    expect(state.plugged).toEqual([])
  })
})
