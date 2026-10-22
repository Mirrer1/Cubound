import { describe, expect, it } from 'vitest'

import type { Bar, Direction, GameEvent, GameState, Point, Stage } from '../types'
import { barCells } from './cellRule'
import { move } from './moveRule'
import { createState, rawHeight, standHeight } from './stateRule'

// 막대 (2,2)-(3,2), 큐브는 (1,2)
const BAR_STAGE: Stage = {
  version: 1,
  id: 'test-bar',
  name: '막대 테스트',
  heights: [
    [0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0],
  ],
  start: { x: 1, y: 2 },
  goal: { x: 6, y: 4 },
  entities: [{ type: 'bar', x: 2, y: 2, axis: 'x' }],
}

const withRow = (y: number, row: number[]): number[][] =>
  BAR_STAGE.heights.map((r, i) => (i === y ? row : r))

const at = (stage: Stage, state: Partial<GameState> = {}): GameState => ({
  ...createState(stage),
  ...state,
})

const run = (state: GameState, directions: Direction[]) =>
  directions.reduce<{ state: GameState; events: GameEvent[] }>(
    (result, d) => move(result.state, d),
    { state, events: [] },
  )

const sorted = (list: Point[]) =>
  [...list].sort((a, b) => a.y - b.y || a.x - b.x).map(({ x, y }) => ({ x, y }))

const cellsOf = (state: GameState, i = 0) => sorted(barCells(state.bars[i]))

const bar = (fields: Partial<Bar>): Bar => ({
  x: 2,
  y: 2,
  dir: 'right',
  length: 2,
  level: 0,
  heat: null,
  ...fields,
})

describe('createState 막대', () => {
  it('왼쪽이나 위쪽 끝에서 두 칸 막대를 놓는다', () => {
    const state = createState({
      ...BAR_STAGE,
      entities: [
        { type: 'bar', x: 2, y: 2, axis: 'x' },
        { type: 'bar', x: 5, y: 0, axis: 'y' },
      ],
    })

    expect(state.bars).toEqual([
      bar({}),
      { x: 5, y: 0, dir: 'down', length: 2, level: 0, heat: null },
    ])
    expect(state.held).toEqual([])
  })
})

