import { describe, expect, it } from 'vitest'

import type { Direction, GameState, MoveResult, Stage } from '../types'
import { climbsLeft, dirLeft, movesLeft, pushesLeft, ridesLeft, windLeft } from './limitRule'
import { move } from './moveRule'
import { createState, standHeight } from './stateRule'
import {
  BOX_RIDE_STAGE,
  BOX_STAGE,
  FLAT_STAGE,
  ICE_STAGE,
  LADDER_STAGE,
  LIFT_STAGE,
  TRAM_CELLS,
  TRAM_STAGE,
  WARP_STAGE,
  WIND_STAGE,
  play,
  withMiddleRow,
  withTram,
} from './testStages'

describe('move 이동 제한', () => {
  const LIMITED_STAGE: Stage = { ...FLAT_STAGE, rules: { moveLimit: 2 } }

  it('제한이 없으면 이동 수에 상관없이 계속 움직인다', () => {
    const { state } = play(FLAT_STAGE, ['left', 'right', 'left', 'right'])

    expect(state.moves).toBe(4)
    expect(state.player).toEqual({ x: 1, y: 1 })
  })

  it('제한 안에서는 그대로 움직인다', () => {
    const { state } = play(LIMITED_STAGE, ['left', 'right'])

    expect(state.moves).toBe(2)
    expect(state.player).toEqual({ x: 1, y: 1 })
  })

  it('남은 이동을 다 쓰면 움직이지 않고 blocked 이벤트를 돌려준다', () => {
    const used = play(LIMITED_STAGE, ['left', 'right']).state
    const { state, events } = move(used, 'up')

    expect(state).toBe(used)
    expect(events).toEqual([
      { type: 'blocked', direction: 'up' },
      { type: 'limit', limit: 'moves' },
    ])
  })

  it('제한을 다 쓰면 목표 칸을 바로 앞에 두고도 클리어하지 못한다', () => {
    const stage: Stage = { ...FLAT_STAGE, start: { x: 1, y: 0 }, rules: { moveLimit: 1 } }
    const { state } = play(stage, ['left', 'right'])

    expect(state.moves).toBe(1)
    expect(state.cleared).toBe(false)
  })
})

describe('movesLeft', () => {
  it('제한이 없으면 null을 돌려준다', () => {
    expect(movesLeft(createState(FLAT_STAGE))).toBe(null)
  })

  it('제한이 있으면 남은 이동 수를 돌려준다', () => {
    const stage: Stage = { ...FLAT_STAGE, rules: { moveLimit: 2 } }

    expect(movesLeft(createState(stage))).toBe(2)
    expect(movesLeft(play(stage, ['left']).state)).toBe(1)
    expect(movesLeft(play(stage, ['left', 'right']).state)).toBe(0)
  })
})

describe('move 민 횟수', () => {
  it('상자를 밀면 민 횟수가 1 오른다', () => {
    const { state } = move(createState(BOX_STAGE), 'right')

    expect(state.pushes).toBe(1)
  })

  it('상자를 밀지 않은 이동은 민 횟수가 오르지 않는다', () => {
    const { state } = play(BOX_STAGE, ['up', 'right', 'right'])

    expect(state.pushes).toBe(0)
  })

  it('얼음에서 상자가 여러 칸 미끄러져도 민 횟수는 1 오른다', () => {
    const stage: Stage = { ...BOX_STAGE, ice: ['.....', '..##.', '.....'] }
    const { state } = move(createState(stage), 'right')

    expect(state.boxes).toEqual([{ x: 4, y: 1 }])
    expect(state.pushes).toBe(1)
  })

  it('상자가 미끄러지다 구멍을 메워도 민 횟수는 1 오른다', () => {
    const stage: Stage = {
      ...BOX_STAGE,
      heights: withMiddleRow([0, 0, 0, 0, -1]),
      ice: ['.....', '..##.', '.....'],
    }
    const { state, events } = move(createState(stage), 'right')

    expect(state.boxes).toEqual([])
    expect(events.filter((e) => e.type === 'pushed')).toHaveLength(2)
    expect(state.pushes).toBe(1)
  })
})

