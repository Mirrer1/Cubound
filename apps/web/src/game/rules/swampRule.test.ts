import { describe, expect, it } from 'vitest'

import type { Direction, GameState, Stage } from '../types'
import { sinkCount } from './limitRule'
import { move } from './moveRule'
import { createState } from './stateRule'
import { TRAM_CELLS, play } from './testStages'

const SWAMP_STAGE: Stage = {
  version: 1,
  id: 'test-swamp',
  name: '늪 테스트',
  heights: [
    [0, -1, 0, 0, 0],
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
  ],
  start: { x: 0, y: 1 },
  goal: { x: 4, y: 0 },
  entities: [],
  swamp: ['.....', '.#...', '.....'],
}

const SWAMP_TRAM_STAGE: Stage = {
  version: 1,
  id: 'test-swamp-tram',
  name: '늪과 발판 테스트',
  heights: [
    [0, 0, 0, 0, 0, 0],
    [0, -1, -1, -1, 0, 0],
    [0, 0, 0, 0, 0, 0],
  ],
  start: { x: 0, y: 2 },
  goal: { x: 5, y: 0 },
  entities: [{ type: 'tram', x: 1, y: 1, id: 'tram-a', level: 0, cells: TRAM_CELLS, dir: 1 }],
  swamp: ['......', '......', '.#....'],
}