describe('move 막대 밀기', () => {
  it('길이 방향으로 밀면 한 칸 밀리고 밀기 횟수를 센다', () => {
    const { state, events } = move(createState(BAR_STAGE), 'right')

    expect(cellsOf(state)).toEqual([
      { x: 3, y: 2 },
      { x: 4, y: 2 },
    ])
    expect(state.player).toEqual({ x: 2, y: 2 })
    expect(state.pushes).toBe(1)
    expect(events[0]).toMatchObject({ type: 'barPushed', pivot: null })
  })

  it('한쪽 끝이 낮은 땅 위에 걸치게 밀리면 기울어 닿는 표시를 단다', () => {
    const stage: Stage = { ...BAR_STAGE, heights: withRow(2, [1, 1, 1, 1, 0, 0, 0]) }
    const tipped = move(createState(stage), 'right').events[0]
    const flat = move(createState(BAR_STAGE), 'right').events[0]

    expect(tipped).toMatchObject({ type: 'barPushed', tip: true })
    expect(flat).not.toHaveProperty('tip')
  })

  it('반대쪽 끝에서 길이 방향으로도 밀린다', () => {
    const start = at(BAR_STAGE, { player: { x: 4, y: 2 } })

    expect(cellsOf(move(start, 'left').state)).toEqual([
      { x: 1, y: 2 },
      { x: 2, y: 2 },
    ])
  })

  it('옆에서 한쪽 끝을 밀면 반대쪽 끝을 축으로 돈다', () => {
    const start = at(BAR_STAGE, { player: { x: 2, y: 3 } })
    const { state, events } = move(start, 'up')

    expect(cellsOf(state)).toEqual([
      { x: 3, y: 1 },
      { x: 3, y: 2 },
    ])
    expect(state.player).toEqual({ x: 2, y: 2 })
    expect(state.pushes).toBe(1)
    expect(events[0]).toMatchObject({ type: 'barPushed', pivot: { x: 3, y: 2 } })
  })

  it('쓸고 지나가는 칸이 벽이면 안 돌고 큐브는 제자리', () => {
    const stage = { ...BAR_STAGE, heights: withRow(1, [0, 0, 1, 0, 0, 0, 0]) }
    const before = at(stage, { player: { x: 2, y: 3 } })
    const { state, events } = move(before, 'up')

    expect(state).toBe(before)
    expect(events).toEqual([{ type: 'blocked', direction: 'up' }])
  })

  it('쓸고 지나가는 칸이 상자면 안 돈다', () => {
    const stage: Stage = {
      ...BAR_STAGE,
      entities: [...BAR_STAGE.entities, { type: 'box', x: 2, y: 1 }],
    }
    const before = at(stage, { player: { x: 2, y: 3 } })

    expect(move(before, 'up').state).toBe(before)
  })

  it('쓸고 지나가는 칸이 구덩이면 돈다', () => {
    const stage = { ...BAR_STAGE, heights: withRow(1, [0, 0, -1, 0, 0, 0, 0]) }
    const { state } = move(at(stage, { player: { x: 2, y: 3 } }), 'up')

    expect(cellsOf(state)).toEqual([
      { x: 3, y: 1 },
      { x: 3, y: 2 },
    ])
  })

  it('높은 칸 쪽으로는 못 민다', () => {
    const stage = { ...BAR_STAGE, heights: withRow(2, [0, 0, 0, 0, 1, 0, 0]) }
    const before = createState(stage)

    expect(move(before, 'right').state).toBe(before)
  })

  it('위로 올라설 수 없다', () => {
    const stage = { ...BAR_STAGE, heights: withRow(2, [0, 1, 0, 0, 0, 0, 0]) }
    const before = createState(stage)

    expect(move(before, 'right').state).toBe(before)
  })

  it('상자, 화약통, 다른 막대를 밀지 못한다', () => {
    const blockers: Stage['entities'] = [
      { type: 'box', x: 4, y: 2 },
      { type: 'keg', x: 4, y: 2 },
      { type: 'bar', x: 4, y: 2, axis: 'x' },
    ]
    for (const blocker of blockers) {
      const before = createState({ ...BAR_STAGE, entities: [...BAR_STAGE.entities, blocker] })
      expect(move(before, 'right').state).toBe(before)
    }
  })

  it('상자를 막대 칸으로 밀 수 없다', () => {
    const stage: Stage = {
      ...BAR_STAGE,
      entities: [...BAR_STAGE.entities, { type: 'box', x: 2, y: 3 }],
    }
    const before = at(stage, { player: { x: 2, y: 4 } })
    const { state } = move(before, 'up')

    expect(state.boxes).toEqual([{ x: 2, y: 3 }])
  })

  it('목표 칸, 닫힌 문, 숯 벽, 발판 길로는 못 민다', () => {
    const stages: Stage[] = [
      { ...BAR_STAGE, goal: { x: 4, y: 2 } },
      {
        ...BAR_STAGE,
        entities: [
          ...BAR_STAGE.entities,
          { type: 'door', x: 4, y: 2, id: 'a' },
          { type: 'switch', x: 0, y: 0, target: 'a' },
        ],
      },
      { ...BAR_STAGE, fire: ['.......', '.......', '....#..', '.......', '.......'] },
      {
        ...BAR_STAGE,
        heights: withRow(2, [0, 0, 0, 0, -1, -1, 0]),
        entities: [
          ...BAR_STAGE.entities,
          {
            type: 'tram',
            id: 't',
            x: 5,
            y: 2,
            level: 0,
            cells: [
              { x: 4, y: 2 },
              { x: 5, y: 2 },
            ],
            dir: -1,
          },
        ],
      },
    ]
    for (const stage of stages) {
      const before = createState(stage)
      expect(cellsOf(move(before, 'right').state)).toEqual(cellsOf(before))
    }
  })

  it('숯 다리 위로는 올라간다', () => {
    const stage = { ...BAR_STAGE, fire: ['.......', '.......', '....=..', '.......', '.......'] }

    expect(cellsOf(move(createState(stage), 'right').state)).toEqual([
      { x: 3, y: 2 },
      { x: 4, y: 2 },
    ])
  })
})