describe('move 밀기 제한', () => {
  const LIMITED_STAGE: Stage = { ...BOX_STAGE, rules: { pushLimit: 1 } }

  it('제한 안에서는 그대로 민다', () => {
    const { state } = move(createState(LIMITED_STAGE), 'right')

    expect(state.boxes).toEqual([{ x: 2, y: 1 }])
    expect(state.player).toEqual({ x: 1, y: 1 })
  })

  it('제한을 다 쓰면 상자가 밀리지 않고 큐브가 상자 위로 올라선다', () => {
    const { state, events } = play(LIMITED_STAGE, ['right', 'right'])

    expect(state.boxes).toEqual([{ x: 2, y: 1 }])
    expect(state.player).toEqual({ x: 2, y: 1 })
    expect(state.pushes).toBe(1)
    expect(events).toEqual([
      { type: 'limit', limit: 'pushes' },
      { type: 'climbed', from: { x: 1, y: 1 }, to: { x: 2, y: 1 }, via: 'box' },
    ])
  })

  it('제한을 다 써도 상자가 없는 쪽으로는 계속 이동한다', () => {
    const { state } = play(LIMITED_STAGE, ['right', 'up'])

    expect(state.player).toEqual({ x: 1, y: 0 })
    expect(state.moves).toBe(2)
  })

  it('이동 제한과 밀기 제한을 함께 두면 각자 동작한다', () => {
    const stage: Stage = { ...BOX_STAGE, rules: { moveLimit: 3, pushLimit: 1 } }
    const used = play(stage, ['right', 'right', 'right'])

    expect(used.state.pushes).toBe(1)
    expect(used.state.moves).toBe(3)
    expect(move(used.state, 'right').state).toBe(used.state)
  })
})

describe('pushesLeft', () => {
  it('제한이 없으면 null을 돌려준다', () => {
    expect(pushesLeft(createState(BOX_STAGE))).toBe(null)
  })

  it('제한이 있으면 남은 밀기 수를 돌려준다', () => {
    const stage: Stage = { ...BOX_STAGE, rules: { pushLimit: 2 } }

    expect(pushesLeft(createState(stage))).toBe(2)
    expect(pushesLeft(play(stage, ['right']).state)).toBe(1)
    expect(pushesLeft(play(stage, ['right', 'right']).state)).toBe(0)
  })
})

// 상자 오른쪽 칸이 한 층 높아 상자가 밀리지 않고 큐브가 딛고 오른다
const CLIMB_BOX_STAGE: Stage = { ...BOX_STAGE, heights: withMiddleRow([0, 0, 1, 0, 0]) }

describe('move 오른 횟수', () => {
  it('상자를 딛고 오르면 오른 횟수가 1 오른다', () => {
    const { state, events } = move(createState(CLIMB_BOX_STAGE), 'right')

    expect(events).toEqual([
      { type: 'climbed', from: { x: 0, y: 1 }, to: { x: 1, y: 1 }, via: 'box' },
    ])
    expect(state.climbs).toBe(1)
  })

  it('기대 놓은 사다리로 오르면 오른 횟수가 1 오른다', () => {
    const { state } = play(LADDER_STAGE, ['right', 'right', 'right', 'right'])

    expect(state.climbs).toBe(1)
  })

  it('사다리를 줍거나 놓는 이동은 오른 횟수가 오르지 않는다', () => {
    expect(move(createState(LADDER_STAGE), 'right').state.climbs).toBe(0)
    expect(play(LADDER_STAGE, ['right', 'right', 'right']).state.climbs).toBe(0)
  })

  it('사다리를 타고 내려오는 이동은 오른 횟수가 오르지 않는다', () => {
    const { state } = play(LADDER_STAGE, ['right', 'right', 'right', 'right', 'left'])

    expect(state.player).toEqual({ x: 2, y: 1 })
    expect(state.climbs).toBe(1)
  })

  it('발판을 타고 높이가 올라가도 오른 횟수가 오르지 않는다', () => {
    const stage: Stage = {
      ...LIFT_STAGE,
      start: { x: 1, y: 1 },
      entities: [
        { type: 'switch', x: 3, y: 1, target: 'a' },
        { type: 'lift', x: 2, y: 1, id: 'a' },
        { type: 'box', x: 2, y: 1 },
      ],
    }
    const { state } = move(createState(stage), 'right')

    expect(state.player).toEqual({ x: 2, y: 1 })
    expect(standHeight(state, { x: 2, y: 1 })).toBe(1)
    expect(state.climbs).toBe(0)
  })
})

