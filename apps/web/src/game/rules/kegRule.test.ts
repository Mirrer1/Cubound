import { describe, expect, it } from 'vitest'

import type { Direction, GameEvent, GameState, Point, Stage } from '../types'
import { move } from './moveRule'
import { createState, standHeight } from './stateRule'

// 화약통 (2,1), 큐브는 (0,1)에서 오른쪽으로 밀기
const PUSH_STAGE: Stage = {
  version: 1,
  id: 'test-keg',
  name: '화약통 테스트',
  heights: [
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
  ],
  start: { x: 1, y: 1 },
  goal: { x: 4, y: 0 },
  entities: [{ type: 'keg', x: 2, y: 1 }],
}

// 화약통 (2,1) 둘레 위 두 층, 오른쪽 한 층, 아래 숯 벽, 숯 (3,2)가 타는 중이면 다음 수에 불이 (2,2)로 옴
const BLAST_STAGE: Stage = {
  version: 1,
  id: 'test-keg-blast',
  name: '폭발 테스트',
  heights: [
    [1, 1, 2, 0, 0],
    [1, 1, 0, 1, 0],
    [0, 0, 0, 0, 0],
  ],
  fire: ['.....', '.....', '..##.'],
  start: { x: 1, y: 0 },
  goal: { x: 4, y: 0 },
  entities: [{ type: 'keg', x: 2, y: 1 }],
}

// BLAST_STAGE에서 (3,1)을 낮춰 화약통 둘이 같은 높이, 둘째 화약통 오른쪽 (4,1)은 한 층
const CHAIN_STAGE: Stage = {
  ...BLAST_STAGE,
  heights: [
    [1, 1, 2, 1, 0],
    [1, 1, 0, 0, 1],
    [0, 0, 0, 0, 0],
  ],
  entities: [
    { type: 'keg', x: 2, y: 1 },
    { type: 'keg', x: 3, y: 1 },
  ],
}

const FIRE_ON: Partial<GameState> = { burning: [{ x: 3, y: 2 }] }

const at = (stage: Stage, state: Partial<GameState> = {}): GameState => ({
  ...createState(stage),
  ...state,
})

const run = (state: GameState, directions: Direction[]) =>
  directions.reduce<{ state: GameState; events: GameEvent[] }>(
    (result, d) => move(result.state, d),
    { state, events: [] },
  )

const explodedOf = (events: GameEvent[]) =>
  events.flatMap((e) => (e.type === 'exploded' ? [e] : []))

const kegsOf = (state: GameState): Point[] => state.kegs.map(({ x, y }) => ({ x, y }))

describe('createState 화약통', () => {
  it('화약통 자리와 심지를 담고 심지 불은 꺼진 채 시작한다', () => {
    const state = createState({
      ...PUSH_STAGE,
      entities: [
        { type: 'keg', x: 2, y: 1 },
        { type: 'keg', x: 3, y: 2, fuse: true },
      ],
    })

    expect(state.kegs).toEqual([
      { x: 2, y: 1, fuse: false, lit: 0 },
      { x: 3, y: 2, fuse: true, lit: 0 },
    ])
  })
})