describe('move 막대 높이', () => {
  // (4,2)와 (5,2)가 두 칸 구덩이
  const PIT_STAGE = { ...BAR_STAGE, heights: withRow(2, [0, 0, 0, 0, -1, -1, 0]) }

  it('한 칸만 구덩이 위면 높은 쪽에 얹혀 버티고 다리가 아니다', () => {
    const { state } = move(createState(PIT_STAGE), 'right')

    expect(state.bars[0].level).toBe(0)
    // 버틴 막대는 다시 밀리고 큐브가 올라서지 않음
    const next = move(state, 'right').state
    expect(cellsOf(next)).toEqual([
      { x: 4, y: 2 },
      { x: 5, y: 2 },
    ])
    expect(next.player).toEqual({ x: 3, y: 2 })
  })

  it('두 칸이 다 구덩이 위면 다리가 되어 큐브가 건넌다', () => {
    const bridged = run(createState(PIT_STAGE), ['right', 'right', 'right']).state

    expect(bridged.player).toEqual({ x: 4, y: 2 })
    expect(standHeight(bridged, bridged.player)).toBe(0)
    expect(rawHeight(bridged, { x: 5, y: 2 })).toBe(0)
    const across = run(bridged, ['right', 'right']).state
    expect(across.player).toEqual({ x: 6, y: 2 })
    expect(cellsOf(across)).toEqual([
      { x: 4, y: 2 },
      { x: 5, y: 2 },
    ])
  })

  it('끝 너머에 받칠 땅이 없는 구덩이 위로는 못 민다', () => {
    const wide = { ...BAR_STAGE, heights: withRow(2, [0, 0, 0, 0, -1, -1, -1]) }
    const hanging = move(createState(wide), 'right').state
    const { state, events } = move(hanging, 'right')

    expect(cellsOf(state)).toEqual([
      { x: 3, y: 2 },
      { x: 4, y: 2 },
    ])
    expect(state.player).toEqual({ x: 2, y: 2 })
    expect(events).toEqual([expect.objectContaining({ type: 'blocked' })])
  })

  it('다리는 옆에서 들어가도 밀리지 않고 걸어 들어간다', () => {
    const bridged = run(createState(PIT_STAGE), ['right', 'right']).state
    const side = { ...bridged, player: { x: 4, y: 1 } }
    const { state } = move(side, 'down')

    expect(state.player).toEqual({ x: 4, y: 2 })
    expect(cellsOf(state)).toEqual(cellsOf(bridged))
  })

  it('두 칸이 다 낮은 땅 위로 가면 떨어진다', () => {
    const stage = { ...BAR_STAGE, heights: withRow(2, [1, 1, 1, 1, 0, 0, 0]) }
    const leaning = move(createState(stage), 'right').state
    expect(leaning.bars[0].level).toBe(1)

    const fell = move(leaning, 'right').state
    expect(fell.bars[0].level).toBe(0)
    // 큐브보다 낮은 막대 칸으로는 막힘
    expect(move(fell, 'right').state).toBe(fell)
  })

  it('무너지는 칸을 지나면 닳게 한다', () => {
    const stage = { ...BAR_STAGE, cracks: ['.......', '.......', '..2....', '.......', '.......'] }

    expect(move(createState(stage), 'right').state.cracks).toEqual([{ x: 2, y: 2, left: 1 }])
  })
})

describe('move 막대와 스위치', () => {
  it('한 칸이라도 걸치면 눌리고 두 칸이 각각 스위치 위면 둘 다 눌린다', () => {
    const stage: Stage = {
      ...BAR_STAGE,
      entities: [
        ...BAR_STAGE.entities,
        { type: 'switch', x: 4, y: 2, target: 'a' },
        { type: 'switch', x: 5, y: 2, target: 'b' },
        { type: 'door', x: 0, y: 0, id: 'a' },
        { type: 'door', x: 6, y: 0, id: 'b' },
      ],
    }
    const once = move(createState(stage), 'right')
    expect(once.events).toContainEqual({ type: 'door', id: 'a', open: true })

    const twice = move(once.state, 'right')
    expect(twice.events).toContainEqual({ type: 'door', id: 'b', open: true })
    expect(twice.events).not.toContainEqual({ type: 'door', id: 'a', open: false })
  })

  it('버팀 막대의 낮은 쪽 칸 밑 스위치도 눌린다', () => {
    const stage: Stage = {
      ...BAR_STAGE,
      heights: withRow(2, [1, 1, 1, 1, 0, 0, 0]),
      entities: [
        ...BAR_STAGE.entities,
        { type: 'switch', x: 4, y: 2, target: 'a' },
        { type: 'door', x: 0, y: 0, id: 'a' },
      ],
    }
    const { state, events } = move(createState(stage), 'right')

    expect(state.bars[0].level).toBe(1)
    expect(events).toContainEqual({ type: 'door', id: 'a', open: true })
  })
})

