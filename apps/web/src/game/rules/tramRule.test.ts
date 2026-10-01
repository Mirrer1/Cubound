import { describe, expect, it } from 'vitest'

import type { Point, Stage } from '../types'
import { movesLeft } from './limitRule'
import { move } from './moveRule'
import { createState } from './stateRule'
import { BOX_RIDE_STAGE, TRAM_STAGE, play, withTram } from './testStages'
import { nextTramSpot } from './tramRule'

describe('move 움직이는 발판', () => {
  it('큐브가 한 칸 움직이면 발판도 한 칸 가고 위에 선 큐브가 같이 간다', () => {
    const { state, events } = move(createState(TRAM_STAGE), 'right')

    expect(state.player).toEqual({ x: 2, y: 1 })
    expect(state.moves).toBe(1)
    expect(state.trams).toEqual([{ id: 'tram-a', at: 1, dir: 1 }])
    expect(events).toEqual([
      { type: 'moved', from: { x: 0, y: 1 }, to: { x: 1, y: 1 } },
      { type: 'tram', id: 'tram-a', from: { x: 1, y: 1 }, to: { x: 2, y: 1 } },
    ])
  })

  it('벽에 막혀 제자리면 발판도 가지 않는다', () => {
    const start = createState(TRAM_STAGE)
    const { state, events } = move(start, 'left')

    expect(state).toBe(start)
    expect(state.trams).toEqual([{ id: 'tram-a', at: 0, dir: 1 }])
    expect(events).toEqual([{ type: 'blocked', direction: 'left' }])
  })

  it('얼음에서 여러 칸 미끄러져도 발판은 한 칸만 간다', () => {
    const stage = withTram({}, { start: { x: 0, y: 0 }, ice: ['.##...', '......', '......'] })
    const { state, events } = move(createState(stage), 'right')

    expect(state.player).toEqual({ x: 3, y: 0 })
    expect(state.moves).toBe(1)
    expect(state.trams).toEqual([{ id: 'tram-a', at: 1, dir: 1 }])
    expect(events.filter((e) => e.type === 'tram')).toHaveLength(1)
  })

  it('길 끝에 닿으면 방향을 뒤집어 돌아온다', () => {
    const { state } = play(TRAM_STAGE, ['up', 'down', 'up'])

    expect(state.trams).toEqual([{ id: 'tram-a', at: 1, dir: -1 }])
  })

  it('발판이 없는 길 칸에는 들어갈 수 없다', () => {
    const { state, events } = move(createState(withTram({ x: 3, y: 1 })), 'right')

    expect(state.player).toEqual({ x: 0, y: 1 })
    expect(events.some((e) => e.type === 'moved')).toBe(false)
  })

  it('발판 윗면이 선 높이와 같으면 걸어 들어가고 낮으면 떨어진다', () => {
    const ledge = [
      [0, 0, 0, 0, 0, 0],
      [1, -1, -1, -1, 0, 0],
      [0, 0, 0, 0, 0, 0],
    ]
    const level = move(createState(withTram({ level: 1 }, { heights: ledge })), 'right')

    expect(level.state.player).toEqual({ x: 2, y: 1 })
    expect(level.events[0]).toEqual({ type: 'moved', from: { x: 0, y: 1 }, to: { x: 1, y: 1 } })

    const low = move(createState(withTram({}, { heights: ledge })), 'right')

    expect(low.events[0]).toEqual({
      type: 'fell',
      from: { x: 0, y: 1 },
      to: { x: 1, y: 1 },
      drop: 1,
    })
  })

  it('발판 윗면이 한 층 높으면 그냥은 올라가지 못한다', () => {
    const { state, events } = move(createState(withTram({ level: 1 })), 'right')

    expect(state.player).toEqual({ x: 0, y: 1 })
    expect(events.some((e) => e.type === 'moved')).toBe(false)
  })

  it('발판이 없는 길 칸으로는 상자를 밀 수 없다', () => {
    const stage = withTram({}, { start: { x: 5, y: 1 }, entities: [{ type: 'box', x: 4, y: 1 }] })
    const { state } = move(createState(stage), 'left')

    expect(state.pushes).toBe(0)
    expect(state.boxes).toEqual([{ x: 4, y: 1 }])
    expect(state.heights[1][3]).toBe(-1)
  })

  it('발판 위로 상자를 밀 수 있고 상자가 발판과 같이 간다', () => {
    const stage = withTram(
      { x: 3, y: 1 },
      { start: { x: 5, y: 1 }, entities: [{ type: 'box', x: 4, y: 1 }] },
    )
    const first = move(createState(stage), 'left')

    expect(first.state.pushes).toBe(1)
    expect(first.state.player).toEqual({ x: 4, y: 1 })
    expect(first.state.boxes).toEqual([{ x: 2, y: 1 }])
    expect(first.events).toContainEqual({
      type: 'pushed',
      from: { x: 4, y: 1 },
      to: { x: 3, y: 1 },
      result: 'slid',
    })

    const second = move(first.state, 'up')

    expect(second.state.boxes).toEqual([{ x: 1, y: 1 }])
  })
})

