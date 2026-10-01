import { describe, expect, it } from 'vitest'

import type { Direction, Entity, GameState, MoveResult, Point, Stage } from '../types'
import { move } from './moveRule'
import { createState, standHeight } from './stateRule'
import { play } from './testStages'

// 오른쪽 (3, 1)과 (3, 2)가 한 층 높아 그 앞에서 심는다
const SEED_STAGE: Stage = {
  version: 1,
  id: 'test-seed',
  name: '씨앗 테스트',
  heights: [
    [0, 0, 0, 0, 0, 0],
    [0, 0, 0, 1, 0, 0],
    [0, 0, 0, 1, 0, 0],
  ],
  start: { x: 0, y: 1 },
  goal: { x: 5, y: 0 },
  entities: [{ type: 'seed', x: 1, y: 1 }],
}

// 씨앗을 주워 (2, 1)에 심는다
const PLANT: Direction[] = ['right', 'right', 'right']

// 씨앗을 든 채 (1, 1)에 서서 오른쪽 한 층 높은 (2, 1) 쪽으로 밀 수 있는 상태
const holding = (stage: Partial<Stage> = {}, state: Partial<GameState> = {}): GameState => ({
  ...createState({
    ...SEED_STAGE,
    heights: [
      [0, 1, 0],
      [0, 0, 1],
      [0, 0, 0],
    ],
    start: { x: 1, y: 1 },
    goal: { x: 0, y: 0 },
    entities: [],
    ...stage,
  }),
  carrying: 'seed',
  ...state,
})

const heightAt = (state: GameState, { x, y }: Point) => state.heights[y][x]

