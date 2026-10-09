import { describe, expect, it } from 'vitest'

import type { Direction, GameEvent, Point, Stage } from '../types'
import { move } from './moveRule'
import { createState } from './stateRule'
import { TRAM_STAGE, WIND_STAGE, play } from './testStages'

// 한 줄 판, (1,0) 화로와 (5,0) 숯 벽
const LINE_STAGE: Stage = {
  version: 1,
  id: 'test-brazier',
  name: '화로 테스트',
  heights: [[0, 0, 0, 0, 0, 0, 0, 0, 0]],
  fire: ['.@...#...'],
  start: { x: 0, y: 0 },
  goal: { x: 8, y: 0 },
  entities: [],
}

const p = (x: number, y: number): Point => ({ x, y })

const line = (fire: string, rest: Partial<Stage> = {}): Stage => ({
  ...LINE_STAGE,
  fire: [fire],
  ...rest,
})

const rights = (n: number): Direction[] => Array.from({ length: n }, () => 'right')

const flamesOf = (stage: Stage, directions: Direction[]) =>
  directions.reduce<{ state: ReturnType<typeof createState>; left: number[] }>(
    ({ state, left }, d) => {
      const next = move(state, d).state
      return { state: next, left: [...left, next.flame] }
    },
    { state: createState(stage), left: [] },
  ).left

describe('createState 화로', () => {
  it('큐브 불 없이 시작하고 재 자국은 비어 있다', () => {
    const state = createState(LINE_STAGE)

    expect(state.flame).toBe(0)
    expect(state.charred).toEqual([])
  })
})

describe('move 화로', () => {
  it('화로를 밟은 수에 큐브에 불이 붙고 남은 수 4다', () => {
    const { state, events } = move(createState(LINE_STAGE), 'right')

    expect(state.flame).toBe(4)
    expect(events).toContainEqual({ type: 'ignited', at: p(1, 0), by: 'brazier' })
  })

  it('한 수마다 1씩 줄고 0이 되는 수에 꺼진다', () => {
    const stage = line('.@.......')
    const { events } = play(stage, rights(5))

    expect(flamesOf(stage, rights(6))).toEqual([4, 3, 2, 1, 0, 0])
    expect(events).toContainEqual({ type: 'doused', at: p(5, 0) })
  })

  it('화로를 밟고 4수째 미는 것까지 숯 벽에 불이 붙는다', () => {
    const { state, events } = play(LINE_STAGE, rights(5))

    expect(state.player).toEqual(p(4, 0))
    expect(state.moves).toBe(5)
    expect(state.burning).toEqual([p(5, 0)])
    expect(state.flame).toBe(0)
    expect(events).toContainEqual({ type: 'torched', from: p(4, 0), to: p(5, 0) })
    expect(events).toContainEqual({ type: 'doused', at: p(4, 0) })
  })

  it('한 칸 더 먼 숯 벽은 불이 꺼져 막힌다', () => {
    const stage = line('.@....#..')
    const { state, events } = play(stage, rights(6))

    expect(state.moves).toBe(5)
    expect(state.burning).toEqual([])
    expect(events).toEqual([{ type: 'blocked', direction: 'right' }])
  })

  it('불이 없는 큐브는 숯 벽에 막힌다', () => {
    const stage = line('.....#...', { start: p(4, 0) })

    expect(move(createState(stage), 'right').events).toEqual([
      { type: 'blocked', direction: 'right' },
    ])
  })

  it('막힌 이동은 수가 아니라 남은 수가 줄지 않는다', () => {
    const stage = line('.@.......', { heights: [[0, 0, 2, 0, 0, 0, 0, 0, 0]] })

    expect(play(stage, ['right', 'right']).state.flame).toBe(4)
  })

  it('붙인 벽은 다음 수에 재가 되며 맞닿은 숯으로 번진다', () => {
    const stage = line('.@##.....', { start: p(0, 0) })
    const { state, events } = play(stage, ['right', 'right', 'left'])

    expect(state.ashes).toEqual([p(2, 0)])
    expect(state.burning).toEqual([p(3, 0)])
    expect(events).toContainEqual({ type: 'caught', from: p(2, 0), to: p(3, 0) })
  })

  it('벽에 불을 옮겨도 큐브 불은 남아 다른 벽에도 붙인다', () => {
    const stage: Stage = {
      ...LINE_STAGE,
      heights: [
        [0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0],
      ],
      fire: ['.@.#..', '..#...'],
      goal: p(5, 1),
    }
    const { state, events } = play(stage, ['right', 'right', 'right', 'down'])

    expect(state.player).toEqual(p(2, 0))
    expect(state.ashes).toEqual([p(3, 0)])
    expect(state.burning).toEqual([p(2, 1)])
    expect(state.flame).toBe(1)
    expect(events).toContainEqual({ type: 'torched', from: p(2, 0), to: p(2, 1) })
  })

  it('불 붙은 채 화로를 다시 밟으면 4로 찬다', () => {
    const stage = line('.@.......')

    expect(flamesOf(stage, ['right', 'right', 'left'])).toEqual([4, 3, 4])
  })

  it('한 층 높은 숯 벽과 낮은 숯 벽에는 붙고 두 층 높은 숯 벽에는 막힌다', () => {
    const at = (h: number, rest: Partial<Stage> = {}) =>
      play(line('.@#......', { heights: [[0, 0, h, 0, 0, 0, 0, 0, 0]], ...rest }), [
        'right',
        'right',
      ]).events
    const torched: GameEvent = { type: 'torched', from: p(1, 0), to: p(2, 0) }

    expect(at(1)).toContainEqual(torched)
    expect(at(2)).toEqual([{ type: 'blocked', direction: 'right' }])
    const high = play(line('.@#......', { heights: [[1, 1, 0, 0, 0, 0, 0, 0, 0]] }), [
      'right',
      'right',
    ])
    expect(high.events).toContainEqual(torched)
  })

  it('옆을 지나가거나 숯 다리를 밟아서는 불이 안 붙는다', () => {
    const stage: Stage = {
      ...LINE_STAGE,
      heights: [
        [0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0],
      ],
      fire: ['.@==..', '...#..'],
      goal: p(5, 1),
    }
    const { state } = play(stage, ['right', 'right', 'right', 'right'])

    expect(state.player).toEqual(p(4, 0))
    expect(state.burning).toEqual([])
    expect(state.ashes).toEqual([])
  })

  it('번지던 불이 큐브가 선 숯 다리에 닿으면 큐브에 불이 붙는다', () => {
    const stage = line('..===....', { start: p(4, 0) })
    const { state, events } = move({ ...createState(stage), burning: [p(2, 0)] }, 'left')

    expect(state.player).toEqual(p(3, 0))
    expect(state.burning).toContainEqual(p(3, 0))
    expect(state.flame).toBe(4)
    expect(events).toContainEqual({ type: 'ignited', at: p(3, 0), by: 'fire' })
  })

  it('불씨 칸을 켠 큐브에는 불이 안 붙는다', () => {
    const { state, events } = move(createState(line('.*#......')), 'right')

    expect(state.burning).toEqual([p(2, 0)])
    expect(state.flame).toBe(0)
    expect(events).not.toContainEqual(expect.objectContaining({ type: 'ignited' }))
  })

  it('상자 위에 선 큐브는 화로를 안 쓴다', () => {
    const stage = line('.@.......', {
      heights: [[1, 0, 0, 0, 0, 0, 0, 0, 0]],
      entities: [{ type: 'box', x: 1, y: 0 }],
    })
    const { state } = move(createState(stage), 'right')

    expect(state.player).toEqual(p(1, 0))
    expect(state.flame).toBe(0)
  })

  it('화로 위에서 발판을 기다리는 수에도 4를 유지한다', () => {
    const stage: Stage = { ...TRAM_STAGE, fire: ['......', '....@.', '......'], start: p(4, 1) }
    const one = move(createState(stage), 'left')
    const two = move(one.state, 'left')

    expect(one.state.player).toEqual(p(4, 1))
    expect(one.events).toContainEqual({ type: 'ignited', at: p(4, 1), by: 'brazier' })
    expect(two.state.flame).toBe(4)
    expect(two.events).not.toContainEqual(expect.objectContaining({ type: 'ignited' }))
  })

  it('바람에 밀려 화로에 선 수에도 불이 붙는다', () => {
    const stage: Stage = { ...WIND_STAGE, fire: ['..@...', '......', '......'] }
    const { state, events } = play(stage, ['down', 'up', 'right', 'left'])

    expect(state.player).toEqual(p(2, 0))
    expect(state.flame).toBe(4)
    expect(events).toContainEqual({ type: 'ignited', at: p(2, 0), by: 'brazier' })
  })

  it('불 붙은 큐브가 민 상자는 보통처럼 밀린다', () => {
    const stage = line('.@.......', { entities: [{ type: 'box', x: 3, y: 0 }] })
    const { state } = play(stage, rights(3))

    expect(state.boxes).toEqual([p(4, 0)])
    expect(state.charred).toEqual([])
  })
})

