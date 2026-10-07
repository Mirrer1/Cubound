import { describe, expect, it } from 'vitest'

import type { Direction, Stage } from '../types'
import { isWater } from './cellRule'
import { isFloodable, waterLevel } from './sluiceRule'
import { standHeight } from './stateRule'
import { play } from './testStages'
import { isHighTide } from './tideRule'

// 물 높이 1, (1,2) (2,2) (3,2)가 잠기는 줄, (4,2)는 늘 물, 나머지는 높이 2
const TIDE_STAGE: Stage = {
  version: 1,
  id: 'test-tide',
  heights: [
    [2, 2, 2, 2, 2, 2],
    [2, 2, 2, 2, 2, 2],
    [2, 1, 1, 1, 0, 2],
    [2, 2, 2, 2, 2, 2],
  ],
  water: 1,
  start: { x: 1, y: 0 },
  goal: { x: 5, y: 0 },
  entities: [],
  rules: { tide: true },
}

const ROW = [
  { x: 1, y: 2 },
  { x: 2, y: 2 },
  { x: 3, y: 2 },
]

const tide = (rest: Partial<Stage> = {}): Stage => ({ ...TIDE_STAGE, ...rest })

const SHUTTLE: Direction[] = ['right', 'left', 'right', 'left']

describe('isHighTide', () => {
  it('네 수 낮은 물, 네 수 높은 물의 반복', () => {
    const highs = [0, 1, 2, 3, 4, 5, 6, 7, 8].map((moves) =>
      isHighTide({ ...play(tide(), []).state, moves }),
    )

    expect(highs).toEqual([false, false, false, false, true, true, true, true, false])
  })

  it('밀물 판이 아니면 늘 거짓', () => {
    expect(isHighTide({ ...play(tide({ rules: undefined }), []).state, moves: 4 })).toBe(false)
  })
})

describe('밀물 물 높이', () => {
  it('네 번째 수에 잠기는 줄이 물이 되고 여덟 번째 수에 드러남', () => {
    const four = play(tide(), SHUTTLE)
    const eight = play(tide(), [...SHUTTLE, ...SHUTTLE])

    expect(waterLevel(four.state, { x: 2, y: 2 })).toBe(2)
    expect(ROW.every((p) => isWater(four.state, p))).toBe(true)
    expect(ROW.some((p) => isWater(eight.state, p))).toBe(false)
  })

  it('물때가 바뀌는 수의 sluice 이벤트', () => {
    const up = play(tide(), SHUTTLE)
    const down = play(tide(), [...SHUTTLE, ...SHUTTLE])

    expect(up.events).toContainEqual({ type: 'sluice', up: true, cells: ROW, tide: true })
    expect(down.events).toContainEqual({ type: 'sluice', up: false, cells: ROW, tide: true })
    expect(play(tide(), SHUTTLE.slice(0, 3)).events.some((e) => e.type === 'sluice')).toBe(false)
  })

  it('밀물 판의 물 높이와 같은 땅은 잠기는 칸', () => {
    expect(isFloodable(tide(), { x: 2, y: 2 })).toBe(true)
    expect(isFloodable(tide(), { x: 2, y: 1 })).toBe(false)
    expect(isFloodable(tide({ rules: undefined }), { x: 2, y: 2 })).toBe(false)
  })

  it('밀물 판이 아니면 네 수 뒤에도 판의 물 높이', () => {
    const state = play(tide({ rules: undefined }), SHUTTLE).state

    expect(waterLevel(state, { x: 2, y: 2 })).toBe(1)
  })

  it('벽에 막힌 수는 시계 제자리', () => {
    const state = play(tide(), ['up', 'up', 'right', 'left', 'right']).state

    expect(state.moves).toBe(3)
    expect(isHighTide(state)).toBe(false)
  })
})

