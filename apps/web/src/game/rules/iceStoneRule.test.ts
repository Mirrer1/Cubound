import { describe, expect, it } from 'vitest'

import type { Direction, Entity, GameEvent, Point, Stage } from '../types'
import { isFrozen } from './cellRule'
import { move } from './moveRule'
import { createState, standHeight } from './stateRule'
import { WARP_STAGE, play } from './testStages'

// 물 높이 1, x 2~6과 y 2~4가 물 칸
const POND: Stage = {
  version: 1,
  id: 'test-ice-stone',
  name: '얼음 돌 테스트',
  heights: [
    [1, 1, 1, 1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1, 1, 1, 1],
    [1, 1, 0, 0, 0, 0, 0, 1],
    [1, 1, 0, 0, 0, 0, 0, 1],
    [1, 1, 0, 0, 0, 0, 0, 1],
    [1, 1, 1, 1, 1, 1, 1, 1],
  ],
  water: 1,
  start: { x: 0, y: 0 },
  goal: { x: 7, y: 5 },
  entities: [],
}

const p = (x: number, y: number): Point => ({ x, y })
const stone = (x: number, y: number): Entity => ({ type: 'iceStone', x, y })
const box = (x: number, y: number): Entity => ({ type: 'box', x, y })

const pond = (entities: Entity[], rest: Partial<Stage> = {}): Stage => ({
  ...POND,
  ...rest,
  entities,
})

const raised = (x: number, y: number, h: number) =>
  POND.heights.map((row, i) => (i === y ? row.map((v, j) => (j === x ? h : v)) : row))

const blocked = (direction: Direction): GameEvent[] => [{ type: 'blocked', direction }]

describe('move 얼음 돌 땅 위', () => {
  it('상자처럼 한 칸 밀리고 미는 횟수에 센다', () => {
    const { state, events } = play(pond([stone(1, 1)], { start: p(0, 1) }), ['right'])

    expect(state.stones).toEqual([p(2, 1)])
    expect(state.player).toEqual(p(1, 1))
    expect(state.pushes).toBe(1)
    expect(events).toContainEqual({
      type: 'stonePushed',
      from: p(1, 1),
      to: p(2, 1),
      result: 'slid',
    })
    expect(events).toContainEqual({ type: 'froze', cells: [p(2, 2)] })
  })

  it('구덩이 쪽으로는 밀리지 않고 막힌다', () => {
    const stage = pond([stone(1, 1)], { start: p(0, 1), heights: raised(2, 1, -1) })
    const { state, events } = play(stage, ['right'])

    expect(state.stones).toEqual([p(1, 1)])
    expect(state.heights[1][2]).toBe(-1)
    expect(events).toEqual(blocked('right'))
  })

  it('얼음바닥에서 미끄러지다 구덩이 앞에서 멈춘다', () => {
    const stage: Stage = {
      ...POND,
      heights: [
        [1, 1, 1, 1, 1, 1],
        [1, 1, 1, 1, -1, 1],
        [1, 1, 1, 1, 1, 1],
      ],
      water: undefined,
      ice: ['......', '..##..', '......'],
      start: p(0, 1),
      goal: p(5, 2),
      entities: [stone(1, 1)],
    }
    const { state } = play(stage, ['right'])

    expect(state.stones).toEqual([p(3, 1)])
    expect(state.heights[1][4]).toBe(-1)
  })

  it('밀 수 없으면 올라서지 못하고 벽처럼 막힌다', () => {
    const stuck = move(createState(pond([stone(1, 1), box(2, 1)], { start: p(0, 1) })), 'right')
    const higher = pond([stone(1, 1)], { start: p(0, 1), heights: raised(0, 1, 2) })
    const lower = pond([stone(1, 1)], { start: p(0, 1), heights: raised(1, 1, 2) })

    expect(stuck.events).toEqual(blocked('right'))
    expect(move(createState(higher), 'right').events).toEqual(blocked('right'))
    expect(move(createState(lower), 'right').events).toEqual(blocked('right'))
  })

  it('얼음바닥에서 미끄러지다 물에 닿으면 들어가 뜬다', () => {
    const stage: Stage = {
      ...POND,
      heights: [
        [1, 1, 1, 1, 1, 1, 1],
        [1, 1, 1, 1, 0, 0, 1],
        [1, 1, 1, 1, 1, 1, 1],
      ],
      ice: ['.......', '..##...', '.......'],
      start: p(0, 1),
      goal: p(6, 2),
      entities: [stone(1, 1)],
    }
    const { state, events } = play(stage, ['right'])

    expect(state.stones).toEqual([p(4, 1)])
    expect(events).toEqual([
      { type: 'stonePushed', from: p(1, 1), to: p(2, 1), result: 'slid' },
      { type: 'slid', subject: 'stone', from: p(2, 1), to: p(3, 1) },
      { type: 'stonePushed', from: p(3, 1), to: p(4, 1), result: 'floated' },
      { type: 'moved', from: p(0, 1), to: p(1, 1) },
      { type: 'froze', cells: [p(5, 1)] },
    ])
  })

  it('언 물 칸으로 밀면 그 칸에 떠서 언 길을 미끄러지지 않는다', () => {
    const stage = pond([stone(2, 1), stone(3, 1), stone(4, 1), stone(1, 2)], { start: p(0, 2) })
    const { state, events } = play(stage, ['right'])

    expect(state.stones).toContainEqual(p(2, 2))
    expect(events[0]).toEqual({
      type: 'stonePushed',
      from: p(1, 2),
      to: p(2, 2),
      result: 'floated',
    })
  })

  it('버섯 칸과 늪 칸으로는 밀리지 않는다', () => {
    const mask = ['........', '..#.....', '........', '........', '........', '........']
    const base = pond([stone(1, 1)], { start: p(0, 1) })

    expect(move(createState({ ...base, mushroom: mask }), 'right').events).toEqual(blocked('right'))
    expect(move(createState({ ...base, swamp: mask }), 'right').events).toEqual(blocked('right'))
  })
})

