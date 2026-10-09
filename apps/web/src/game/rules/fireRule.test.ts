import { describe, expect, it } from 'vitest'

import type { Direction, GameEvent, GameState, Point, Stage } from '../types'
import { move } from './moveRule'
import { createState } from './stateRule'
import { play } from './testStages'

// 윗줄은 걷는 길, 아랫줄은 불씨 (1,1)에서 숯 벽 하나와 숯 다리 둘로 이어진 숯 길
const LINE_STAGE: Stage = {
  version: 1,
  id: 'test-fire',
  name: '불 테스트',
  heights: [
    [0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0],
  ],
  fire: ['......', '.*#==.'],
  start: { x: 1, y: 0 },
  goal: { x: 5, y: 0 },
  entities: [],
}

// 가운데 (2,1)에 숯 하나를 둔 3×4 판
const CELL_STAGE: Stage = {
  version: 1,
  id: 'test-fire-cell',
  name: '숯 한 칸 테스트',
  heights: [
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  fire: ['....', '..#.', '....'],
  start: { x: 1, y: 1 },
  goal: { x: 3, y: 0 },
  entities: [],
}

const CHAR: Point = { x: 2, y: 1 }

const at = (stage: Partial<Stage>, state: Partial<GameState> = {}): GameState => ({
  ...createState({ ...CELL_STAGE, ...stage }),
  ...state,
})

const caughtOf = (events: GameEvent[]) => events.flatMap((e) => (e.type === 'caught' ? [e.to] : []))

describe('createState 불', () => {
  it('불씨 칸을 다 꺼진 채로 담고 불붙은 숯과 재는 비어 있다', () => {
    const state = createState(LINE_STAGE)

    expect(state.sparks).toEqual([{ x: 1, y: 1 }])
    expect(state.burning).toEqual([])
    expect(state.ashes).toEqual([])
  })
})

describe('move 번지는 불', () => {
  it('불씨 칸을 밟는 수에 켜지고 맞닿은 숯에 바로 불이 붙는다', () => {
    const { state, events } = move(createState(LINE_STAGE), 'down')

    expect(state.sparks).toEqual([])
    expect(state.burning).toEqual([{ x: 2, y: 1 }])
    expect(events).toContainEqual({ type: 'kindled', at: { x: 1, y: 1 } })
    expect(events).toContainEqual({ type: 'caught', from: { x: 1, y: 1 }, to: { x: 2, y: 1 } })
  })

  it('한 수에 한 칸씩 번지고 불붙은 숯은 다음 수에 재가 된다', () => {
    const two = play(LINE_STAGE, ['down', 'up'])

    expect(two.state.burning).toEqual([{ x: 3, y: 1 }])
    expect(two.state.ashes).toEqual([{ x: 2, y: 1 }])
    expect(two.state.heights[1][2]).toBe(0)
    expect(two.events).toContainEqual({ type: 'ashed', cells: [{ x: 2, y: 1 }] })
    expect(two.events).toContainEqual({
      type: 'caught',
      from: { x: 2, y: 1 },
      to: { x: 3, y: 1 },
    })

    const three = move(two.state, 'down')
    expect(three.state.heights[1][3]).toBe(-1)
    expect(three.state.burning).toEqual([{ x: 4, y: 1 }])

    const four = move(three.state, 'up')
    expect(four.state.heights[1]).toEqual([0, 0, 0, -1, -1, 0])
    expect(four.state.burning).toEqual([])
    expect(four.state.ashes).toHaveLength(3)
  })

  it('불씨 칸은 한 번만 켜지고 다시 밟아도 아무 일 없다', () => {
    const { events } = play(LINE_STAGE, ['down', 'up', 'down'])

    expect(events.some((e) => e.type === 'kindled')).toBe(false)
  })

  it('보통 땅에서 끊긴다', () => {
    const { state } = play({ ...LINE_STAGE, fire: ['......', '.*#.#.'] }, [
      'down',
      'up',
      'down',
      'up',
    ])

    expect(state.ashes).toEqual([{ x: 2, y: 1 }])
    expect(state.burning).toEqual([])
  })

  it('재가 된 숯 벽 자리는 그 높이의 땅이라 걸어 들어간다', () => {
    const { state } = play(LINE_STAGE, ['down', 'up', 'down', 'right'])

    expect(state.player).toEqual({ x: 2, y: 1 })
  })

  it('불씨 칸이 여럿이면 칸마다 따로 한 번씩 켜진다', () => {
    const stage: Stage = { ...LINE_STAGE, fire: ['......', '.*=.*='] }
    const { state, events } = play(stage, ['down', 'up', 'right', 'right', 'right', 'down'])

    expect(state.sparks).toEqual([])
    expect(events).toContainEqual({ type: 'kindled', at: { x: 4, y: 1 } })
    expect(state.burning).toEqual([{ x: 5, y: 1 }])
  })

  it('막힌 이동은 수가 아니라 불이 번지지 않는다', () => {
    const before = at({}, { player: { x: 0, y: 0 }, burning: [CHAR] })
    const { state } = move(before, 'up')

    expect(state).toBe(before)
  })

  it('탄 숯 다리 자리는 상자로 메우는 구덩이다', () => {
    const stage: Partial<Stage> = { fire: ['....', '..=.', '....'] }
    const { events } = move(
      at(stage, {
        player: { x: 0, y: 1 },
        boxes: [{ x: 1, y: 1 }],
        ashes: [CHAR],
        heights: [
          [0, 0, 0, 0],
          [0, 0, -1, 0],
          [0, 0, 0, 0],
        ],
      }),
      'right',
    )

    expect(events).toContainEqual({
      type: 'pushed',
      from: { x: 1, y: 1 },
      to: CHAR,
      result: 'filled',
    })
  })
})

describe('move 숯 벽과 불붙은 숯의 막힘', () => {
  // 숯 벽 그대로, 숯 다리에 불이 붙은 상태
  const cases: [string, Partial<Stage>, Partial<GameState>][] = [
    ['숯 벽', {}, {}],
    ['불붙은 숯 다리', { fire: ['....', '..=.', '....'] }, { burning: [CHAR] }],
  ]

  describe.each(cases)('%s', (_, stage, fire) => {
    const blockedAt = (state: GameState, direction: Direction) => move(state, direction)

    it('큐브가 걸어 들어갈 수 없다', () => {
      const before = at(stage, fire)
      const { state, events } = blockedAt(before, 'right')

      expect(state).toBe(before)
      expect(events).toEqual([{ type: 'blocked', direction: 'right' }])
    })

    it('상자를 밀어 넣을 수 없다', () => {
      const before = at(stage, { ...fire, player: { x: 0, y: 1 }, boxes: [{ x: 1, y: 1 }] })

      expect(blockedAt(before, 'right').state.boxes).toEqual([{ x: 1, y: 1 }])
    })

    it('높은 칸에서 상자를 떨어뜨려 넣을 수 없다', () => {
      const before = at(
        {
          ...stage,
          heights: [
            [1, 1, 0, 0],
            [1, 1, 0, 0],
            [1, 1, 0, 0],
          ],
        },
        { ...fire, player: { x: 0, y: 1 }, boxes: [{ x: 1, y: 1 }] },
      )

      expect(blockedAt(before, 'right').state.boxes).toEqual([{ x: 1, y: 1 }])
    })

    it('한 층 높은 숯에 사다리를 기대 놓을 수 없다', () => {
      const before = at(
        {
          ...stage,
          heights: [
            [0, 0, 1, 0],
            [0, 0, 1, 0],
            [0, 0, 1, 0],
          ],
        },
        { ...fire, carrying: 'ladder' },
      )
      const { state } = blockedAt(before, 'right')

      expect(state.carrying).toBe('ladder')
      expect(state.leaningLadders).toEqual([])
    })

    it('상자 위에서 같은 높이의 숯으로 걸어 들어갈 수 없다', () => {
      const before = at(
        {
          ...stage,
          heights: [
            [0, 0, 1, 0],
            [0, 0, 1, 0],
            [0, 0, 1, 0],
          ],
        },
        { ...fire, boxes: [{ x: 1, y: 1 }] },
      )

      expect(blockedAt(before, 'right').state.player).toEqual({ x: 1, y: 1 })
    })

    it('바람에 밀려 들어가지 않고 버틴다', () => {
      const before = at(
        { ...stage, rules: { wind: 'right' } },
        { ...fire, player: { x: 1, y: 0 }, moves: 3 },
      )
      const { state, events } = move(before, 'down')

      expect(state.player).toEqual({ x: 1, y: 1 })
      expect(events).toContainEqual({ type: 'braced', direction: 'right' })
    })

    it('얼음에서 미끄러지다 숯 앞에서 멈춘다', () => {
      const before = at(
        { ...stage, ice: ['....', '.#..', '....'] },
        { ...fire, player: { x: 0, y: 1 } },
      )

      expect(move(before, 'right').state.player).toEqual({ x: 1, y: 1 })
    })

    it('버섯에 튕겨 숯 칸에 내려서지 않는다', () => {
      const before = at(
        {
          ...stage,
          heights: [
            [0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0],
          ],
          fire: (stage.fire ?? CELL_STAGE.fire!).map((row) => row + '.'),
          mushroom: ['.....', '#....', '.....'],
        },
        { ...fire, player: { x: 0, y: 1 }, mushrooms: [{ x: 0, y: 1 }] },
      )
      const { state } = move(before, 'right')

      expect(state.player).toEqual({ x: 0, y: 1 })
    })
  })

  it('불붙지 않은 숯 다리는 걸어 들어간다', () => {
    const { state } = move(at({ fire: ['....', '..=.', '....'] }), 'right')

    expect(state.player).toEqual(CHAR)
  })
})

describe('move 불이 번지지 않는 숯', () => {
  const BRIDGE_STAGE: Stage = { ...LINE_STAGE, fire: ['......', '.*===.'] }

  it('상자가 올라선 숯에는 불이 번지지 않는다', () => {
    const stage: Stage = { ...BRIDGE_STAGE, entities: [{ type: 'box', x: 3, y: 1 }] }
    const { state } = play(stage, ['down', 'up', 'down', 'up'])

    expect(state.ashes).toEqual([{ x: 2, y: 1 }])
    expect(state.burning).toEqual([])
    expect(state.heights[1][3]).toBe(0)
  })

  it('사다리를 기대 놓은 숯에는 불이 번지지 않는다', () => {
    const before = {
      ...createState(BRIDGE_STAGE),
      leaningLadders: [{ x: 3, y: 1, direction: 'down' as const }],
    }
    const one = move(before, 'down')
    const { state } = move(one.state, 'up')

    expect(state.burning).toEqual([])
    expect(state.heights[1][3]).toBe(0)
  })

  it('상자는 불씨를 켜지 않는다', () => {
    const stage: Stage = {
      ...LINE_STAGE,
      start: { x: 0, y: 1 },
      fire: ['......', '..*#..'],
      entities: [{ type: 'box', x: 1, y: 1 }],
    }
    const { state, events } = move(createState(stage), 'right')

    expect(state.boxes).toEqual([{ x: 2, y: 1 }])
    expect(state.sparks).toEqual([{ x: 2, y: 1 }])
    expect(events.some((e) => e.type === 'kindled')).toBe(false)
  })

  it('상자 위에 선 큐브는 불씨 칸에 닿지 않아 켜지 않는다', () => {
    const stage: Stage = {
      ...LINE_STAGE,
      heights: [
        [0, 1, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0],
      ],
      entities: [{ type: 'box', x: 1, y: 1 }],
    }
    const { state } = move(createState(stage), 'down')

    expect(state.player).toEqual({ x: 1, y: 1 })
    expect(state.sparks).toEqual([{ x: 1, y: 1 }])
  })
})

describe('move 큐브가 선 숯', () => {
  // 숯 다리 넷 위에 선 큐브, 왼쪽 끝 다리에 이미 붙은 불
  const RUN_STAGE: Stage = {
    ...LINE_STAGE,
    heights: [
      [0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0],
    ],
    fire: ['......', '..====', '......'],
    start: { x: 4, y: 1 },
  }
  const running = () => ({ ...createState(RUN_STAGE), burning: [{ x: 2, y: 1 }] })

  it('불이 큐브가 선 숯까지 와도 칸은 남고 큐브는 그대로다', () => {
    const { state, events } = move(running(), 'left')

    expect(state.player).toEqual({ x: 3, y: 1 })
    expect(state.burning).toEqual([{ x: 3, y: 1 }])
    expect(state.heights[1][3]).toBe(0)
    expect(events).toContainEqual({ type: 'caught', from: { x: 2, y: 1 }, to: { x: 3, y: 1 } })
  })

  it('큐브가 선 숯에서도 불은 앞 칸으로 번지고 떠난 칸은 그 수 끝에 재가 된다', () => {
    const one = move(running(), 'left')
    const two = move(one.state, 'right')

    expect(two.state.player).toEqual({ x: 4, y: 1 })
    expect(two.state.heights[1][3]).toBe(-1)
    expect(two.state.burning).toEqual([{ x: 4, y: 1 }])

    const three = move(two.state, 'up')
    expect(three.state.heights[1][4]).toBe(-1)
    expect(three.state.burning).toEqual([{ x: 5, y: 1 }])
  })
})

describe('move 쫓아오는 불', () => {
  // 가운데 (3,2)를 둘러싼 숯 넷, 오른쪽 아래로 걸어가는 큐브
  const CROSS_STAGE: Stage = {
    version: 1,
    id: 'test-chase',
    name: '쫓아오는 불 테스트',
    heights: Array.from({ length: 5 }, () => [0, 0, 0, 0, 0, 0, 0]),
    fire: ['.......', '...=...', '..=.=..', '...=...', '.......'],
    start: { x: 6, y: 4 },
    goal: { x: 0, y: 0 },
    entities: [],
    rules: { chase: true },
  }
  const burningAt = (stage: Stage) => ({ ...createState(stage), burning: [{ x: 3, y: 2 }] })

  // (0,2)~(3,2) 곧은 숯 줄, (3,2) 갈림길에서 위아래 두 갈래
  const FORK_STAGE: Stage = {
    ...CROSS_STAGE,
    fire: ['...#...', '...#...', '####...', '...#...', '...#...'],
  }
  const forkAt = (burning: Point, start: Point, boxes: Point[] = []) => ({
    ...createState({ ...FORK_STAGE, start }),
    burning: [burning],
    ashes: [0, 1, 2].filter((x) => x < burning.x).map((x) => ({ x, y: 2 })),
    boxes,
  })

  it('곧은 줄은 큐브가 멀어져도 끝까지 탄다', () => {
    const directions: Direction[] = ['right', 'left', 'right']
    const state = directions.reduce(
      (s, d) => move(s, d).state,
      forkAt({ x: 0, y: 2 }, { x: 0, y: 4 }),
    )

    expect(state.burning).toEqual([{ x: 3, y: 2 }])
  })

  it('갈림길에서는 큐브와 가까운 갈래로만 번진다', () => {
    const { events } = move(forkAt({ x: 3, y: 2 }, { x: 5, y: 0 }), 'down')

    expect(caughtOf(events)).toEqual([{ x: 3, y: 1 }])
  })

  it('갈림길에 닿기 전 큐브 자리가 바뀌면 다른 갈래로 번진다', () => {
    const { events } = move(forkAt({ x: 3, y: 2 }, { x: 5, y: 4 }), 'up')

    expect(caughtOf(events)).toEqual([{ x: 3, y: 3 }])
  })

  it('상자가 올라선 숯은 갈래에서 빠져 남은 갈래로 번진다', () => {
    const { events } = move(forkAt({ x: 3, y: 2 }, { x: 5, y: 0 }, [{ x: 3, y: 1 }]), 'down')

    expect(caughtOf(events)).toEqual([{ x: 3, y: 3 }])
  })

  it('갈림길에서 큐브와 거리가 같은 갈래는 다 번진다', () => {
    const { events } = move(burningAt(CROSS_STAGE), 'left')

    expect(caughtOf(events)).toEqual([
      { x: 4, y: 2 },
      { x: 3, y: 3 },
    ])
  })

  it('쫓아오는 판이 아니면 맞닿은 숯 전부로 번진다', () => {
    const { events } = move(burningAt({ ...CROSS_STAGE, rules: undefined }), 'left')

    expect(caughtOf(events)).toHaveLength(4)
  })

  it('불씨에서 켤 때 맞닿은 숯은 큐브와 거리가 같아 다 번진다', () => {
    const stage: Stage = {
      ...CROSS_STAGE,
      fire: ['.......', '.......', '..=*=..', '.......', '.......'],
      start: { x: 3, y: 1 },
    }
    const { events } = move(createState(stage), 'down')

    expect(caughtOf(events)).toEqual([
      { x: 4, y: 2 },
      { x: 2, y: 2 },
    ])
  })
})