describe('move 막대와 엘리베이터 발판', () => {
  it('막대가 반만 걸친 발판은 스위치가 눌려도 제자리에 멈춘다', () => {
    const stage: Stage = {
      ...BAR_STAGE,
      start: { x: 0, y: 1 },
      entities: [
        ...BAR_STAGE.entities,
        { type: 'lift', x: 3, y: 2, id: 'a' },
        { type: 'switch', x: 0, y: 0, target: 'a' },
      ],
    }
    const { state, events } = move(createState(stage), 'up')

    expect(state.held).toEqual([{ id: 'a', up: false }])
    expect(rawHeight(state, { x: 3, y: 2 })).toBe(0)
    expect(events.some((e) => e.type === 'lift')).toBe(false)
  })

  it('두 칸 다 발판 위면 둘이 함께 움직일 때만 움직인다', () => {
    const stage: Stage = {
      ...BAR_STAGE,
      entities: [
        ...BAR_STAGE.entities,
        { type: 'lift', x: 2, y: 2, id: 'a' },
        { type: 'lift', x: 3, y: 2, id: 'b' },
        { type: 'switch', x: 1, y: 0, target: 'a' },
        { type: 'switch', x: 4, y: 0, target: 'b' },
        { type: 'box', x: 1, y: 1 },
      ],
    }
    // 상자를 스위치 a에 밀어 올리면 b가 안 움직여 둘 다 멈춤
    const one = move(createState(stage), 'up').state
    expect(one.held).toEqual([
      { id: 'a', up: false },
      { id: 'b', up: false },
    ])
    expect(one.bars[0].level).toBe(0)

    // 큐브가 스위치 b에 서면 둘이 함께 오름
    const both = run(one, ['right', 'right', 'right', 'up']).state
    expect(both.player).toEqual({ x: 4, y: 0 })
    expect(both.held).toEqual([])
    expect(both.bars[0].level).toBe(1)
  })
})

describe('move 막대와 불', () => {
  // 숯 벽 (1,1)이 타는 중, 숯 다리 (2,1)~(4,1) 위에 막대 (2,1)-(3,1)
  const FIRE_STAGE: Stage = {
    ...BAR_STAGE,
    fire: ['.......', '.#===..', '.......', '.......', '.......'],
    start: { x: 0, y: 3 },
    entities: [{ type: 'bar', x: 2, y: 1, axis: 'x' }],
  }
  const BURNING: Partial<GameState> = { burning: [{ x: 1, y: 1 }] }

  it('불은 막대를 지나 번지고 숯 다리가 다 타면 막대가 다리로 남는다', () => {
    const { state } = run(at(FIRE_STAGE, BURNING), ['right', 'left', 'right', 'left'])

    expect(state.ashes).toEqual(
      expect.arrayContaining([
        { x: 2, y: 1 },
        { x: 3, y: 1 },
        { x: 4, y: 1 },
      ]),
    )
    expect(state.heights[1].slice(2, 5)).toEqual([-1, -1, -1])
    expect(state.bars[0].level).toBe(0)
    expect(rawHeight(state, { x: 2, y: 1 })).toBe(0)
  })

  it('한 칸만 타면 높은 쪽에 얹혀 버틴다', () => {
    const stage = { ...FIRE_STAGE, fire: ['.......', '.#=....', '.......', '.......', '.......'] }
    const { state } = run(at(stage, BURNING), ['right', 'left'])

    expect(state.heights[1].slice(2, 4)).toEqual([-1, 0])
    expect(state.bars[0].level).toBe(0)
    expect(rawHeight(state, { x: 2, y: 1 })).toBe(-1)
  })
})