describe('move 발판 위에서 막힌 이동', () => {
  it('세 칸 길을 발판을 타고 건너간다', () => {
    const { state } = play(TRAM_STAGE, ['right', 'right', 'right'])

    expect(state.player).toEqual({ x: 4, y: 1 })
    expect(state.moves).toBe(3)
  })

  it('발판 위에서 막히면 이동 수가 오르고 발판을 따라 실려 간다', () => {
    const onTram = move(createState(TRAM_STAGE), 'right').state
    const { state } = move(onTram, 'right')

    expect(onTram.player).toEqual({ x: 2, y: 1 })
    expect(state.player).toEqual({ x: 3, y: 1 })
    expect(state.moves).toBe(2)
  })

  it('발판 위에서 막힌 이동은 blocked 없이 발판 이벤트만 남긴다', () => {
    const onTram = move(createState(TRAM_STAGE), 'right').state
    const { events } = move(onTram, 'right')

    expect(events).toEqual([
      { type: 'tram', id: 'tram-a', from: { x: 2, y: 1 }, to: { x: 3, y: 1 } },
    ])
  })

  it('땅 위에서 막힌 이동은 이동 수를 늘리지 않는다', () => {
    const start = createState(TRAM_STAGE)
    const { state, events } = move(start, 'left')

    expect(state.moves).toBe(0)
    expect(events).toEqual([{ type: 'blocked', direction: 'left' }])
  })

  it('발판 위에서 내릴 수 있는 쪽으로 가면 평소대로 내린다', () => {
    const onTram = move(createState(TRAM_STAGE), 'right').state
    const { state, events } = move(onTram, 'up')

    expect(state.player).toEqual({ x: 2, y: 0 })
    expect(events[0]).toEqual({ type: 'moved', from: { x: 2, y: 1 }, to: { x: 2, y: 0 } })
  })

  it('보스 이동 제한이 있으면 발판 위에서 막힌 이동도 제한을 쓴다', () => {
    const stage: Stage = { ...TRAM_STAGE, rules: { moveLimit: 2 } }
    const onTram = move(createState(stage), 'right').state
    const { state } = move(onTram, 'right')

    expect(state.moves).toBe(2)
    expect(movesLeft(state)).toBe(0)
  })

  it('발판 위 상자에 올라선 큐브도 상자와 함께 실려 간다', () => {
    const climbed = play(BOX_RIDE_STAGE, ['up', 'left', 'up', 'right']).state

    expect(climbed.player).toEqual({ x: 2, y: 1 })
    expect(climbed.boxes).toEqual([{ x: 2, y: 1 }])

    const { state } = move(climbed, 'right')

    expect(state.player).toEqual({ x: 3, y: 1 })
    expect(state.boxes).toEqual([{ x: 3, y: 1 }])
    expect(state.moves).toBe(5)
  })
})