describe('move 얼음 돌 물 위', () => {
  it('물에 밀면 떠서 새 둘레가 얼고 옛 둘레는 녹는다', () => {
    const { state, events } = play(pond([stone(2, 1)], { start: p(2, 0) }), ['down'])

    expect(state.stones).toEqual([p(2, 2)])
    expect(state.player).toEqual(p(2, 1))
    expect(events).toContainEqual({
      type: 'stonePushed',
      from: p(2, 1),
      to: p(2, 2),
      result: 'floated',
    })
    expect(events).toContainEqual({ type: 'froze', cells: [p(3, 2), p(2, 3)] })
    expect(events).toContainEqual({ type: 'thawed', cells: [p(2, 2)] })
  })

  it('한 칸씩 밀리고 큐브는 언 칸으로 따라가 돌 앞에서 멈춘다', () => {
    const stage = pond([stone(2, 3)], { start: p(1, 3) })
    const first = play(stage, ['right'])
    const second = play(stage, ['right', 'right'])

    expect(first.events[0]).toEqual({
      type: 'stonePushed',
      from: p(2, 3),
      to: p(3, 3),
      result: 'rowed',
    })
    expect(first.state.player).toEqual(p(2, 3))
    expect(second.state.stones).toEqual([p(4, 3)])
    expect(second.state.player).toEqual(p(3, 3))
    expect(second.state.pushes).toBe(2)
  })

  it('땅 쪽으로 밀면 막힌다', () => {
    const { state } = play(pond([stone(6, 3)], { start: p(6, 1) }), ['down', 'down'])
    const next = move(state, 'down')

    expect(state.stones).toEqual([p(6, 4)])
    expect(next.state).toBe(state)
    expect(next.events).toEqual(blocked('down'))
  })

  it('다른 돌의 언 칸에 떠 있어도 밀린다', () => {
    const { state } = play(pond([stone(3, 2), stone(3, 3)], { start: p(2, 3) }), ['right'])

    expect(state.stones).toEqual([p(3, 2), p(4, 3)])
  })

  it('둘레가 겹친 칸은 한 돌이 떠나도 다른 돌 둘레라 언 채로 남는다', () => {
    const stage = pond([stone(2, 3), stone(4, 3)], { start: p(3, 3) })
    const { state, events } = play(stage, ['right'])
    const thawed = events.find((e) => e.type === 'thawed')

    expect(state.stones).toEqual([p(2, 3), p(5, 3)])
    expect(isFrozen(state, p(3, 3))).toBe(true)
    expect(thawed && thawed.type === 'thawed' && thawed.cells).not.toContainEqual(p(3, 3))
  })
})