describe('move 늪', () => {
  it('늪 칸 목록을 읽어 버둥 횟수 0으로 시작한다', () => {
    const state = createState(SWAMP_STAGE)

    expect(state.swamps).toEqual([{ x: 1, y: 1 }])
    expect(state.struggles).toBe(0)
  })

  it('늪 칸으로 들어가는 이동은 보통 이동과 같다', () => {
    const { state, events } = move(createState(SWAMP_STAGE), 'right')

    expect(state.player).toEqual({ x: 1, y: 1 })
    expect(state.moves).toBe(1)
    expect(state.struggles).toBe(0)
    expect(events).toEqual([{ type: 'moved', from: { x: 0, y: 1 }, to: { x: 1, y: 1 } }])
  })

  it('늪에서 두 수는 어느 방향을 눌러도 제자리에서 버둥거린다', () => {
    const first = play(SWAMP_STAGE, ['right', 'down'])
    const second = move(first.state, 'right')

    expect(first.state.player).toEqual({ x: 1, y: 1 })
    expect(first.state.moves).toBe(2)
    expect(first.state.struggles).toBe(1)
    expect(first.events).toEqual([{ type: 'struggled', at: { x: 1, y: 1 } }])
    expect(second.state.player).toEqual({ x: 1, y: 1 })
    expect(second.state.moves).toBe(3)
    expect(second.state.struggles).toBe(2)
  })

  it('갈 수 없는 방향을 눌러도 버둥으로 센다', () => {
    const { state, events } = play(SWAMP_STAGE, ['right', 'up'])

    expect(state.moves).toBe(2)
    expect(state.struggles).toBe(1)
    expect(events).toEqual([{ type: 'struggled', at: { x: 1, y: 1 } }])
  })

  it('세 번째에 누른 방향으로 나가고 버둥 횟수가 0으로 돌아간다', () => {
    const { state, events } = play(SWAMP_STAGE, ['right', 'up', 'left', 'down'])

    expect(state.player).toEqual({ x: 1, y: 2 })
    expect(state.moves).toBe(4)
    expect(state.struggles).toBe(0)
    expect(events).toEqual([{ type: 'moved', from: { x: 1, y: 1 }, to: { x: 1, y: 2 } }])
  })

  it('세 번째에 갈 수 없는 방향을 누르면 수를 쓰지 않고 버둥 횟수도 그대로다', () => {
    const struggled = play(SWAMP_STAGE, ['right', 'left', 'left']).state
    const { state, events } = move(struggled, 'up')
    const out = move(state, 'right')

    expect(state).toBe(struggled)
    expect(state.moves).toBe(3)
    expect(state.struggles).toBe(2)
    expect(events).toEqual([{ type: 'blocked', direction: 'up' }])
    expect(out.state.player).toEqual({ x: 2, y: 1 })
    expect(out.state.moves).toBe(4)
  })

  it('늪에서 다른 늪으로 나가면 다시 버둥거린다', () => {
    const stage: Stage = { ...SWAMP_STAGE, swamp: ['.....', '.##..', '.....'] }
    const { state } = play(stage, ['right', 'right', 'right', 'right'])

    expect(state.player).toEqual({ x: 2, y: 1 })
    expect(state.struggles).toBe(0)
  })

  it('버둥거리는 수에는 상자를 밀지 않고 나가는 수에 민다', () => {
    const stage: Stage = { ...SWAMP_STAGE, entities: [{ type: 'box', x: 2, y: 1 }] }
    const struggled = play(stage, ['right', 'right', 'right'])
    const out = move(struggled.state, 'right')

    expect(struggled.state.boxes).toEqual([{ x: 2, y: 1 }])
    expect(struggled.state.pushes).toBe(0)
    expect(out.state.boxes).toEqual([{ x: 3, y: 1 }])
    expect(out.state.player).toEqual({ x: 2, y: 1 })
    expect(out.state.pushes).toBe(1)
  })

  it('버둥거리는 수에는 사다리를 놓지 않는다', () => {
    const stage: Stage = {
      ...SWAMP_STAGE,
      heights: [
        [0, -1, 0, 0, 0],
        [0, 0, 1, 0, 0],
        [0, 0, 0, 0, 0],
      ],
    }
    const entered: GameState = { ...move(createState(stage), 'right').state, carrying: 'ladder' }
    const { state } = move(entered, 'right')

    expect(state.leaningLadders).toEqual([])
    expect(state.carrying).toBe('ladder')
    expect(state.struggles).toBe(1)
  })

  it('버둥거리는 수에도 발판이 한 칸 간다', () => {
    const { state, events } = play(SWAMP_TRAM_STAGE, ['right', 'right'])

    expect(state.player).toEqual({ x: 1, y: 2 })
    expect(state.trams).toEqual([{ id: 'tram-a', at: 2, dir: 1 }])
    expect(events).toEqual([
      { type: 'struggled', at: { x: 1, y: 2 } },
      { type: 'tram', id: 'tram-a', from: { x: 2, y: 1 }, to: { x: 3, y: 1 } },
    ])
  })

  it('버둥거리는 수도 이동 제한을 쓴다', () => {
    const stage: Stage = { ...SWAMP_STAGE, rules: { moveLimit: 2 } }
    const used = play(stage, ['right', 'right'])
    const { state, events } = move(used.state, 'right')

    expect(used.state.moves).toBe(2)
    expect(used.state.struggles).toBe(1)
    expect(state).toBe(used.state)
    expect(events).toContainEqual({ type: 'limit', limit: 'moves' })
  })

  it('버둥거리는 수는 방향 제한에 세지 않고 나가는 수만 센다', () => {
    const stage: Stage = { ...SWAMP_STAGE, rules: { dirLimit: { dir: 'right', count: 2 } } }
    const struggled = play(stage, ['right', 'right', 'right'])
    const out = move(struggled.state, 'right')

    expect(struggled.state.dirUses).toBe(1)
    expect(out.state.player).toEqual({ x: 2, y: 1 })
    expect(out.state.dirUses).toBe(2)
  })

  it('제한한 방향을 다 써도 버둥거리는 수는 막지 않는다', () => {
    const stage: Stage = { ...SWAMP_STAGE, rules: { dirLimit: { dir: 'right', count: 1 } } }
    const { state, events } = play(stage, ['right', 'right'])

    expect(state.moves).toBe(2)
    expect(state.struggles).toBe(1)
    expect(state.dirUses).toBe(1)
    expect(events).toEqual([{ type: 'struggled', at: { x: 1, y: 1 } }])
  })

  it('늪에 밀어 넣은 상자는 가라앉고 그 칸은 보통 땅이 된다', () => {
    const stage: Stage = {
      ...SWAMP_STAGE,
      swamp: ['.....', '..#..', '.....'],
      entities: [{ type: 'box', x: 1, y: 1 }],
    }
    const { state, events } = move(createState(stage), 'right')

    expect(state.boxes).toEqual([])
    expect(state.swamps).toEqual([])
    expect(state.heights).toEqual(stage.heights)
    expect(state.player).toEqual({ x: 1, y: 1 })
    expect(state.pushes).toBe(1)
    expect(events).toContainEqual({ type: 'sank', at: { x: 2, y: 1 } })
  })

  it('가라앉은 칸에서는 갇히지 않는다', () => {
    const stage: Stage = {
      ...SWAMP_STAGE,
      swamp: ['.....', '..#..', '.....'],
      entities: [{ type: 'box', x: 1, y: 1 }],
    }
    const { state } = play(stage, ['right', 'right', 'right'])

    expect(state.player).toEqual({ x: 3, y: 1 })
    expect(state.moves).toBe(3)
    expect(state.struggles).toBe(0)
  })

  it('얼음을 타고 미끄러져 닿은 상자도 가라앉는다', () => {
    const stage: Stage = {
      ...SWAMP_STAGE,
      ice: ['.....', '..#..', '.....'],
      swamp: ['.....', '...#.', '.....'],
      entities: [{ type: 'box', x: 1, y: 1 }],
    }
    const { state, events } = move(createState(stage), 'right')

    expect(state.boxes).toEqual([])
    expect(state.swamps).toEqual([])
    expect(events).toContainEqual({ type: 'sank', at: { x: 3, y: 1 } })
  })
})