describe('move 씨앗', () => {
  it('빈손으로 바닥의 씨앗 칸에 들어가면 씨앗을 든다', () => {
    const { state, events } = move(createState(SEED_STAGE), 'right')

    expect(state.carrying).toBe('seed')
    expect(state.seeds).toEqual([])
    expect(events).toEqual([
      { type: 'moved', from: { x: 0, y: 1 }, to: { x: 1, y: 1 } },
      { type: 'pickedUp', at: { x: 1, y: 1 }, item: 'seed' },
    ])
  })

  it('무언가 든 채 바닥의 씨앗 칸에 들어가면 줍지 않고 지나간다', () => {
    const stage: Stage = {
      ...SEED_STAGE,
      entities: [
        { type: 'seed', x: 1, y: 1 },
        { type: 'seed', x: 2, y: 1 },
      ],
    }
    const seed = play(stage, ['right', 'right'])
    const ladder = move({ ...createState(SEED_STAGE), carrying: 'ladder' }, 'right')

    expect(seed.state.carrying).toBe('seed')
    expect(seed.state.seeds).toEqual([{ x: 2, y: 1 }])
    expect(seed.events).toEqual([{ type: 'moved', from: { x: 1, y: 1 }, to: { x: 2, y: 1 } }])
    expect(ladder.state.carrying).toBe('ladder')
    expect(ladder.state.seeds).toEqual([{ x: 1, y: 1 }])
    expect(ladder.events).toEqual([{ type: 'moved', from: { x: 0, y: 1 }, to: { x: 1, y: 1 } }])
  })

  it('씨앗을 든 채 바닥의 사다리 칸에 들어가면 사다리를 줍지 않는다', () => {
    const stage: Stage = { ...SEED_STAGE, entities: [{ type: 'ladder', x: 1, y: 1 }] }
    const { state } = move({ ...createState(stage), carrying: 'seed' }, 'right')

    expect(state.carrying).toBe('seed')
    expect(state.ladders).toEqual([{ x: 1, y: 1 }])
  })

  it('씨앗을 든 채 사다리를 타고 내려오면 사다리를 두고 내려온다', () => {
    const state = holding(
      {},
      { player: { x: 2, y: 1 }, leaningLadders: [{ x: 1, y: 1, direction: 'right' }] },
    )
    const { state: down } = move(state, 'left')

    expect(down.player).toEqual({ x: 1, y: 1 })
    expect(down.carrying).toBe('seed')
    expect(down.leaningLadders).toEqual([{ x: 1, y: 1, direction: 'right' }])
  })

  it('들고 있을 때 한 층 높은 칸 쪽으로 밀면 발밑에 심는다', () => {
    const { state, events } = play(SEED_STAGE, PLANT)

    expect(state.player).toEqual({ x: 2, y: 1 })
    expect(state.carrying).toBeNull()
    expect(state.moves).toBe(3)
    expect(state.planted).toEqual([{ x: 2, y: 1, left: 4, rises: 0 }])
    expect(heightAt(state, { x: 2, y: 1 })).toBe(0)
    expect(events).toEqual([{ type: 'planted', at: { x: 2, y: 1 }, direction: 'right' }])
  })

  it('두 층 높은 칸 쪽으로는 심지 않는다', () => {
    const state = holding({
      heights: [
        [0, 1, 0],
        [0, 0, 2],
        [0, 0, 0],
      ],
    })
    const result = move(state, 'right')

    expect(result.state).toBe(state)
    expect(result.events).toEqual([{ type: 'blocked', direction: 'right' }])
  })

  it('아무것도 없는 기본 바닥이 아니면 심지 못한다', () => {
    const tram: Entity = {
      type: 'tram',
      id: 't',
      level: 0,
      dir: 1,
      x: 1,
      y: 1,
      cells: [
        { x: 1, y: 1 },
        { x: 1, y: 2 },
      ],
    }
    const vine: Entity = { type: 'vine', id: 'v', x: 1, y: 1, cells: [{ x: 0, y: 1 }] }
    const door: Entity = { type: 'door', id: 'd', x: 0, y: 2 }
    const cases: { name: string; stage?: Partial<Stage>; state?: Partial<GameState> }[] = [
      { name: '얼음', stage: { ice: ['...', '.#.', '...'] } },
      { name: '늪', stage: { swamp: ['...', '.#.', '...'] } },
      { name: '버섯', stage: { mushroom: ['...', '.#.', '...'] } },
      { name: '무너지는 칸', stage: { cracks: ['...', '.3.', '...'] } },
      { name: '구멍', stage: { goal: { x: 1, y: 1 } } },
      { name: '스위치', stage: { entities: [{ type: 'switch', target: 'd', x: 1, y: 1 }, door] } },
      { name: '문', stage: { entities: [{ ...door, x: 1, y: 1 }] } },
      { name: '엘리베이터 발판', stage: { entities: [{ type: 'lift', id: 'l', x: 1, y: 1 }] } },
      {
        name: '짝 칸',
        stage: {
          entities: [
            { type: 'warp', id: 'w', x: 1, y: 1 },
            { type: 'warp', id: 'w', x: 0, y: 2 },
          ],
        },
      },
      {
        name: '덩굴 뿌리',
        stage: {
          entities: [vine],
          heights: [
            [0, 1, 0],
            [-1, 0, 1],
            [0, 0, 0],
          ],
        },
      },
      {
        name: '발판 길',
        stage: {
          entities: [tram],
          heights: [
            [0, 1, 0],
            [0, -1, 1],
            [0, -1, 0],
          ],
        },
      },
      { name: '바닥 사다리', state: { ladders: [{ x: 1, y: 1 }] } },
      { name: '바닥 씨앗', state: { seeds: [{ x: 1, y: 1 }] } },
      {
        name: '상자로 메운 구덩이',
        stage: {
          heights: [
            [0, 1, 0],
            [0, -1, 1],
            [0, 0, 0],
          ],
        },
        state: {
          heights: [
            [0, 1, 0],
            [0, 0, 1],
            [0, 0, 0],
          ],
        },
      },
    ]

    for (const { name, stage, state } of cases) {
      const { state: after } = move(holding(stage, state), 'right')

      expect(after.planted, name).toEqual([])
      expect(after.carrying, name).toBe('seed')
    }
  })

  it('심지 못하는 칸이면 그 수는 막힌다', () => {
    const state = holding({ ice: ['...', '.#.', '...'] })
    const result = move(state, 'right')

    expect(result.state).toBe(state)
    expect(result.events).toEqual([{ type: 'blocked', direction: 'right' }])
  })

  it('상자 위에서는 심지 않는다', () => {
    const state = holding(
      {
        heights: [
          [0, 1, 0],
          [0, 0, 2],
          [0, 0, 0],
        ],
      },
      { boxes: [{ x: 1, y: 1 }] },
    )
    const result = move(state, 'right')

    expect(result.state).toBe(state)
  })

  it('높이와 상관없이 기본 바닥이면 심는다', () => {
    const state = holding({
      heights: [
        [0, 1, 0],
        [0, 2, 3],
        [0, 0, 0],
      ],
    })
    const { state: after } = move(state, 'right')

    expect(after.planted).toEqual([{ x: 1, y: 1, left: 4, rises: 0 }])
  })

  it('심은 뒤 네 번째 수가 끝날 때 그 칸이 한 층 솟는다', () => {
    const planted = play(SEED_STAGE, PLANT)
    const one = move(planted.state, 'down')
    const two = move(one.state, 'up')
    const three = move(two.state, 'left')
    const four = move(three.state, 'left')

    expect(one.state.planted).toEqual([{ x: 2, y: 1, left: 3, rises: 0 }])
    expect(one.events).toContainEqual({ type: 'seedTicked', at: { x: 2, y: 1 }, left: 3 })
    expect(two.events).toContainEqual({ type: 'seedTicked', at: { x: 2, y: 1 }, left: 2 })
    expect(three.events).toContainEqual({ type: 'seedTicked', at: { x: 2, y: 1 }, left: 1 })
    expect(heightAt(three.state, { x: 2, y: 1 })).toBe(0)

    expect(heightAt(four.state, { x: 2, y: 1 })).toBe(1)
    expect(four.state.planted).toEqual([])
    expect(four.events).toContainEqual({
      type: 'rose',
      at: { x: 2, y: 1 },
      height: 1,
      lifted: [],
      growing: false,
    })
    expect(four.events.some((e) => e.type === 'seedTicked')).toBe(false)
  })

  it('벽에 막힌 수는 세지 않는다', () => {
    const planted = play(SEED_STAGE, PLANT)
    const blocked = move(planted.state, 'right')

    expect(blocked.state).toBe(planted.state)
    expect(blocked.state.planted).toEqual([{ x: 2, y: 1, left: 4, rises: 0 }])
  })

  it('늪에서 버둥거린 수도 한 수로 센다', () => {
    const stage: Stage = { ...SEED_STAGE, swamp: ['......', '......', '..#...'] }
    const struggled = play(stage, [...PLANT, 'down', 'up', 'up'])
    const { state } = move(struggled.state, 'left')

    expect(struggled.state.player).toEqual({ x: 2, y: 2 })
    expect(struggled.state.struggles).toBe(2)
    expect(struggled.state.planted).toEqual([{ x: 2, y: 1, left: 1, rises: 0 }])
    expect(heightAt(state, { x: 2, y: 1 })).toBe(1)
  })

  it('솟을 때 위에 놓인 상자가 같이 올라간다', () => {
    const stage: Stage = { ...SEED_STAGE, entities: [{ type: 'box', x: 1, y: 1 }] }
    const state: GameState = {
      ...createState(stage),
      planted: [{ x: 2, y: 1, left: 1, rises: 0 }],
    }
    const { state: after, events } = move(state, 'right')

    expect(after.boxes).toEqual([{ x: 2, y: 1 }])
    expect(heightAt(after, { x: 2, y: 1 })).toBe(1)
    expect(standHeight(after, { x: 2, y: 1 })).toBe(2)
    expect(events).toContainEqual({
      type: 'rose',
      at: { x: 2, y: 1 },
      height: 1,
      lifted: ['box'],
      growing: false,
    })
  })

  it('심은 씨앗은 다시 줍지 못한다', () => {
    const { state } = play(SEED_STAGE, [...PLANT, 'left', 'right'])

    expect(state.player).toEqual({ x: 2, y: 1 })
    expect(state.carrying).toBeNull()
    expect(state.planted).toEqual([{ x: 2, y: 1, left: 2, rises: 0 }])
  })

  it('솟은 땅에 또 심으면 두 층이 된다', () => {
    const stage: Stage = {
      ...SEED_STAGE,
      heights: [
        [0, 0, 2, 0, 0, 0],
        [0, 0, 0, 1, 0, 0],
        [0, 0, 0, 1, 0, 0],
      ],
    }
    const risen = play(stage, [...PLANT, 'down', 'up', 'left', 'left']).state
    const onTop: GameState = { ...risen, player: { x: 2, y: 1 }, carrying: 'seed' }
    const planted = move(onTop, 'up')
    const { state } = [...['down', 'left', 'up', 'left']].reduce<MoveResult>(
      (result, d) => move(result.state, d as Direction),
      planted,
    )

    expect(planted.state.planted).toEqual([{ x: 2, y: 1, left: 4, rises: 0 }])
    expect(heightAt(state, { x: 2, y: 1 })).toBe(2)
  })

  it('심은 칸에서는 사다리를 놓지 못하고 씨앗을 겹쳐 심지 못한다', () => {
    const planted = [{ x: 1, y: 1, left: 2, rises: 0 }]
    const ladder = move(holding({}, { planted, carrying: 'ladder' }), 'right')
    const seed = move(holding({}, { planted }), 'right')

    expect(ladder.state.leaningLadders).toEqual([])
    expect(ladder.events).toEqual([{ type: 'blocked', direction: 'right' }])
    expect(seed.state.planted).toEqual(planted)
    expect(seed.events).toEqual([{ type: 'blocked', direction: 'right' }])
  })

  it('심은 칸에 기대어 사다리를 놓지 못한다', () => {
    const planted = [{ x: 2, y: 1, left: 2, rises: 0 }]
    const { state, events } = move(holding({}, { carrying: 'ladder', planted }), 'right')

    expect(state.leaningLadders).toEqual([])
    expect(events).toEqual([{ type: 'blocked', direction: 'right' }])
  })

  it('사다리의 발치에도 사다리가 기댄 칸에도 심지 못한다', () => {
    const foot = holding({}, { leaningLadders: [{ x: 1, y: 1, direction: 'up' }] })
    const top = holding(
      {
        heights: [
          [0, 0, 0, 0],
          [0, 0, 1, 2],
          [0, 0, 0, 0],
        ],
      },
      { player: { x: 2, y: 1 }, leaningLadders: [{ x: 1, y: 1, direction: 'right' }] },
    )

    expect(move(foot, 'right').events).toEqual([{ type: 'blocked', direction: 'right' }])
    expect(move(top, 'right').events).toEqual([{ type: 'blocked', direction: 'right' }])
  })

  it('상자를 바닥의 씨앗 칸으로 밀지 못해 상자 위로 올라간다', () => {
    const stage: Stage = {
      ...SEED_STAGE,
      entities: [
        { type: 'box', x: 1, y: 1 },
        { type: 'seed', x: 2, y: 1 },
      ],
    }
    const { state, events } = move(createState(stage), 'right')

    expect(events[0].type).toBe('climbed')
    expect(state.seeds).toEqual([{ x: 2, y: 1 }])
  })

  it('상자를 심은 칸으로는 민다', () => {
    const stage: Stage = { ...SEED_STAGE, entities: [{ type: 'box', x: 1, y: 1 }] }
    const state: GameState = {
      ...createState(stage),
      planted: [{ x: 2, y: 1, left: 4, rises: 0 }],
    }

    expect(move(state, 'right').state.boxes).toEqual([{ x: 2, y: 1 }])
  })
})