describe('move 언 물 칸', () => {
  it('큐브는 언 칸이 이어진 동안 미끄러지고 끝이 물이면 마지막 언 칸에서 멈춘다', () => {
    const stage = pond([stone(2, 1), stone(3, 1), stone(4, 1)], { start: p(1, 2) })
    const { state, events } = play(stage, ['right'])

    expect(state.player).toEqual(p(4, 2))
    expect(events).toEqual([
      { type: 'moved', from: p(1, 2), to: p(2, 2) },
      { type: 'slid', subject: 'player', from: p(2, 2), to: p(4, 2) },
    ])
  })

  it('언 칸 높이는 물가 땅과 같아 같은 높이 땅으로 걸어 나가고 높은 칸은 막힌다', () => {
    const stage = pond([stone(3, 3)], { start: p(2, 3) })
    const wall = { ...stage, heights: raised(1, 3, 2) }

    expect(play(stage, ['left']).events).toEqual([{ type: 'moved', from: p(2, 3), to: p(1, 3) }])
    expect(move(createState(wall), 'left').events).toEqual(blocked('left'))
  })

  it('상자도 미끄러져 마지막 언 칸에 멈추고 언 칸 위에 올라선다', () => {
    const stage = pond([stone(2, 1), stone(3, 1), stone(4, 1), box(1, 2)], { start: p(0, 2) })
    const { state, events } = play(stage, ['right'])

    expect(state.boxes).toEqual([p(4, 2)])
    expect(state.iced).toEqual([p(4, 2)])
    expect(standHeight(state, p(4, 2))).toBe(2)
    expect(events.slice(0, 2)).toEqual([
      { type: 'pushed', from: p(1, 2), to: p(2, 2), result: 'slid' },
      { type: 'slid', subject: 'box', from: p(2, 2), to: p(4, 2) },
    ])
  })

  it('언 칸 위 상자는 칸이 녹으면 떠서 배가 된다', () => {
    const stage = pond([stone(2, 1), box(1, 2)], { start: p(0, 2) })
    const iced = play(stage, ['right'])
    const { state, events } = play(stage, ['right', 'up', 'right'])

    expect(iced.state.iced).toEqual([p(2, 2)])
    expect(state.boxes).toEqual([p(2, 2)])
    expect(state.iced).toEqual([])
    expect(standHeight(state, p(2, 2))).toBe(1)
    expect(events).toContainEqual({ type: 'thawed', cells: [p(2, 2)] })
  })

  it('언 칸 위 상자를 열린 물로 밀면 뜬다', () => {
    const stage = pond([stone(2, 1), box(1, 2)], { start: p(0, 2) })
    const { state, events } = play(stage, ['right', 'right'])

    expect(state.boxes).toEqual([p(3, 2)])
    expect(state.iced).toEqual([])
    expect(state.player).toEqual(p(2, 2))
    expect(events[0]).toEqual({ type: 'pushed', from: p(2, 2), to: p(3, 2), result: 'floated' })
  })

  it('얼어붙은 배는 저어 갈 수 없고 큐브는 물가 땅 높이로 올라선다', () => {
    const stage = pond([stone(3, 3), box(2, 3)], { start: p(1, 3) })
    const boarded = play(stage, ['right'])

    expect(boarded.events).toEqual([{ type: 'moved', from: p(1, 3), to: p(2, 3) }])
    expect(standHeight(boarded.state, p(2, 3))).toBe(1)
    expect(move(boarded.state, 'down').events).toEqual(blocked('down'))
  })

  it('얼음이 녹으면 다시 보통 배가 된다', () => {
    const stage = pond([stone(3, 3), box(2, 3)], { start: p(1, 3) })
    const { state, events } = play(stage, ['right', 'right', 'left', 'down'])

    expect(state.boxes).toEqual([p(2, 4)])
    expect(state.player).toEqual(p(2, 4))
    expect(events[0]).toEqual({ type: 'rowed', from: p(2, 3), to: p(2, 4) })
  })

  it('얼어붙은 배 위에 선 큐브는 미끄러지지 않는다', () => {
    const ice = pond([stone(2, 2), stone(3, 4)], { start: p(1, 3) })
    const boat = pond([stone(2, 2), stone(3, 4), box(2, 3)], { start: p(1, 3) })

    expect(play(ice, ['right']).state.player).toEqual(p(3, 3))
    expect(play(boat, ['right']).state.player).toEqual(p(2, 3))
  })

  it('탄 배가 언 칸 쪽으로 가면 큐브만 걸어 내리고 배는 남는다', () => {
    const { state, events } = play(pond([stone(4, 3), box(2, 3)], { start: p(2, 3) }), ['right'])

    expect(state.player).toEqual(p(3, 3))
    expect(state.boxes).toEqual([p(2, 3)])
    expect(events[0]).toEqual({ type: 'moved', from: p(2, 3), to: p(3, 3) })
  })

  it('언 칸에서는 사다리를 놓지 않는다', () => {
    const stage = pond([stone(3, 3)], { start: p(2, 3), heights: raised(1, 3, 2) })
    const { state, events } = move({ ...createState(stage), carrying: 'ladder' }, 'left')

    expect(events).toEqual(blocked('left'))
    expect(state.leaningLadders).toEqual([])
  })
})