describe('move 발판 기다리기', () => {
  it('발판이 없는 길 칸 쪽으로 밀면 제자리에 서고 이동 수가 오른다', () => {
    const { state } = move(createState(withTram({ x: 3, y: 1 })), 'right')

    expect(state.player).toEqual({ x: 0, y: 1 })
    expect(state.moves).toBe(1)
  })

  it('기다리는 동안 발판이 한 칸 간다', () => {
    const { state } = move(createState(withTram({ x: 3, y: 1 })), 'right')

    expect(state.trams).toEqual([{ id: 'tram-a', at: 1, dir: -1 }])
  })

  it('기다린 이동은 blocked 없이 발판 이벤트만 남긴다', () => {
    const { events } = move(createState(withTram({ x: 3, y: 1 })), 'right')

    expect(events).toEqual([
      { type: 'tram', id: 'tram-a', from: { x: 3, y: 1 }, to: { x: 2, y: 1 } },
    ])
  })

  it('두 수를 이어 기다리면 발판이 두 칸 간다', () => {
    const { state } = play(withTram({ x: 3, y: 1 }), ['right', 'right'])

    expect(state.moves).toBe(2)
    expect(state.trams).toEqual([{ id: 'tram-a', at: 0, dir: -1 }])
  })

  it('발판 길이 아닌 벽이나 바닥 없는 칸 쪽으로 밀면 이동 수가 오르지 않는다', () => {
    const wall = createState(withTram({ x: 3, y: 1 }))
    const blocked = move(wall, 'left')

    expect(blocked.state).toBe(wall)
    expect(blocked.events).toEqual([{ type: 'blocked', direction: 'left' }])

    const pit = createState(
      withTram(
        { x: 3, y: 1 },
        {
          start: { x: 0, y: 0 },
          heights: [
            [0, -1, 0, 0, 0, 0],
            [0, -1, -1, -1, 0, 0],
            [0, 0, 0, 0, 0, 0],
          ],
        },
      ),
    )
    const fell = move(pit, 'right')

    expect(fell.state).toBe(pit)
    expect(fell.events).toEqual([{ type: 'blocked', direction: 'right' }])
  })

  it('발판이 와 있으면 기다리지 않고 평소대로 올라탄다', () => {
    const { state, events } = move(createState(TRAM_STAGE), 'right')

    expect(state.player).toEqual({ x: 2, y: 1 })
    expect(events[0]).toEqual({ type: 'moved', from: { x: 0, y: 1 }, to: { x: 1, y: 1 } })
  })

  it('발판 자리와 홀짝이 어긋나도 한 수 기다렸다가 탈 수 있다', () => {
    const { state } = play(withTram({ x: 3, y: 1 }), ['right', 'right', 'right'])

    expect(state.player).toEqual({ x: 2, y: 1 })
    expect(state.moves).toBe(3)
  })

  it('보스 이동 제한이 있으면 기다린 이동도 제한을 쓴다', () => {
    const stage = { ...withTram({ x: 3, y: 1 }), rules: { moveLimit: 1 } }
    const waited = move(createState(stage), 'right')

    expect(waited.state.moves).toBe(1)
    expect(movesLeft(waited.state)).toBe(0)

    const { state, events } = move(waited.state, 'right')

    expect(state.moves).toBe(1)
    expect(events).toEqual([
      { type: 'blocked', direction: 'right' },
      { type: 'limit', limit: 'moves' },
    ])
  })
})

describe('nextTramSpot', () => {
  const CELLS: Point[] = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 2, y: 0 },
  ]

  it('가던 방향으로 한 칸 간다', () => {
    expect(nextTramSpot(CELLS, { id: 't', at: 1, dir: 1 })).toEqual({ id: 't', at: 2, dir: 1 })
    expect(nextTramSpot(CELLS, { id: 't', at: 1, dir: -1 })).toEqual({ id: 't', at: 0, dir: -1 })
  })

  it('길 끝에 닿아 있으면 방향을 뒤집어 한 칸 돌아온다', () => {
    expect(nextTramSpot(CELLS, { id: 't', at: 2, dir: 1 })).toEqual({ id: 't', at: 1, dir: -1 })
    expect(nextTramSpot(CELLS, { id: 't', at: 0, dir: -1 })).toEqual({ id: 't', at: 1, dir: 1 })
  })
})