describe('move 막대와 화약통', () => {
  // 막대 (2,2)-(3,2)는 한 층, 위의 화약통 (2,1)과 (3,1), 숯 벽 (1,1)이 타는 중
  const KEG_STAGE: Stage = {
    ...BAR_STAGE,
    heights: BAR_STAGE.heights.map((r, y) => (y === 1 || y === 2 ? r.map(() => 1) : r)),
    fire: ['.......', '.#.....', '.......', '.......', '.......'],
    start: { x: 0, y: 4 },
    entities: [
      { type: 'bar', x: 2, y: 2, axis: 'x' },
      { type: 'keg', x: 2, y: 1 },
      { type: 'keg', x: 3, y: 1 },
    ],
  }
  const BURNING: Partial<GameState> = { burning: [{ x: 1, y: 1 }] }

  it('두 칸 다 깎이면 같이 한 층 내려앉는다', () => {
    const { state } = move(at(KEG_STAGE, BURNING), 'right')

    expect(state.heights[2].slice(2, 4)).toEqual([0, 0])
    expect(state.bars[0].level).toBe(0)
  })

  it('한 칸만 깎이면 높은 쪽에 얹혀 버틴다', () => {
    const stage: Stage = { ...KEG_STAGE, entities: KEG_STAGE.entities.slice(0, 2) }
    const { state } = move(at(stage, BURNING), 'right')

    expect(state.heights[2].slice(2, 4)).toEqual([0, 1])
    expect(state.bars[0].level).toBe(1)
  })
})

describe('move 세 칸 막대', () => {
  const LONG: Partial<GameState> = { bars: [bar({ x: 1, length: 3 })] }

  it('가운데를 옆에서 밀면 막힌다', () => {
    const before = at(BAR_STAGE, { ...LONG, player: { x: 2, y: 3 } })

    expect(move(before, 'up').state).toBe(before)
  })

  it('끝을 옆에서 밀면 반대쪽 끝을 축으로 돈다', () => {
    const { state } = move(at(BAR_STAGE, { ...LONG, player: { x: 1, y: 3 } }), 'up')

    expect(cellsOf(state)).toEqual([
      { x: 3, y: 0 },
      { x: 3, y: 1 },
      { x: 3, y: 2 },
    ])
  })

  it('쓸고 지나가는 세 칸 중 하나라도 벽이면 안 돌고 바깥 모서리는 보지 않는다', () => {
    for (const p of [
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: 2, y: 0 },
    ]) {
      const heights = BAR_STAGE.heights.map((r, y) =>
        r.map((h, x) => (x === p.x && y === p.y ? 1 : h)),
      )
      const before = at({ ...BAR_STAGE, heights }, { ...LONG, player: { x: 1, y: 3 } })
      expect(move(before, 'up').state).toBe(before)
    }
    const corner = BAR_STAGE.heights.map((r, y) => r.map((h, x) => (x === 1 && y === 0 ? 1 : h)))
    const turned = move(
      at({ ...BAR_STAGE, heights: corner }, { ...LONG, player: { x: 1, y: 3 } }),
      'up',
    )
    expect(cellsOf(turned.state)).toHaveLength(3)
    expect(turned.state.player).toEqual({ x: 1, y: 2 })
  })

  it('세 칸이 다 구덩이 위면 다리가 된다', () => {
    const stage = { ...BAR_STAGE, heights: withRow(2, [0, 0, 0, -1, -1, -1, 0]) }
    const start = at(stage, { ...LONG, player: { x: 0, y: 2 } })
    const pushed = run(start, ['right', 'right']).state

    expect(cellsOf(pushed)).toEqual([
      { x: 3, y: 2 },
      { x: 4, y: 2 },
      { x: 5, y: 2 },
    ])
    expect(rawHeight(pushed, { x: 4, y: 2 })).toBe(0)
  })
})

