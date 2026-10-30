import { describe, expect, it } from 'vitest'

import { solve } from '../solver'
import type { Direction, Point, Stage } from '../types'
import { move } from './moveRule'
import { createState } from './stateRule'
import { TRAM_STAGE, play } from './testStages'

// 2x3 빈터와 숯 벽 (3,1), 집 (4,1)
const ROOM_STAGE: Stage = {
  version: 1,
  id: 'test-trail',
  name: '꼬리 불 테스트',
  heights: [
    [0, 0, 0, -1, -1],
    [0, 0, 0, 0, 0],
  ],
  fire: ['.....', '...#.'],
  start: { x: 0, y: 1 },
  goal: { x: 4, y: 1 },
  entities: [],
  rules: { trail: true },
}

const p = (x: number, y: number): Point => ({ x, y })

const trailOf = (stage: Stage, directions: Direction[]) =>
  play(stage, directions).state.trail.map(({ x, y, left }) => ({ x, y, left }))

describe('createState 꼬리 불', () => {
  it('꼬리 불 판은 큐브 불이 4로 시작하고 꼬리는 비어 있다', () => {
    const state = createState(ROOM_STAGE)

    expect(state.flame).toBe(4)
    expect(state.trail).toEqual([])
  })

  it('다른 판은 꼬리가 비어 있고 불 없이 시작한다', () => {
    const state = createState({ ...ROOM_STAGE, rules: undefined })

    expect(state.flame).toBe(0)
    expect(state.trail).toEqual([])
  })
})