describe('move 콩나무', () => {
  // 심은 칸에 상자를 밀어 올린 뒤 위아래로 오가며 수를 센다
  const BEAN: Stage = {
    ...SEED_STAGE,
    rules: { seedGrow: true },
    entities: [{ type: 'box', x: 1, y: 1 }],
  }
  const start: GameState = {
    ...createState(BEAN),
    planted: [{ x: 2, y: 1, left: 4, rises: 0 }],
  }
  const after = (count: number, from = start) =>
    Array.from({ length: count - 1 }, (_, i): Direction => (i % 2 === 0 ? 'up' : 'down')).reduce(
      (result, d) => move(result.state, d),
      move(from, 'right'),
    )
  const roseAt = (count: number) => after(count).events.find((e) => e.type === 'rose')

  it('솟은 칸이 4수마다 한 층씩 솟아 세 층에서 멈춘다', () => {
    expect(heightAt(after(4).state, { x: 2, y: 1 })).toBe(1)
    expect(after(4).state.planted).toEqual([{ x: 2, y: 1, left: 4, rises: 1 }])
    expect(heightAt(after(7).state, { x: 2, y: 1 })).toBe(1)
    expect(heightAt(after(8).state, { x: 2, y: 1 })).toBe(2)
    expect(heightAt(after(12).state, { x: 2, y: 1 })).toBe(3)
    expect(after(12).state.planted).toEqual([])
    expect(heightAt(after(20).state, { x: 2, y: 1 })).toBe(3)
  })

  it('솟을 때마다 위의 상자가 같이 올라간다', () => {
    const rose = (height: number, growing: boolean) => ({
      type: 'rose',
      at: { x: 2, y: 1 },
      height,
      lifted: ['box'],
      growing,
    })

    expect(roseAt(4)).toEqual(rose(1, true))
    expect(roseAt(8)).toEqual(rose(2, true))
    expect(roseAt(12)).toEqual(rose(3, false))
    expect(standHeight(after(12).state, { x: 2, y: 1 })).toBe(4)
  })

  it('콩나무가 아니면 한 층 솟고 끝난다', () => {
    const plain: GameState = { ...start, stage: { ...BEAN, rules: undefined } }
    const { state } = after(9, plain)

    expect(heightAt(state, { x: 2, y: 1 })).toBe(1)
    expect(state.planted).toEqual([])
  })
})