describe('move 올라가기 제한', () => {
  const LIMITED_STAGE: Stage = { ...CLIMB_BOX_STAGE, rules: { climbLimit: 1 } }

  it('제한 안에서는 그대로 오른다', () => {
    const { state } = move(createState(LIMITED_STAGE), 'right')

    expect(state.player).toEqual({ x: 1, y: 1 })
    expect(state.climbs).toBe(1)
  })

  it('제한을 다 쓰면 상자를 딛고 오르지 못한다', () => {
    const { state, events } = play(LIMITED_STAGE, ['right', 'left', 'right'])

    expect(state.player).toEqual({ x: 0, y: 1 })
    expect(events).toEqual([
      { type: 'blocked', direction: 'right' },
      { type: 'limit', limit: 'climbs' },
    ])
  })

  it('제한을 다 쓰면 기대 놓은 사다리로도 오르지 못한다', () => {
    const stage: Stage = { ...LADDER_STAGE, rules: { climbLimit: 1 } }
    const { state, events } = play(stage, [
      'right',
      'right',
      'right',
      'right',
      'left',
      'right',
      'right',
    ])

    expect(state.player).toEqual({ x: 2, y: 1 })
    expect(state.leaningLadders).toEqual([{ x: 2, y: 1, direction: 'right' }])
    expect(events).toEqual([
      { type: 'blocked', direction: 'right' },
      { type: 'limit', limit: 'climbs' },
    ])
  })

  it('제한을 다 써도 오르지 않는 쪽으로는 계속 이동한다', () => {
    const { state } = play(LIMITED_STAGE, ['right', 'left', 'up'])

    expect(state.player).toEqual({ x: 0, y: 0 })
    expect(state.moves).toBe(3)
  })
})

describe('climbsLeft', () => {
  it('제한이 없으면 null을 돌려준다', () => {
    expect(climbsLeft(createState(CLIMB_BOX_STAGE))).toBe(null)
  })

  it('제한이 있으면 남은 올라가기 수를 돌려준다', () => {
    const stage: Stage = { ...CLIMB_BOX_STAGE, rules: { climbLimit: 2 } }

    expect(climbsLeft(createState(stage))).toBe(2)
    expect(climbsLeft(play(stage, ['right']).state)).toBe(1)
    expect(climbsLeft(play(stage, ['right', 'left', 'right']).state)).toBe(0)
  })
})

const TRANSFER_STAGE: Stage = {
  version: 1,
  id: 'test-tram-transfer',
  name: '발판 옮겨 타기 테스트',
  heights: [
    [0, 0, 0, 0, 0],
    [0, -1, -1, -1, 0],
    [0, -1, -1, -1, 0],
  ],
  start: { x: 0, y: 1 },
  goal: { x: 4, y: 1 },
  entities: [
    { type: 'tram', x: 1, y: 1, id: 'tram-a', level: 0, cells: TRAM_CELLS, dir: 1 },
    {
      type: 'tram',
      x: 1,
      y: 2,
      id: 'tram-b',
      level: 0,
      cells: [
        { x: 1, y: 2 },
        { x: 2, y: 2 },
        { x: 3, y: 2 },
      ],
      dir: 1,
    },
  ],
}