describe('move 얼음 돌과 다른 요소', () => {
  it('돌이 스위치를 누른다', () => {
    const stage = pond(
      [
        stone(1, 1),
        { type: 'switch', x: 2, y: 1, target: 'a' },
        { type: 'door', x: 5, y: 0, id: 'a' },
      ],
      { start: p(0, 1) },
    )

    expect(play(stage, ['right']).events).toContainEqual({ type: 'door', id: 'a', open: true })
  })

  it('무너지는 칸에서 올라 있으면 안 닳고 밀려 나가면 닳는다', () => {
    const cracks = ['........', '.2......', '........', '........', '........', '........']
    const stage = pond([stone(1, 1)], { start: p(0, 0), cracks })

    expect(play(stage, ['down']).state.cracks).toEqual([{ x: 1, y: 1, left: 2 }])
    expect(play(stage, ['down', 'right']).events).toContainEqual({
      type: 'cracked',
      at: p(1, 1),
      left: 1,
      gone: false,
    })
  })

  it('돌 위에는 사다리를 놓을 수 없고 상자도 올릴 수 없다', () => {
    const ladder = pond([stone(1, 1)], { start: p(0, 1), heights: raised(1, 1, 2) })
    const placing = move({ ...createState(ladder), carrying: 'ladder' }, 'right')
    const { state } = play(pond([box(1, 1), stone(2, 1)], { start: p(0, 1) }), ['right'])

    expect(placing.events).toEqual(blocked('right'))
    expect(placing.state.leaningLadders).toEqual([])
    expect(state.boxes).toEqual([p(1, 1)])
    expect(state.stones).toEqual([p(2, 1)])
  })

  it('짝 칸의 나올 칸에 돌이 있으면 들어간 칸에 그대로 선다', () => {
    const state = { ...createState(WARP_STAGE), stones: [p(4, 1)] }
    const { state: next, events } = move(state, 'right')

    expect(next.player).toEqual(p(1, 1))
    expect(events).toEqual([{ type: 'moved', from: p(0, 1), to: p(1, 1) }])
  })

  it('밀기 제한을 다 쓰면 돌도 못 민다', () => {
    const stage = pond([stone(1, 1)], { start: p(0, 1), rules: { pushLimit: 1 } })
    const { state } = play(stage, ['right'])
    const next = move(state, 'right')

    expect(next.state.stones).toEqual([p(2, 1)])
    expect(next.events).toEqual([
      { type: 'blocked', direction: 'right' },
      { type: 'limit', limit: 'pushes' },
    ])
  })
})