describe('move 씨앗 올라타기', () => {
  it('평지에서 옆 칸을 두 번 오가면 네 번째 수에 올라선 채 같이 솟는다', () => {
    const planted = play(SEED_STAGE, PLANT)
    const one = move(planted.state, 'left')
    const two = move(one.state, 'right')
    const three = move(two.state, 'left')
    const four = move(three.state, 'right')

    expect(one.events).toContainEqual({ type: 'seedTicked', at: { x: 2, y: 1 }, left: 3 })
    expect(two.events).toContainEqual({ type: 'seedTicked', at: { x: 2, y: 1 }, left: 2 })
    expect(three.events).toContainEqual({ type: 'seedTicked', at: { x: 2, y: 1 }, left: 1 })
    expect(four.state.player).toEqual({ x: 2, y: 1 })
    expect(standHeight(four.state, four.state.player)).toBe(1)
    expect(four.events).toContainEqual({
      type: 'rose',
      at: { x: 2, y: 1 },
      height: 1,
      lifted: ['player'],
      growing: false,
    })
  })

  it('콩나무에서 기둥 옆에 같은 높이의 땅이 있으면 오가며 세 층까지 타고 오른다', () => {
    // (1, 1)에 심고 아래 땅, 오른쪽 한 층, 위쪽 두 층, 왼쪽 세 층을 차례로 오간다
    const stage: Stage = {
      ...SEED_STAGE,
      heights: [
        [0, 2, 0],
        [3, 0, 1],
        [0, 0, 0],
      ],
      start: { x: 0, y: 2 },
      goal: { x: 2, y: 0 },
      entities: [{ type: 'seed', x: 1, y: 2 }],
      rules: { seedGrow: true },
    }
    const P = { x: 1, y: 1 }
    const planted = play(stage, ['right', 'up', 'right'])
    const run = (from: GameState, directions: Direction[]) =>
      directions.reduce<MoveResult>((result, d) => move(result.state, d), {
        state: from,
        events: [],
      })
    const first = run(planted.state, ['down', 'up', 'down', 'up'])
    const second = run(first.state, ['right', 'left', 'right', 'left'])
    const third = run(second.state, ['up', 'down', 'up', 'down'])
    const off = move(third.state, 'left')

    expect(planted.state.planted).toEqual([{ ...P, left: 4, rises: 0 }])
    expect(first.state.player).toEqual(P)
    expect(standHeight(first.state, P)).toBe(1)
    expect(second.state.player).toEqual(P)
    expect(standHeight(second.state, P)).toBe(2)
    expect(third.state.player).toEqual(P)
    expect(standHeight(third.state, P)).toBe(3)
    expect(third.events).toContainEqual({
      type: 'rose',
      at: P,
      height: 3,
      lifted: ['player'],
      growing: false,
    })
    expect(off.state.player).toEqual({ x: 0, y: 1 })
  })
})