describe('move 발판에 탄 횟수', () => {
  it('땅에서 발판으로 올라타면 한 번으로 센다', () => {
    const { state } = move(createState(TRAM_STAGE), 'right')

    expect(state.player).toEqual({ x: 2, y: 1 })
    expect(state.rides).toBe(1)
  })

  it('탄 채로 여러 칸 실려 가도 더 세지 않는다', () => {
    const { state } = play(TRAM_STAGE, ['right', 'right', 'right'])

    expect(state.player).toEqual({ x: 4, y: 1 })
    expect(state.moves).toBe(3)
    expect(state.rides).toBe(1)
  })

  it('기다린 이동은 세지 않는다', () => {
    const { state } = move(createState(withTram({ x: 3, y: 1 })), 'right')

    expect(state.moves).toBe(1)
    expect(state.rides).toBe(0)
  })

  it('발판에서 다른 발판으로 옮겨 타면 다시 센다', () => {
    const { state } = play(TRANSFER_STAGE, ['right', 'down'])

    expect(state.player).toEqual({ x: 3, y: 2 })
    expect(state.rides).toBe(2)
  })

  it('상자가 발판에 실리는 것은 세지 않는다', () => {
    const stage = withTram(
      { x: 3, y: 1 },
      { start: { x: 5, y: 1 }, entities: [{ type: 'box', x: 4, y: 1 }] },
    )
    const { state } = move(createState(stage), 'left')

    expect(state.boxes).toEqual([{ x: 2, y: 1 }])
    expect(state.player).toEqual({ x: 4, y: 1 })
    expect(state.rides).toBe(0)
  })

  it('발판 위 상자에 올라서는 것도 탄 것으로 센다', () => {
    const { state } = play(BOX_RIDE_STAGE, ['up', 'left', 'up', 'right'])

    expect(state.player).toEqual({ x: 2, y: 1 })
    expect(state.rides).toBe(1)
  })
})

describe('보스 타는 횟수 제한', () => {
  const LIMITED_STAGE: Stage = { ...TRAM_STAGE, rules: { rideLimit: 1 } }

  it('제한이 남아 있으면 평소대로 올라탄다', () => {
    const { state } = move(createState(LIMITED_STAGE), 'right')

    expect(state.player).toEqual({ x: 2, y: 1 })
    expect(state.rides).toBe(1)
  })

  it('제한을 다 쓰면 올라타지 못하고 이동 수도 늘지 않는다', () => {
    const used: GameState = { ...createState(LIMITED_STAGE), rides: 1 }
    const { state, events } = move(used, 'right')

    expect(state).toBe(used)
    expect(state.moves).toBe(0)
    expect(state.trams).toEqual([{ id: 'tram-a', at: 0, dir: 1 }])
    expect(events).toEqual([
      { type: 'blocked', direction: 'right' },
      { type: 'limit', limit: 'rides' },
    ])
  })

  it('제한을 다 써도 발판 길 쪽으로 밀어 기다리면 이동 수 1을 쓴다', () => {
    const stage: Stage = { ...withTram({ x: 3, y: 1 }), rules: { rideLimit: 1 } }
    const used: GameState = { ...createState(stage), rides: 1 }
    const { state, events } = move(used, 'right')

    expect(state.player).toEqual({ x: 0, y: 1 })
    expect(state.moves).toBe(1)
    expect(events).toEqual([
      { type: 'tram', id: 'tram-a', from: { x: 3, y: 1 }, to: { x: 2, y: 1 } },
    ])
  })

  it('제한을 다 써도 발판을 타지 않는 이동은 그대로 된다', () => {
    const used: GameState = { ...createState(LIMITED_STAGE), rides: 1 }
    const { state } = move(used, 'up')

    expect(state.player).toEqual({ x: 0, y: 0 })
    expect(state.moves).toBe(1)
  })
})