describe('move 얼음 돌 소용돌이', () => {
  // (2,2) 소용돌이가 끄는 오른쪽 줄 (3~6,2)와 아래 줄 (2,3~4)
  const whirl = (entities: Entity[], rest: Partial<Stage> = {}) =>
    pond([{ type: 'whirlpool', x: 2, y: 2 }, ...entities], { start: p(1, 0), ...rest })
  const PACE: Direction[] = ['down', 'up', 'down']

  it('물에 뜬 돌은 빈 배처럼 끌리고 제 둘레 얼음은 줄을 끊지 않는다', () => {
    const first = play(whirl([stone(5, 2)]), ['down'])

    expect(first.state.stones).toEqual([p(4, 2)])
    expect(first.events).toContainEqual({ type: 'stonePulled', from: p(5, 2), to: p(4, 2) })
    expect(play(whirl([stone(5, 2)]), PACE).state.stones).toEqual([p(3, 2)])
  })

  it('큐브가 그 돌의 언 칸에 서 있으면 안 끌린다', () => {
    const stage = whirl([stone(6, 2)], { start: p(7, 3) })

    expect(play(stage, ['left']).state.stones).toEqual([p(6, 2)])
    expect(play(stage, ['left', 'right']).state.stones).toEqual([p(5, 2)])
  })

  it('얼어붙은 배는 안 끌린다', () => {
    expect(play(whirl([box(4, 2), stone(4, 3)]), PACE).state.boxes).toEqual([p(4, 2)])
  })

  it('다른 돌의 언 칸은 땅처럼 줄을 끊는다', () => {
    expect(play(whirl([box(6, 2), stone(4, 3)]), PACE).state.boxes).toEqual([p(6, 2)])
    expect(play(whirl([stone(6, 2), stone(4, 3)]), PACE).state.stones).toEqual([p(6, 2), p(4, 3)])
  })

  it('소용돌이 칸 쪽으로는 땅에서도 물에서도 밀리지 않는다', () => {
    const land = whirl([stone(2, 1)], { start: p(2, 0), rules: { plug: true } })
    const water = whirl([stone(2, 3)], { start: p(2, 4) })

    expect(move(createState(land), 'down').events).toEqual(blocked('down'))
    expect(move(createState(water), 'up').events).toEqual(blocked('up'))
  })
})

describe('move 녹는 얼음', () => {
  const melting = (entities: Entity[], melt: number, rest: Partial<Stage> = {}) =>
    pond(entities, { start: p(2, 0), rules: { melt }, ...rest })

  it('물에 들어간 수에 숫자가 붙고 수마다 줄어 0이 된 수 끝에 녹는다', () => {
    const stage = melting([stone(2, 1)], 3)
    const pushed = play(stage, ['down'])
    const two = play(stage, ['down', 'left', 'right'])
    const gone = play(stage, ['down', 'left', 'right', 'left'])

    expect(createState(stage).melt).toBeNull()
    expect(pushed.state.melt).toBe(3)
    expect(two.state.melt).toBe(1)
    expect(gone.state.stones).toEqual([])
    expect(gone.state.melt).toBeNull()
    expect(gone.events).toContainEqual({ type: 'melted', at: p(2, 2) })
    expect(gone.events).toContainEqual({ type: 'thawed', cells: [p(3, 2), p(2, 3)] })
  })

  it('땅 위 돌은 녹지 않는다', () => {
    const { state } = play(melting([stone(2, 1)], 1, { start: p(0, 0) }), ['right', 'left'])

    expect(state.stones).toEqual([p(2, 1)])
    expect(state.melt).toBeNull()
  })

  it('물에 뜬 돌이 있으면 다른 돌은 물로 밀리지 않는다', () => {
    const stage = melting([stone(2, 1), stone(4, 1)], 9)
    const { state } = play(stage, ['down', 'up', 'right', 'right'])
    const next = move(state, 'down')

    expect(next.events).toEqual(blocked('down'))
    expect(next.state.stones).toEqual([p(2, 2), p(4, 1)])
  })

  it('녹을 수에 큐브가 둘레 언 칸에 서 있으면 0에서 멈추고 떠나는 수 끝에 녹는다', () => {
    const stage = melting([stone(2, 1)], 2)
    const waiting = play(stage, ['down', 'right', 'down'])
    const left = move(waiting.state, 'up')

    expect(waiting.state.player).toEqual(p(3, 2))
    expect(waiting.state.melt).toBe(0)
    expect(waiting.state.stones).toEqual([p(2, 2)])
    expect(left.state.stones).toEqual([])
    expect(left.events).toContainEqual({ type: 'melted', at: p(2, 2) })
  })

  it('처음부터 뜬 돌은 처음 상태에 숫자가 붙어 있다', () => {
    const stage = melting([stone(4, 3)], 2, { start: p(0, 0) })

    expect(createState(stage).melt).toBe(2)
    expect(play(stage, ['down']).state.melt).toBe(1)
    expect(play(stage, ['down', 'up']).state.stones).toEqual([])
  })
})