describe('move 타는 짐', () => {
  const BURN_STAGE = line('.@.......', {
    entities: [{ type: 'box', x: 3, y: 0 }],
    rules: { burnBox: true },
  })

  it('불 붙은 큐브가 밀면 상자가 밀린 칸에서 재가 되어 사라진다', () => {
    const { state, events } = play(BURN_STAGE, rights(3))

    expect(state.boxes).toEqual([])
    expect(state.charred).toEqual([p(4, 0)])
    expect(state.player).toEqual(p(3, 0))
    expect(state.pushes).toBe(1)
    expect(state.flame).toBe(2)
    expect(events).toContainEqual({ type: 'boxBurned', at: p(4, 0) })
  })

  it('불이 꺼진 뒤 밀면 보통처럼 밀린다', () => {
    const stage = { ...BURN_STAGE, entities: [{ type: 'box' as const, x: 6, y: 0 }] }
    const { state } = play(stage, rights(6))

    expect(state.flame).toBe(0)
    expect(state.boxes).toEqual([p(7, 0)])
    expect(state.charred).toEqual([])
  })

  it('구덩이로 민 상자는 떨어진 칸에서 사라지고 구덩이는 그대로다', () => {
    const stage = { ...BURN_STAGE, heights: [[0, 0, 0, 0, -1, 0, 0, 0, 0]] }
    const { state, events } = play(stage, rights(3))

    expect(state.boxes).toEqual([])
    expect(state.heights[0][4]).toBe(-1)
    expect(state.charred).toEqual([p(4, 0)])
    expect(events).toContainEqual({ type: 'boxBurned', at: p(4, 0) })
  })
})