describe('move 화약통 밀기', () => {
  it('상자처럼 밀리고 밀기 횟수를 센다', () => {
    const { state, events } = move(createState(PUSH_STAGE), 'right')

    expect(kegsOf(state)).toEqual([{ x: 3, y: 1 }])
    expect(state.player).toEqual({ x: 2, y: 1 })
    expect(state.pushes).toBe(1)
    expect(events[0]).toEqual({
      type: 'kegPushed',
      from: { x: 2, y: 1 },
      to: { x: 3, y: 1 },
      result: 'slid',
    })
  })

  it('위로 올라설 수 없다', () => {
    const stage = {
      ...PUSH_STAGE,
      heights: [
        [0, 0, 0, 0, 0],
        [0, 1, 0, 0, 0],
        [0, 0, 0, 0, 0],
      ],
    }
    const { state, events } = move(createState(stage), 'right')

    expect(state.player).toEqual({ x: 1, y: 1 })
    expect(events).toEqual([{ type: 'blocked', direction: 'right' }])
  })

  it('낮은 칸으로 밀면 떨어져 낮은 땅에 선다', () => {
    const stage = {
      ...PUSH_STAGE,
      heights: [
        [1, 1, 1, 1, 1],
        [1, 1, 1, 0, 1],
        [1, 1, 1, 1, 1],
      ],
    }
    const { state, events } = move(createState(stage), 'right')

    expect(kegsOf(state)).toEqual([{ x: 3, y: 1 }])
    expect(events[0]).toMatchObject({ type: 'kegPushed', result: 'fell' })
  })

  it('구덩이 쪽으로는 막히고 구덩이를 메우지 않는다', () => {
    const stage = {
      ...PUSH_STAGE,
      heights: [
        [0, 0, 0, 0, 0],
        [0, 0, 0, -1, 0],
        [0, 0, 0, 0, 0],
      ],
    }
    const before = createState(stage)
    const { state, events } = move(before, 'right')

    expect(state).toBe(before)
    expect(events).toEqual([{ type: 'blocked', direction: 'right', pit: true }])
  })

  it('얼음 위에서는 상자처럼 미끄러진다', () => {
    const stage = { ...PUSH_STAGE, ice: ['.....', '...#.', '.....'] }
    const { state, events } = move(createState(stage), 'right')

    expect(kegsOf(state)).toEqual([{ x: 4, y: 1 }])
    expect(events).toContainEqual({
      type: 'slid',
      subject: 'keg',
      from: { x: 3, y: 1 },
      to: { x: 4, y: 1 },
    })
  })

  it('상자와 화약통은 서로 밀어 넣을 수 없다', () => {
    const stage: Stage = {
      ...PUSH_STAGE,
      entities: [
        { type: 'keg', x: 2, y: 1 },
        { type: 'box', x: 3, y: 1 },
      ],
    }

    expect(move(createState(stage), 'right').state.player).toEqual({ x: 1, y: 1 })
    const boxFirst: Stage = {
      ...PUSH_STAGE,
      entities: [
        { type: 'box', x: 2, y: 1 },
        { type: 'keg', x: 3, y: 1 },
      ],
    }
    const climbed = move(createState(boxFirst), 'right').state
    expect(climbed.boxes).toEqual([{ x: 2, y: 1 }])
    expect(kegsOf(climbed)).toEqual([{ x: 3, y: 1 }])
  })

  it('스위치를 누르고 무너지는 칸을 닳게 한다', () => {
    const stage: Stage = {
      ...PUSH_STAGE,
      cracks: ['.....', '..2..', '.....'],
      entities: [
        { type: 'keg', x: 2, y: 1 },
        { type: 'switch', x: 3, y: 1, target: 'a' },
        { type: 'door', x: 4, y: 2, id: 'a' },
      ],
    }
    const { state, events } = move(createState(stage), 'right')

    expect(events).toContainEqual({ type: 'door', id: 'a', open: true })
    expect(state.cracks).toEqual([{ x: 2, y: 1, left: 1 }])
  })
})