describe('move 달군 쇠', () => {
  // 숯 벽 (1,2)가 타는 중, 막대 (2,2)-(3,2)의 꼬리에 닿음
  const FORGE_STAGE: Stage = {
    ...BAR_STAGE,
    fire: ['.......', '.......', '.#.....', '.......', '.......'],
    start: { x: 0, y: 4 },
    rules: { forge: true },
  }
  const BURNING: Partial<GameState> = { burning: [{ x: 1, y: 2 }] }

  it('불붙은 숯과 맞닿으면 불에서 먼 쪽 끝으로 한 칸 늘어 세 칸이 된다', () => {
    const { state, events } = move(at(FORGE_STAGE, BURNING), 'right')

    expect(cellsOf(state)).toEqual([
      { x: 2, y: 2 },
      { x: 3, y: 2 },
      { x: 4, y: 2 },
    ])
    expect(state.bars[0]).toMatchObject({ length: 3, heat: null })
    expect(events.map((e) => e.type)).toEqual(expect.arrayContaining(['barHeated', 'barStretched']))
  })

  it('보스 판이 아니면 늘어나지 않는다', () => {
    const { state } = move(at({ ...FORGE_STAGE, rules: undefined }, BURNING), 'right')

    expect(state.bars[0]).toMatchObject({ length: 2, heat: null })
  })

  it('높이가 다른 불에는 달궈지지 않는다', () => {
    const heights = withRow(2, [0, 1, 0, 0, 0, 0, 0])
    const { state } = move(at({ ...FORGE_STAGE, heights }, BURNING), 'right')

    expect(state.bars[0].heat).toBeNull()
  })

  it('양 끝에 불이 같은 거리로 닿으면 달궈지지 않는다', () => {
    const stage = { ...FORGE_STAGE, fire: ['.......', '..##...', '.......', '.......', '.......'] }
    const burning = [
      { x: 2, y: 1 },
      { x: 3, y: 1 },
    ]
    const { state } = move(at(stage, { burning }), 'right')

    expect(state.bars[0]).toMatchObject({ length: 2, heat: null })
  })

  // 숯 벽 (2,1)이 막대 꼬리 옆에서 타는 중, 꼬리 너머 (1,2)는 한 층 높은 벽
  const SIDE_STAGE: Stage = {
    ...FORGE_STAGE,
    fire: ['.......', '..#....', '.......', '.......', '.......'],
  }
  const SIDE_BURNING: Partial<GameState> = { burning: [{ x: 2, y: 1 }] }

  it('양쪽 끝 너머가 다 벽이면 달궈진 채 기다린다', () => {
    const heights = withRow(2, [0, 1, 0, 0, 1, 0, 0])
    const { state } = move(at({ ...SIDE_STAGE, heights }, SIDE_BURNING), 'right')

    expect(state.bars[0]).toMatchObject({ length: 2, heat: 'head' })
    expect(move(state, 'left').state.bars[0]).toMatchObject({ length: 2, heat: 'head' })
  })

  it('먼 쪽이 막혔고 불 쪽 숯이 타서 사라지면 불 쪽으로 늘어난다', () => {
    const heights = withRow(2, [0, 0, 0, 0, 1, 0, 0])
    const waiting: Bar = { x: 2, y: 2, dir: 'right', length: 2, level: 0, heat: 'head' }
    const { state, events } = move(
      at({ ...FORGE_STAGE, heights }, { bars: [waiting], ashes: [{ x: 1, y: 2 }] }),
      'up',
    )

    expect(cellsOf(state)).toEqual([
      { x: 1, y: 2 },
      { x: 2, y: 2 },
      { x: 3, y: 2 },
    ])
    expect(state.bars[0]).toMatchObject({ length: 3, heat: null })
    expect(events).toContainEqual(
      expect.objectContaining({ type: 'barStretched', at: { x: 1, y: 2 } }),
    )
  })

  it('늘어날 칸의 상자는 한 칸 밀어내고 밀 수 없으면 자리가 나는 수에 늘어난다', () => {
    const stage: Stage = {
      ...FORGE_STAGE,
      entities: [...BAR_STAGE.entities, { type: 'box', x: 4, y: 2 }],
    }
    const shoved = move(at(stage, BURNING), 'right').state
    expect(shoved.boxes).toEqual([{ x: 5, y: 2 }])
    expect(shoved.bars[0].length).toBe(3)

    const walled = {
      ...stage,
      fire: SIDE_STAGE.fire,
      heights: withRow(2, [0, 1, 0, 0, 0, 1, 0]),
    }
    const waiting = move(at(walled, SIDE_BURNING), 'right').state
    expect(waiting.boxes).toEqual([{ x: 4, y: 2 }])
    expect(waiting.bars[0]).toMatchObject({ length: 2, heat: 'head' })
  })

  it('늘어날 칸의 큐브는 한 칸 밀려난다', () => {
    const start = at(FORGE_STAGE, { ...BURNING, player: { x: 4, y: 1 } })
    const { state, events } = move(start, 'down')

    expect(state.player).toEqual({ x: 5, y: 2 })
    expect(state.bars[0].length).toBe(3)
    expect(events).toContainEqual({
      type: 'barStretched',
      bar: 0,
      at: { x: 4, y: 2 },
      shoved: { subject: 'player', from: { x: 4, y: 2 }, to: { x: 5, y: 2 } },
    })
  })

  it('세 칸 막대는 다시 늘어나지 않는다', () => {
    const start = at(FORGE_STAGE, { ...BURNING, bars: [bar({ length: 3 })] })

    expect(move(start, 'right').state.bars[0]).toMatchObject({ length: 3, heat: null })
  })
})