describe('밀물 막기', () => {
  it('밀물 수에 젖을 칸으로 걸어 들어가면 제자리와 limit', () => {
    const before = play(tide({ start: { x: 1, y: 1 } }), ['right', 'left', 'right'])
    const result = play(tide({ start: { x: 1, y: 1 } }), ['right', 'left', 'right', 'down'])

    expect(result.state).toEqual(before.state)
    expect(result.events).toEqual([
      { type: 'blocked', direction: 'down' },
      { type: 'limit', limit: 'tide' },
    ])
  })

  it('썰물 때는 젖을 칸으로 들어감', () => {
    const result = play(tide({ start: { x: 2, y: 1 } }), ['down'])

    expect(result.state.player).toEqual({ x: 2, y: 2 })
    expect(result.events.some((e) => e.type === 'limit')).toBe(false)
  })

  it('젖은 칸에서 다른 젖은 칸으로 가는 밀물 수는 막힘', () => {
    const result = play(tide({ start: { x: 1, y: 2 } }), ['right', 'left', 'right', 'right'])

    expect(result.state.player).toEqual({ x: 2, y: 2 })
    expect(result.state.moves).toBe(3)
    expect(result.events).toContainEqual({ type: 'limit', limit: 'tide' })
  })

  it('젖은 칸에서 배로 올라타는 밀물 수는 허용, 배와 같이 한 층 오름', () => {
    const stage = tide({ start: { x: 2, y: 2 }, entities: [{ type: 'box', x: 4, y: 2 }] })
    const boarded = play(stage, ['right', 'right'])
    const result = play(stage, ['right', 'left', 'right', 'right'])

    expect(result.state.player).toEqual({ x: 4, y: 2 })
    expect(result.state.moves).toBe(4)
    expect(standHeight(result.state, result.state.player)).toBe(
      standHeight(boarded.state, boarded.state.player) + 1,
    )
  })

  it('밀물 동안 저은 배는 썰물에 드러난 땅에 내려앉고 큐브는 상자 위', () => {
    const stage = tide({ start: { x: 2, y: 2 }, entities: [{ type: 'box', x: 4, y: 2 }] })
    const result = play(stage, ['right', 'left', 'right', 'right', 'left', 'left', 'right', 'left'])

    expect(result.state.moves).toBe(8)
    expect(result.state.player).toEqual({ x: 2, y: 2 })
    expect(result.state.boxes).toContainEqual({ x: 2, y: 2 })
    expect(isWater(result.state, { x: 2, y: 2 })).toBe(false)
    expect(standHeight(result.state, result.state.player)).toBe(2)
  })

  it('밀물 수에 잠기는 줄의 땅 상자 위로 올라서면 허용, 상자는 배', () => {
    const stage = tide({ start: { x: 2, y: 1 }, entities: [{ type: 'box', x: 3, y: 2 }] })
    const result = play(stage, ['right', 'left', 'right', 'down'])

    expect(result.state.player).toEqual({ x: 3, y: 2 })
    expect(result.state.moves).toBe(4)
    expect(isWater(result.state, { x: 3, y: 2 })).toBe(true)
  })

  it('밀물 수에 상자를 잠기는 줄로 밀고 큐브는 마른 칸이면 허용, 상자는 배', () => {
    const stage = tide({ start: { x: 1, y: 0 }, entities: [{ type: 'box', x: 2, y: 1 }] })
    const result = play(stage, ['right', 'left', 'right', 'down'])

    expect(result.state.player).toEqual({ x: 2, y: 1 })
    expect(result.state.boxes).toEqual([{ x: 2, y: 2 }])
    expect(isWater(result.state, { x: 2, y: 2 })).toBe(true)
    expect(result.events.some((e) => e.type === 'limit')).toBe(false)
  })

  it('밀물 수에 얼음을 미끄러져 잠기는 줄에서 멈추면 수 전체 막힘', () => {
    // (1,0) (2,0) 얼음 끝에서 잠기는 칸 (3,0)으로 떨어지는 판
    const stage: Stage = {
      version: 1,
      id: 'test-tide-ice',
      heights: [
        [2, 2, 2, 1, 2],
        [2, 2, 2, 2, 2],
      ],
      ice: ['.##..', '.....'],
      water: 1,
      start: { x: 0, y: 1 },
      goal: { x: 4, y: 1 },
      entities: [],
      rules: { tide: true },
    }

    expect(play(stage, ['up', 'right']).state.player).toEqual({ x: 3, y: 0 })
    const result = play(stage, ['up', 'down', 'up', 'right'])
    expect(result.state.player).toEqual({ x: 0, y: 0 })
    expect(result.state.moves).toBe(3)
    expect(result.events).toContainEqual({ type: 'limit', limit: 'tide' })
  })

  it('얼음 돌 옆 잠기는 칸도 젖을 칸이라 밀물 수에 막힘', () => {
    const stage = tide({ start: { x: 2, y: 1 }, entities: [{ type: 'iceStone', x: 3, y: 3 }] })
    const result = play(stage, ['right', 'left', 'right', 'down'])

    expect(result.state.player).toEqual({ x: 3, y: 1 })
    expect(result.events).toContainEqual({ type: 'limit', limit: 'tide' })
  })

  it('밀물 판이 아니면 같은 수도 그대로 이동', () => {
    const result = play(tide({ start: { x: 1, y: 1 }, rules: undefined }), [
      'right',
      'left',
      'right',
      'down',
    ])

    expect(result.state.player).toEqual({ x: 2, y: 2 })
  })
})