const DEEP_SWAMP_STAGE: Stage = {
  version: 1,
  id: 'test-swamp-deepen',
  name: '깊어지는 늪 테스트',
  heights: [
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
  ],
  start: { x: 0, y: 1 },
  goal: { x: 4, y: 0 },
  entities: [],
  swamp: ['.....', '.#.#.', '.....'],
  rules: { swampDeepen: true },
}

describe('move 깊어지는 늪', () => {
  it('걸어서 늪에 들어가면 빠진 횟수가 는다', () => {
    const { state } = move(createState(DEEP_SWAMP_STAGE), 'right')

    expect(state.player).toEqual({ x: 1, y: 1 })
    expect(state.sinks).toBe(1)
  })

  it('버둥거리는 수는 빠진 횟수를 세지 않는다', () => {
    const { state } = play(DEEP_SWAMP_STAGE, ['right', 'right', 'right'])

    expect(state.struggles).toBe(2)
    expect(state.sinks).toBe(1)
  })

  it('늪에서 나가는 수는 빠진 횟수를 세지 않는다', () => {
    const { state } = play(DEEP_SWAMP_STAGE, ['right', 'right', 'right', 'right'])

    expect(state.player).toEqual({ x: 2, y: 1 })
    expect(state.sinks).toBe(1)
  })

  it('두 번째 늪은 버둥이 한 수 더 든다', () => {
    const entered = play(DEEP_SWAMP_STAGE, ['right', 'right', 'right', 'right', 'right'])
    const struggled = play(DEEP_SWAMP_STAGE, Array<Direction>(8).fill('right'))
    const out = move(struggled.state, 'right')

    expect(entered.state.player).toEqual({ x: 3, y: 1 })
    expect(entered.state.sinks).toBe(2)
    expect(struggled.state.player).toEqual({ x: 3, y: 1 })
    expect(struggled.state.struggles).toBe(3)
    expect(out.state.player).toEqual({ x: 4, y: 1 })
    expect(out.state.moves).toBe(9)
  })

  it('같은 늪에 다시 들어가도 센다', () => {
    const back = play(DEEP_SWAMP_STAGE, ['right', 'right', 'right', 'right', 'left'])
    const struggled = play(DEEP_SWAMP_STAGE, [
      'right',
      'right',
      'right',
      'right',
      'left',
      'up',
      'up',
    ])

    expect(back.state.player).toEqual({ x: 1, y: 1 })
    expect(back.state.sinks).toBe(2)
    expect(struggled.state.player).toEqual({ x: 1, y: 1 })
    expect(struggled.state.struggles).toBe(2)
  })

  it('떨어져서 늪에 착지해도 센다', () => {
    const stage: Stage = {
      ...DEEP_SWAMP_STAGE,
      heights: [
        [0, 0, 0, 0, 0],
        [1, 0, 0, 0, 0],
        [0, 0, 0, 0, 0],
      ],
    }
    const { state, events } = move(createState(stage), 'right')

    expect(state.sinks).toBe(1)
    expect(events).toContainEqual({
      type: 'fell',
      from: { x: 0, y: 1 },
      to: { x: 1, y: 1 },
      drop: 1,
    })
  })

  it('상자가 늪에 가라앉은 것은 세지 않는다', () => {
    const stage: Stage = {
      ...DEEP_SWAMP_STAGE,
      swamp: ['.....', '..#..', '.....'],
      entities: [{ type: 'box', x: 1, y: 1 }],
    }
    const { state, events } = move(createState(stage), 'right')

    expect(state.player).toEqual({ x: 1, y: 1 })
    expect(state.sinks).toBe(0)
    expect(events).toContainEqual({ type: 'sank', at: { x: 2, y: 1 } })
  })

  it('깊어짐을 켜지 않은 판은 버둥이 언제나 두 수다', () => {
    const stage: Stage = { ...DEEP_SWAMP_STAGE, rules: undefined }
    const struggled = play(stage, Array<Direction>(7).fill('right'))
    const out = move(struggled.state, 'right')

    expect(struggled.state.player).toEqual({ x: 3, y: 1 })
    expect(struggled.state.sinks).toBe(2)
    expect(struggled.state.struggles).toBe(2)
    expect(out.state.player).toEqual({ x: 4, y: 1 })
    expect(out.state.moves).toBe(8)
  })

  it('늪에 빠진 횟수를 0부터 알려준다', () => {
    const start = createState(DEEP_SWAMP_STAGE)
    const second = play(DEEP_SWAMP_STAGE, ['right', 'right', 'right', 'right', 'right'])

    expect(sinkCount(start)).toBe(0)
    expect(sinkCount(move(start, 'right').state)).toBe(1)
    expect(sinkCount(second.state)).toBe(2)
    expect(sinkCount(createState({ ...DEEP_SWAMP_STAGE, rules: undefined }))).toBeNull()
  })
})