describe('move 화약통 폭발', () => {
  it('맞닿은 칸에 불이 오면 그 수에 터져 둘레를 한 층씩 깎는다', () => {
    const { state, events } = move(at(BLAST_STAGE, FIRE_ON), 'left')

    expect(state.kegs).toEqual([])
    expect(state.heights[0][2]).toBe(1)
    expect(state.heights[1][3]).toBe(0)
    expect(state.heights[1][1]).toBe(0)
    expect(explodedOf(events)).toEqual([
      {
        type: 'exploded',
        at: { x: 2, y: 1 },
        lowered: [
          { x: 2, y: 0 },
          { x: 3, y: 1 },
          { x: 1, y: 1 },
        ],
        caught: [],
      },
    ])
  })

  it('터진 화약통 자리를 남긴다', () => {
    const { state } = move(at(BLAST_STAGE, FIRE_ON), 'left')

    expect(state.scorched).toEqual([{ x: 2, y: 1 }])
  })

  it('연쇄로 터진 화약통 자리도 모두 남긴다', () => {
    const stage: Stage = {
      ...CHAIN_STAGE,
      entities: [
        { type: 'keg', x: 2, y: 1 },
        { type: 'keg', x: 3, y: 1 },
      ],
    }
    const { state } = move(at(stage, FIRE_ON), 'left')

    expect(state.scorched).toEqual([
      { x: 2, y: 1 },
      { x: 3, y: 1 },
    ])
  })

  it('평지와 터진 자리 높이는 그대로다', () => {
    const stage: Stage = {
      ...BLAST_STAGE,
      heights: [
        [1, 1, 2, 0, 0],
        [1, 0, 1, 1, 0],
        [0, 0, 1, 1, 0],
      ],
    }
    const { state, events } = move(at(stage, FIRE_ON), 'left')

    expect(state.heights[1][1]).toBe(0)
    expect(state.heights[1][2]).toBe(1)
    expect(explodedOf(events)[0].lowered).not.toContainEqual({ x: 1, y: 1 })
  })

  it('이번 수에 재가 되는 숯 옆으로 밀어 넣어도 터진다', () => {
    const stage: Stage = { ...PUSH_STAGE, fire: ['.....', '.....', '...#.'] }
    const { state, events } = move(at(stage, { burning: [{ x: 3, y: 2 }] }), 'right')

    expect(state.kegs).toEqual([])
    expect(explodedOf(events)).toHaveLength(1)
  })

  it('이번 수에 재가 되어 꺼진 숯 다리 옆으로 밀어 넣어도 터진다', () => {
    const stage: Stage = { ...PUSH_STAGE, fire: ['.....', '.....', '...=.'] }
    const { events } = move(at(stage, { burning: [{ x: 3, y: 2 }] }), 'right')

    expect(explodedOf(events)).toHaveLength(1)
  })

  it('켜진 불씨 칸 옆 화약통이 터진다', () => {
    const stage: Stage = { ...PUSH_STAGE, fire: ['..*..', '.....', '.....'], start: { x: 1, y: 0 } }
    const { events } = move(createState(stage), 'right')

    expect(explodedOf(events)).toHaveLength(1)
  })

  it('같은 높이 둘레의 숯은 깎이지 않고 불이 붙는다', () => {
    const stage: Stage = {
      ...BLAST_STAGE,
      heights: [
        [1, 1, 1, 0, 0],
        [1, 1, 1, 1, 0],
        [0, 0, 1, 1, 0],
      ],
      fire: ['..#..', '.....', '..##.'],
    }
    const { state, events } = move(at(stage, FIRE_ON), 'left')

    expect(state.heights[0][2]).toBe(1)
    expect(state.burning).toContainEqual({ x: 2, y: 0 })
    expect(explodedOf(events)[0].caught).toEqual([{ x: 2, y: 0 }])
  })

  it('높이가 다른 둘레의 숯은 불도 안 붙고 깎이지도 않는다', () => {
    const stage: Stage = { ...BLAST_STAGE, fire: ['..#..', '.....', '..##.'] }
    const { state, events } = move(at(stage, FIRE_ON), 'left')

    expect(state.heights[0][2]).toBe(2)
    expect(state.burning).not.toContainEqual({ x: 2, y: 0 })
    expect(explodedOf(events)[0].caught).toEqual([])
  })

  it.each([
    ['한 층 높은', 1, 0],
    ['한 층 낮은', 0, 1],
  ])('%s 칸의 숯불은 화약통을 터뜨리지 않는다', (_, keg, fire) => {
    const stage: Stage = {
      ...BLAST_STAGE,
      heights: [
        [1, 1, 2, 0, 0],
        [1, 1, keg, 1, 0],
        [0, 0, fire, fire, 0],
      ],
    }
    const { state, events } = move(at(stage, FIRE_ON), 'left')

    expect(explodedOf(events)).toEqual([])
    expect(kegsOf(state)).toEqual([{ x: 2, y: 1 }])
  })

  it('상자가 선 칸은 상자째 한 층 내려앉는다', () => {
    const stage: Stage = {
      ...BLAST_STAGE,
      entities: [
        { type: 'keg', x: 2, y: 1 },
        { type: 'box', x: 3, y: 1 },
      ],
    }
    const { state } = move(at(stage, FIRE_ON), 'left')

    expect(state.heights[1][3]).toBe(0)
    expect(state.boxes).toEqual([{ x: 3, y: 1 }])
  })

  it('같은 높이 둘레의 화약통은 같은 수에 이어서 터진다', () => {
    const { state, events } = move(at(CHAIN_STAGE, FIRE_ON), 'left')

    expect(state.kegs).toEqual([])
    expect(explodedOf(events).map((e) => e.at)).toEqual([
      { x: 2, y: 1 },
      { x: 3, y: 1 },
    ])
    expect(state.heights[1][3]).toBe(0)
    expect(state.heights[0][3]).toBe(0)
    expect(state.heights[1][4]).toBe(0)
  })

  it('한 층 높은 둘레의 화약통은 안 터지고 칸과 같이 한 층 내려앉는다', () => {
    const stage: Stage = {
      ...BLAST_STAGE,
      entities: [
        { type: 'keg', x: 2, y: 1 },
        { type: 'keg', x: 3, y: 1 },
      ],
    }
    const { state, events } = move(at(stage, FIRE_ON), 'left')

    expect(explodedOf(events).map((e) => e.at)).toEqual([{ x: 2, y: 1 }])
    expect(kegsOf(state)).toEqual([{ x: 3, y: 1 }])
    expect(state.heights[1][3]).toBe(0)
  })

  it('한 층 낮은 둘레의 화약통은 안 터진다', () => {
    const stage: Stage = {
      ...CHAIN_STAGE,
      heights: [
        [1, 1, 2, 1, 0],
        [1, 1, 1, 0, 1],
        [0, 0, 1, 1, 0],
      ],
    }
    const { state, events } = move(at(stage, FIRE_ON), 'left')

    expect(explodedOf(events).map((e) => e.at)).toEqual([{ x: 2, y: 1 }])
    expect(kegsOf(state)).toEqual([{ x: 3, y: 1 }])
  })

  it('두 화약통 둘레가 겹치는 칸은 두 층 깎인다', () => {
    const stage: Stage = {
      ...BLAST_STAGE,
      heights: [
        [1, 1, 2, 2, 0],
        [1, 1, 0, 2, 0],
        [0, 0, 0, 0, 0],
      ],
      entities: [
        { type: 'keg', x: 2, y: 1 },
        { type: 'keg', x: 4, y: 1 },
      ],
      fire: ['.....', '.....', '..###'],
    }
    const { state } = move(at(stage, FIRE_ON), 'left')

    expect(state.heights[1][3]).toBe(0)
  })

  it('엘리베이터 발판은 내려간 높이와 올라간 높이가 함께 한 층 낮아진다', () => {
    const stage: Stage = {
      ...BLAST_STAGE,
      entities: [
        { type: 'keg', x: 2, y: 1 },
        { type: 'lift', x: 3, y: 1, id: 'a' },
        { type: 'switch', x: 0, y: 0, target: 'a' },
      ],
    }
    const blasted = move(at(stage, FIRE_ON), 'left').state

    expect(standHeight(blasted, { x: 3, y: 1 })).toBe(1)
    expect(standHeight({ ...blasted, player: { x: 4, y: 1 } }, { x: 3, y: 1 })).toBe(0)
  })

  it('짝 칸은 한쪽만 낮아지고 순간이동은 나올 칸 높이에 선다', () => {
    const stage: Stage = {
      version: 1,
      id: 'test-keg-warp',
      heights: [
        [1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1],
      ],
      start: { x: 1, y: 0 },
      goal: { x: 4, y: 0 },
      entities: [
        { type: 'keg', x: 2, y: 0 },
        { type: 'warp', x: 2, y: 1, id: 'a' },
        { type: 'warp', x: 4, y: 2, id: 'a' },
      ],
    }
    const blasted = move(at(stage, { flame: 4 }), 'right').state

    expect(blasted.heights[1][2]).toBe(0)
    expect(blasted.heights[2][4]).toBe(1)

    const over = run(blasted, ['down', 'right', 'right'])
    expect(over.state.player).toEqual({ x: 4, y: 2 })
    expect(standHeight(over.state, over.state.player)).toBe(1)

    const back = move(move(over.state, 'up').state, 'down')
    expect(back.state.player).toEqual({ x: 2, y: 1 })
    expect(standHeight(back.state, back.state.player)).toBe(0)
  })
})