describe('move 꼬리 불', () => {
  it('큐브 불은 줄지 않고 꺼지지 않는다', () => {
    const { state, events } = play(ROOM_STAGE, ['up', 'right', 'right', 'down', 'left'])

    expect(state.flame).toBe(4)
    expect(events.some((e) => e.type === 'doused')).toBe(false)
  })

  it('떠난 칸은 그 수에 3으로 켜지고 한 수마다 1씩 줄어 세 칸만 남는다', () => {
    expect(trailOf(ROOM_STAGE, ['right'])).toEqual([{ x: 0, y: 1, left: 3 }])
    expect(trailOf(ROOM_STAGE, ['up', 'right', 'right', 'down'])).toEqual([
      { x: 0, y: 0, left: 1 },
      { x: 1, y: 0, left: 2 },
      { x: 2, y: 0, left: 3 },
    ])
  })

  it('켜진 칸과 꺼진 칸을 이벤트로 알린다', () => {
    const lit = play(ROOM_STAGE, ['right']).events
    const out = play(ROOM_STAGE, ['up', 'right', 'right', 'down']).events

    expect(lit).toContainEqual({ type: 'trailLit', at: p(0, 1) })
    expect(out).toContainEqual({ type: 'trailOut', at: p(0, 1) })
  })

  it('바로 뒤 칸은 꼬리라 못 들어간다', () => {
    const before = play(ROOM_STAGE, ['right']).state
    const { state, events } = move(before, 'left')

    expect(state).toBe(before)
    expect(events).toEqual([{ type: 'blocked', direction: 'left' }])
  })

  it('2x2 고리는 넷째 수에 꼬리에 막힌다', () => {
    const before = play(ROOM_STAGE, ['up', 'right', 'down']).state

    expect(move(before, 'left').state).toBe(before)
  })

  it('2x3 고리는 여섯째 수에 처음 칸으로 돌아온다', () => {
    const { state } = play(ROOM_STAGE, ['up', 'right', 'right', 'down', 'left', 'left'])

    expect(state.player).toEqual(p(0, 1))
  })

  it('꼬리 칸은 켜진 그 수 끝에 옆 같은 높이 숯 벽에 불을 옮기고 다음 수에 재가 된다', () => {
    const lit = play(ROOM_STAGE, ['right', 'right', 'up'])
    const ashed = play(ROOM_STAGE, ['right', 'right', 'up', 'left']).state

    expect(lit.events).toContainEqual({ type: 'caught', from: p(2, 1), to: p(3, 1) })
    expect(lit.state.burning).toEqual([p(3, 1)])
    expect(ashed.ashes).toEqual([p(3, 1)])
  })

  it('벽 옆을 지나 고리를 돌아오면 10수, 벽에 직접 붙이면 11수다', () => {
    const passBy: Direction[] = ['right', 'right', 'up', 'left', 'left', 'down', 'right']
    const torchIt: Direction[] = ['right', 'right', 'right', 'up', 'left', 'left', 'down']

    expect(play(ROOM_STAGE, [...passBy, 'right', 'right', 'right']).state.cleared).toBe(true)
    expect(play(ROOM_STAGE, [...torchIt, 'right', 'right', 'right', 'right']).state.cleared).toBe(
      true,
    )
    expect(solve(ROOM_STAGE)).toMatchObject({ status: 'solved', moves: 10 })
  })

  it('벽에 불을 붙이는 제자리 수는 새 꼬리 없이 꼬리만 줄인다', () => {
    const { state, events } = play(ROOM_STAGE, ['right', 'right', 'right'])

    expect(events).toContainEqual({ type: 'torched', from: p(2, 1), to: p(3, 1) })
    expect(state.player).toEqual(p(2, 1))
    expect(state.trail).toEqual([
      { x: 0, y: 1, left: 1 },
      { x: 1, y: 1, left: 2 },
    ])
  })

  it('사방이 꼬리와 벽이면 움직일 수 없다', () => {
    // 막다른 길 끝 (2,0), 오른쪽은 구덩이
    const stage: Stage = {
      ...ROOM_STAGE,
      heights: [[0, 0, 0, -1, 0]],
      fire: ['.....'],
      start: p(0, 0),
      goal: p(4, 0),
    }
    const before = play(stage, ['right', 'right']).state

    expect(before.player).toEqual(p(2, 0))
    expect(
      ['left', 'up', 'down', 'right'].every((d) => move(before, d as Direction).state === before),
    ).toBe(true)
  })

  it('상자는 꼬리 칸으로 밀리지 않는다', () => {
    // 상자 (1,0)을 꼬리 (0,0) 쪽으로 미는 수
    const stage: Stage = {
      ...ROOM_STAGE,
      heights: [[0, 0, 0]],
      fire: ['...'],
      start: p(2, 0),
      goal: p(2, 0),
      entities: [{ type: 'box', x: 1, y: 0 }],
    }
    const start = createState(stage)
    const before = { ...start, trail: [{ x: 0, y: 0, left: 2 }] }

    expect(move(start, 'left').state.boxes).toEqual([p(0, 0)])
    expect(move(before, 'left').state.boxes).toEqual([p(1, 0)])
  })

  it('숯 다리는 뒤 꼬리에 불이 붙어 큐브가 떠나는 수에 구덩이가 된다', () => {
    const stage: Stage = {
      ...ROOM_STAGE,
      heights: [[0, 0, 0, 0]],
      fire: ['.=..'],
      start: p(0, 0),
      goal: p(3, 0),
    }
    const onBridge = play(stage, ['right']).state
    const crossed = play(stage, ['right', 'right']).state

    expect(onBridge.burning).toEqual([p(1, 0)])
    expect(crossed.heights[0][1]).toBe(-1)
    expect(crossed.trail.some((t) => t.x === 1)).toBe(false)
  })

  it('안 탄 숯 다리를 떠나면 꼬리 대신 불붙은 숯이 된다', () => {
    const stage: Stage = {
      ...ROOM_STAGE,
      heights: [[0, 0, 0]],
      fire: ['.=.'],
      start: p(0, 0),
      goal: p(2, 0),
    }
    const { state } = move({ ...createState(stage), player: p(1, 0) }, 'right')

    expect(state.burning).toEqual([p(1, 0)])
    expect(state.trail).toEqual([])
  })

  it('상자 위에서 떠난 칸에는 꼬리가 남지 않는다', () => {
    // 높은 땅 (0,0)에서 낮은 땅 상자 (1,0) 위로 걸어 (2,0)으로
    const stage: Stage = {
      ...ROOM_STAGE,
      heights: [[1, 0, 1]],
      fire: ['...'],
      start: p(0, 0),
      goal: p(2, 0),
      entities: [{ type: 'box', x: 1, y: 0 }],
    }
    const onBox = play(stage, ['right']).state
    const off = move(onBox, 'right').state

    expect(onBox.player).toEqual(p(1, 0))
    expect(off.trail.map(({ x, y }) => ({ x, y }))).toEqual([p(0, 0)])
  })

  it('꼬리 칸 옆 같은 높이 화약통 심지에 불이 붙는다', () => {
    const stage: Stage = {
      ...ROOM_STAGE,
      heights: [
        [0, 0, 0],
        [0, 0, 0],
      ],
      fire: ['...', '...'],
      start: p(0, 0),
      goal: p(2, 0),
      entities: [{ type: 'keg', x: 1, y: 1, fuse: true }],
    }
    const { events } = play(stage, ['right', 'right'])

    expect(events).toContainEqual({ type: 'fuseLit', at: p(1, 1) })
  })

  it('레일 옆에서 발판을 기다리면 새 꼬리 없이 꼬리가 다 꺼진다', () => {
    // 발판이 (2,1), (3,1), (2,1)에 있는 세 수 동안 (0,1)에서 기다림
    const stage: Stage = { ...TRAM_STAGE, start: p(0, 0), fire: ['......', '......', '......'] }
    const waited = play({ ...stage, rules: { trail: true } }, ['down', 'right', 'right', 'right'])

    expect(waited.state.player).toEqual(p(0, 1))
    expect(waited.state.trail).toEqual([])
  })

  it('발판에서 내린 칸에는 꼬리가 남지 않는다', () => {
    const stage: Stage = {
      ...TRAM_STAGE,
      start: p(0, 0),
      fire: ['......', '......', '......'],
      rules: { trail: true },
    }
    const boarded = play(stage, ['down', 'right', 'right', 'right', 'right']).state
    const off = move(boarded, 'up').state

    expect(boarded.player).toEqual(p(2, 1))
    expect(off.trail.some((t) => t.y === 1 && t.x > 0)).toBe(false)
  })
})