describe('ridesLeft', () => {
  it('제한이 없으면 null을 돌려준다', () => {
    expect(ridesLeft(createState(TRAM_STAGE))).toBe(null)
  })

  it('제한이 있으면 남은 횟수를 돌려준다', () => {
    const stage: Stage = { ...TRAM_STAGE, rules: { rideLimit: 2 } }

    expect(ridesLeft(createState(stage))).toBe(2)
    expect(ridesLeft(move(createState(stage), 'right').state)).toBe(1)
  })
})

const DIR_STAGE: Stage = {
  version: 1,
  id: 'test-dir',
  name: '방향 제한 테스트',
  heights: [
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
  ],
  start: { x: 2, y: 1 },
  goal: { x: 4, y: 0 },
  entities: [],
}

const withDirLimit = (stage: Stage, dir: Direction, count: number): Stage => ({
  ...stage,
  rules: { dirLimit: { dir, count } },
})

describe('보스 방향 제한', () => {
  it('제한한 방향으로 한 칸 가면 쓴 횟수가 는다', () => {
    const { state } = move(createState(withDirLimit(DIR_STAGE, 'left', 3)), 'left')

    expect(state.player).toEqual({ x: 1, y: 1 })
    expect(state.dirUses).toBe(1)
  })

  it('다른 방향으로 가면 쓴 횟수가 늘지 않는다', () => {
    const { state } = move(createState(withDirLimit(DIR_STAGE, 'left', 3)), 'right')

    expect(state.player).toEqual({ x: 3, y: 1 })
    expect(state.dirUses).toBe(0)
  })

  it('벽에 막혀 제자리면 쓴 횟수가 늘지 않는다', () => {
    const stage = withDirLimit({ ...DIR_STAGE, start: { x: 0, y: 1 } }, 'left', 3)
    const { state, events } = move(createState(stage), 'left')

    expect(state.dirUses).toBe(0)
    expect(events).toEqual([{ type: 'blocked', direction: 'left' }])
  })

  it('얼음으로 여러 칸 미끄러져도 한 번만 쓴다', () => {
    const { state } = move(createState(withDirLimit(ICE_STAGE, 'right', 3)), 'right')

    expect(state.player).toEqual({ x: 4, y: 1 })
    expect(state.dirUses).toBe(1)
  })

  it('상자를 밀어도 한 번 쓴다', () => {
    const stage = withDirLimit(
      { ...DIR_STAGE, entities: [{ type: 'box', x: 3, y: 1 }] },
      'right',
      3,
    )
    const { state } = move(createState(stage), 'right')

    expect(state.player).toEqual({ x: 3, y: 1 })
    expect(state.pushes).toBe(1)
    expect(state.dirUses).toBe(1)
  })

  it('짝 칸으로 튀어 나가도 한 번 쓴다', () => {
    const { state } = move(createState(withDirLimit(WARP_STAGE, 'right', 3)), 'right')

    expect(state.player).toEqual({ x: 4, y: 1 })
    expect(state.dirUses).toBe(1)
  })

  it('발판 길 쪽으로 밀어 기다려도 한 번 쓴다', () => {
    const stage = withDirLimit(withTram({ x: 3, y: 1 }), 'right', 3)
    const { state } = move(createState(stage), 'right')

    expect(state.player).toEqual({ x: 0, y: 1 })
    expect(state.moves).toBe(1)
    expect(state.dirUses).toBe(1)
  })

  it('제한을 다 쓰면 그 방향만 막히고 다른 방향은 그대로 된다', () => {
    const stage = withDirLimit(DIR_STAGE, 'left', 1)
    const used: GameState = { ...createState(stage), dirUses: 1 }
    const { state, events } = move(used, 'left')

    expect(state).toBe(used)
    expect(events).toEqual([
      { type: 'blocked', direction: 'left' },
      { type: 'limit', limit: 'dir' },
    ])
    expect(move(used, 'right').state.player).toEqual({ x: 3, y: 1 })
  })
})