describe('move 폭발에 밀리는 큐브', () => {
  it('큐브가 선 칸도 깎이고 큐브는 화약통 반대쪽으로 한 칸 밀린다', () => {
    const { state, events } = move(at(BLAST_STAGE, FIRE_ON), 'down')

    expect(state.player).toEqual({ x: 0, y: 1 })
    expect(state.heights[1][1]).toBe(0)
    expect(state.moves).toBe(1)
    expect(events).toContainEqual({
      type: 'blasted',
      from: { x: 1, y: 1 },
      to: { x: 0, y: 1 },
      direction: 'left',
    })
    expect(explodedOf(events)[0].lowered).toContainEqual({ x: 1, y: 1 })
  })

  it('밀릴 자리가 벽이면 버티고 그 칸은 안 깎인다', () => {
    const stage: Stage = {
      ...BLAST_STAGE,
      heights: [
        [1, 1, 2, 0, 0],
        [2, 1, 0, 1, 0],
        [0, 0, 0, 0, 0],
      ],
    }
    const { state, events } = move(at(stage, FIRE_ON), 'down')

    expect(state.player).toEqual({ x: 1, y: 1 })
    expect(state.heights[1][1]).toBe(1)
    expect(events).toContainEqual({ type: 'blastBraced', direction: 'left' })
  })

  it('밀릴 자리가 상자나 허공이어도 버틴다', () => {
    const boxed: Stage = {
      ...BLAST_STAGE,
      entities: [
        { type: 'keg', x: 2, y: 1 },
        { type: 'box', x: 0, y: 1 },
      ],
    }
    expect(move(at(boxed, FIRE_ON), 'down').state.player).toEqual({ x: 1, y: 1 })

    const pit: Stage = {
      ...BLAST_STAGE,
      heights: [
        [1, 1, 2, 0, 0],
        [-1, 1, 0, 1, 0],
        [0, 0, 0, 0, 0],
      ],
    }
    expect(move(at(pit, FIRE_ON), 'down').state.player).toEqual({ x: 1, y: 1 })
  })

  it('평지에 서 있어도 밀리고 낮은 칸으로는 떨어진다', () => {
    const stage: Stage = {
      ...BLAST_STAGE,
      heights: [
        [0, 0, 2, 0, 0],
        [0, 0, 0, 1, 0],
        [0, 0, 0, 0, 0],
      ],
      start: { x: 1, y: 2 },
    }
    const flat = move(at(stage, FIRE_ON), 'up').state
    expect(flat.player).toEqual({ x: 0, y: 1 })

    const ledge: Stage = {
      ...BLAST_STAGE,
      heights: [
        [2, 2, 2, 0, 0],
        [0, 2, 0, 1, 0],
        [0, 0, 0, 0, 0],
      ],
    }
    const { state, events } = move(at(ledge, FIRE_ON), 'down')
    expect(state.player).toEqual({ x: 0, y: 1 })
    expect(events).toContainEqual({
      type: 'fell',
      from: { x: 1, y: 1 },
      to: { x: 0, y: 1 },
      drop: 2,
    })
  })

  it('불 붙은 큐브가 밀면 화약통은 제자리에서 터지고 큐브는 뒤로 밀린다', () => {
    const { state, events } = move(at(PUSH_STAGE, { flame: 4 }), 'right')

    expect(state.kegs).toEqual([])
    expect(state.player).toEqual({ x: 0, y: 1 })
    expect(state.pushes).toBe(0)
    expect(state.moves).toBe(1)
    expect(events[0]).toEqual({ type: 'torchedKeg', from: { x: 1, y: 1 }, to: { x: 2, y: 1 } })
    expect(explodedOf(events)[0].at).toEqual({ x: 2, y: 1 })
  })

  it('폭발은 큐브에 불을 붙이지 않는다', () => {
    const { state } = move(at(BLAST_STAGE, FIRE_ON), 'down')

    expect(state.flame).toBe(0)
  })
})

describe('move 심지 화약통', () => {
  const FUSE_STAGE: Stage = { ...PUSH_STAGE, entities: [{ type: 'keg', x: 2, y: 1, fuse: true }] }

  it('불이 닿으면 심지에 불이 붙고 4수 뒤에 터진다', () => {
    const lit = move(at(FUSE_STAGE, { flame: 4 }), 'right')

    expect(lit.state.kegs).toEqual([{ x: 2, y: 1, fuse: true, lit: 4 }])
    expect(lit.state.player).toEqual({ x: 1, y: 1 })
    expect(lit.events).toContainEqual({ type: 'fuseLit', at: { x: 2, y: 1 } })

    const three = run(lit.state, ['up', 'down', 'up'])
    expect(three.state.kegs).toEqual([{ x: 2, y: 1, fuse: true, lit: 1 }])
    expect(three.events).toContainEqual({ type: 'fuseTicked', at: { x: 2, y: 1 }, left: 1 })

    const fourth = move(three.state, 'down')
    expect(fourth.state.kegs).toEqual([])
    expect(explodedOf(fourth.events)).toHaveLength(1)
  })

  it('심지가 타는 동안 밀고 다닐 수 있다', () => {
    const lit = move(at(FUSE_STAGE, { flame: 4 }), 'right').state
    const { state } = move({ ...lit, flame: 0 }, 'right')

    expect(state.kegs).toEqual([{ x: 3, y: 1, fuse: true, lit: 3 }])
  })

  it('폭발 둘레의 심지 화약통은 바로 터진다', () => {
    const stage: Stage = {
      ...CHAIN_STAGE,
      entities: [
        { type: 'keg', x: 2, y: 1 },
        { type: 'keg', x: 3, y: 1, fuse: true },
      ],
    }
    const { state, events } = move(at(stage, FIRE_ON), 'left')

    expect(state.kegs).toEqual([])
    expect(explodedOf(events)).toHaveLength(2)
  })
})