describe('dirLeft', () => {
  it('제한이 없으면 null을 돌려준다', () => {
    expect(dirLeft(createState(DIR_STAGE))).toBe(null)
  })

  it('제한이 있으면 남은 횟수를 돌려준다', () => {
    const stage = withDirLimit(DIR_STAGE, 'left', 2)

    expect(dirLeft(createState(stage))).toBe(2)
    expect(dirLeft(move(createState(stage), 'left').state)).toBe(1)
  })
})

describe('보스 제약에 막힌 신호', () => {
  it('이동 제한을 다 쓰면 limit 이벤트를 낸다', () => {
    const used = play({ ...FLAT_STAGE, rules: { moveLimit: 2 } }, ['left', 'right']).state
    const { events } = move(used, 'up')

    expect(events).toContainEqual({ type: 'limit', limit: 'moves' })
  })

  it('밀기 제한을 다 쓰면 상자 위로 오르면서 limit 이벤트를 낸다', () => {
    const stage: Stage = { ...BOX_STAGE, rules: { pushLimit: 1 } }
    const { events } = play(stage, ['right', 'right'])

    expect(events).toContainEqual({ type: 'limit', limit: 'pushes' })
    expect(events).toContainEqual({
      type: 'climbed',
      from: { x: 1, y: 1 },
      to: { x: 2, y: 1 },
      via: 'box',
    })
  })

  it('올라가기 제한을 다 쓰면 limit 이벤트를 낸다', () => {
    const stage: Stage = { ...CLIMB_BOX_STAGE, rules: { climbLimit: 1 } }
    const { events } = play(stage, ['right', 'left', 'right'])

    expect(events).toContainEqual({ type: 'limit', limit: 'climbs' })
  })

  it('사다리로 오르지 못할 때도 limit 이벤트를 낸다', () => {
    const stage: Stage = { ...LADDER_STAGE, rules: { climbLimit: 1 } }
    const { events } = play(stage, ['right', 'right', 'right', 'right', 'left', 'right', 'right'])

    expect(events).toContainEqual({ type: 'limit', limit: 'climbs' })
  })

  it('타는 횟수 제한을 다 쓰면 limit 이벤트를 낸다', () => {
    const stage: Stage = { ...TRAM_STAGE, rules: { rideLimit: 1 } }
    const used: GameState = { ...createState(stage), rides: 1 }

    expect(move(used, 'right').events).toContainEqual({ type: 'limit', limit: 'rides' })
  })

  it('방향 제한을 다 쓰면 limit 이벤트를 낸다', () => {
    const used: GameState = { ...createState(withDirLimit(DIR_STAGE, 'left', 1)), dirUses: 1 }

    expect(move(used, 'left').events).toContainEqual({ type: 'limit', limit: 'dir' })
  })

  it('제한이 없는 판에서는 막혀도 limit 이벤트가 나오지 않는다', () => {
    const cases: MoveResult[] = [
      play(BOX_STAGE, ['right', 'right']),
      play(CLIMB_BOX_STAGE, ['right']),
      play(FLAT_STAGE, ['up', 'up']),
      move(createState(TRAM_STAGE), 'right'),
    ]

    for (const { events } of cases) {
      expect(events.some((e) => e.type === 'limit')).toBe(false)
    }
  })
})

describe('windLeft', () => {
  it('바람이 부는 판에서만 다음 바람까지 남은 수를 4부터 센다', () => {
    const counts = [0, 1, 2, 3, 4, 5].map((moves) =>
      windLeft({ ...createState(WIND_STAGE), moves }),
    )

    expect(counts).toEqual([4, 3, 2, 1, 4, 3])
    expect(windLeft(createState(FLAT_STAGE))).toBeNull()
  })
})
