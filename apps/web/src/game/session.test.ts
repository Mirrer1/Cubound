import { describe, expect, it } from 'vitest'

import { createState, isLiftRaised, move } from './rules'
import { SESSION_VERSION, restoreSession, toSession } from './session'
import type { Direction, Stage } from './types'

const STAGE: Stage = {
  version: 1,
  id: '1-3',
  heights: [
    [0, 0, 0],
    [0, -1, 1],
  ],
  start: { x: 0, y: 0 },
  goal: { x: 2, y: 1 },
  entities: [{ type: 'box', x: 1, y: 0 }],
}

const MID = {
  heights: STAGE.heights,
  boxes: [{ x: 2, y: 0 }],
  cracks: [],
  trams: [],
  swamps: [],
  mushrooms: [],
  struggles: 0,
  ladders: [],
  leaningLadders: [],
  carrying: false,
  player: { x: 1, y: 0 },
  moves: 1,
  pushes: 1,
  climbs: 0,
  rides: 0,
  dirUses: 0,
  sinks: 0,
}

const saved = (state: object) => ({ version: SESSION_VERSION, stageId: '1-3', ...state })

describe('toSession', () => {
  it('스테이지 데이터 없이 중간 상태만 담는다', () => {
    const state = move(createState(STAGE), 'right').state

    expect(toSession(state)).toEqual(saved(MID))
  })
})

describe('restoreSession', () => {
  it('저장한 상태를 그대로 이어서 시작한다', () => {
    const state = move(createState(STAGE), 'right').state

    expect(restoreSession(toSession(state), STAGE)).toEqual(state)
  })

  it('저장된 것이 없거나 깨졌으면 null이다', () => {
    expect(restoreSession(undefined, STAGE)).toBeNull()
    expect(restoreSession(null, STAGE)).toBeNull()
    expect(restoreSession('깨진 값', STAGE)).toBeNull()
  })

  it('버전이 다르면 버린다', () => {
    expect(restoreSession({ ...saved(MID), version: 99 }, STAGE)).toBeNull()
  })

  it('다른 스테이지의 기록이면 버린다', () => {
    expect(restoreSession({ ...saved(MID), stageId: '1-4' }, STAGE)).toBeNull()
  })

  it('맵 크기가 달라졌으면 버린다', () => {
    expect(restoreSession(saved({ ...MID, heights: [[0, 0, 0]] }), STAGE)).toBeNull()
  })

  it('큐브가 맵 밖이면 버린다', () => {
    expect(restoreSession(saved({ ...MID, player: { x: 9, y: 0 } }), STAGE)).toBeNull()
  })

  it('큐브가 바닥 없는 칸이면 버린다', () => {
    expect(restoreSession(saved({ ...MID, player: { x: 1, y: 1 } }), STAGE)).toBeNull()
  })

  it('상자로 메운 칸은 인정하고 그 위에 선 것도 이어간다', () => {
    const filled = [
      [0, 0, 0],
      [0, 0, 1],
    ]
    const session = saved({ ...MID, heights: filled, boxes: [], player: { x: 1, y: 1 } })

    expect(restoreSession(session, STAGE)?.player).toEqual({ x: 1, y: 1 })
  })

  it('메운 칸이 아닌데 높이가 다르면 버린다', () => {
    const changed = [
      [0, 0, 3],
      [0, -1, 1],
    ]
    expect(restoreSession(saved({ ...MID, heights: changed }), STAGE)).toBeNull()
  })

  it('상자가 스테이지보다 많으면 버린다', () => {
    const many = [
      { x: 2, y: 0 },
      { x: 0, y: 1 },
    ]
    expect(restoreSession(saved({ ...MID, boxes: many }), STAGE)).toBeNull()
  })

  it('상자가 바닥 없는 칸에 있으면 버린다', () => {
    expect(restoreSession(saved({ ...MID, boxes: [{ x: 1, y: 1 }] }), STAGE)).toBeNull()
  })

  it('사다리가 스테이지보다 많으면 버린다', () => {
    expect(restoreSession(saved({ ...MID, ladders: [{ x: 0, y: 1 }] }), STAGE)).toBeNull()
  })

  it('이동 수가 음수이거나 정수가 아니면 버린다', () => {
    expect(restoreSession(saved({ ...MID, moves: -1 }), STAGE)).toBeNull()
    expect(restoreSession(saved({ ...MID, moves: 1.5 }), STAGE)).toBeNull()
  })

  it('민 횟수를 그대로 이어간다', () => {
    const state = move(createState(STAGE), 'right').state

    expect(state.pushes).toBe(1)
    expect(restoreSession(toSession(state), STAGE)?.pushes).toBe(1)
  })

  it('민 횟수가 음수이거나 정수가 아니면 버린다', () => {
    expect(restoreSession(saved({ ...MID, pushes: -1 }), STAGE)).toBeNull()
    expect(restoreSession(saved({ ...MID, pushes: 1.5 }), STAGE)).toBeNull()
  })

  it('오른 횟수를 그대로 이어간다', () => {
    const stage: Stage = {
      ...STAGE,
      heights: [
        [0, 0, 1],
        [0, -1, 1],
      ],
    }
    const state = move(createState(stage), 'right').state

    expect(state.climbs).toBe(1)
    expect(restoreSession(toSession(state), stage)?.climbs).toBe(1)
  })

  it('오른 횟수가 음수이거나 정수가 아니면 버린다', () => {
    expect(restoreSession(saved({ ...MID, climbs: -1 }), STAGE)).toBeNull()
    expect(restoreSession(saved({ ...MID, climbs: 1.5 }), STAGE)).toBeNull()
  })

  it('탄 횟수가 음수이거나 정수가 아니면 버린다', () => {
    expect(restoreSession(saved({ ...MID, rides: -1 }), STAGE)).toBeNull()
    expect(restoreSession(saved({ ...MID, rides: 1.5 }), STAGE)).toBeNull()
  })

  it('탄 횟수가 없는 예전 저장은 0으로 읽는다', () => {
    const { rides: _rides, ...old } = MID
    expect(restoreSession(saved(old), STAGE)?.rides).toBe(0)
  })

  it('제한 방향을 쓴 횟수가 음수이거나 정수가 아니면 버린다', () => {
    expect(restoreSession(saved({ ...MID, dirUses: -1 }), STAGE)).toBeNull()
    expect(restoreSession(saved({ ...MID, dirUses: 1.5 }), STAGE)).toBeNull()
  })

  it('제한 방향을 쓴 횟수가 없는 예전 저장은 0으로 읽는다', () => {
    const { dirUses: _dirUses, ...old } = MID
    expect(restoreSession(saved(old), STAGE)?.dirUses).toBe(0)
  })

  it('제한 방향을 쓴 횟수를 그대로 이어간다', () => {
    const stage: Stage = { ...STAGE, rules: { dirLimit: { dir: 'right', count: 3 } } }
    const state = move(createState(stage), 'right').state

    expect(state.dirUses).toBe(1)
    expect(restoreSession(toSession(state), stage)?.dirUses).toBe(1)
  })

  it('이어서 시작한 상태는 클리어 전이다', () => {
    expect(restoreSession(saved(MID), STAGE)?.cleared).toBe(false)
  })
})

const CRACK_STAGE: Stage = {
  version: 1,
  id: '3-1',
  heights: [[0, 0, 0]],
  start: { x: 0, y: 0 },
  goal: { x: 2, y: 0 },
  entities: [],
  cracks: ['.2.'],
}

const crossed = (directions: Direction[]) =>
  directions.reduce((state, d) => move(state, d).state, createState(CRACK_STAGE))

describe('restoreSession 무너지는 칸', () => {
  it('남은 횟수를 그대로 이어간다', () => {
    const state = crossed(['right', 'left'])
    const restored = restoreSession(toSession(state), CRACK_STAGE)

    expect(state.cracks).toEqual([{ x: 1, y: 0, left: 1 }])
    expect(restored).toEqual(state)
  })

  it('무너진 칸을 그대로 이어간다', () => {
    const state = crossed(['right', 'left', 'right', 'left'])
    const restored = restoreSession(toSession(state), CRACK_STAGE)

    expect(state.heights[0][1]).toBe(-1)
    expect(restored).toEqual(state)
  })

  it('스테이지의 무너지는 칸과 어긋나면 버린다', () => {
    const state = crossed(['right', 'left'])
    const session = toSession(state)

    expect(restoreSession({ ...session, cracks: [] }, CRACK_STAGE)).toBeNull()
    expect(
      restoreSession({ ...session, cracks: [{ x: 0, y: 0, left: 1 }] }, CRACK_STAGE),
    ).toBeNull()
    expect(
      restoreSession({ ...session, cracks: [{ x: 1, y: 0, left: 3 }] }, CRACK_STAGE),
    ).toBeNull()
    expect(restoreSession({ ...session, cracks: undefined }, CRACK_STAGE)).toBeNull()
  })
})

const LIFT_STAGE: Stage = {
  version: 1,
  id: '2-9',
  heights: [[0, 0, 0]],
  start: { x: 0, y: 0 },
  goal: { x: 2, y: 0 },
  entities: [{ type: 'switch', x: 1, y: 0, target: 'a' }],
}

describe('restoreSession 발판', () => {
  it('발판 상태를 담지 않아도 스위치를 누른 자리에서 올라간 채로 살아난다', () => {
    const stage: Stage = {
      ...LIFT_STAGE,
      heights: [[0, 0, 0, 0]],
      goal: { x: 3, y: 0 },
      entities: [...LIFT_STAGE.entities, { type: 'lift', x: 2, y: 0, id: 'a' }],
    }
    const state = move(createState(stage), 'right').state
    const session = toSession(state)

    expect(restoreSession(session, stage)).toEqual(state)
    expect(isLiftRaised(restoreSession(session, stage)!, 'a')).toBe(true)
  })
})

const TRAM_STAGE: Stage = {
  version: 1,
  id: '4-1',
  heights: [
    [0, 0, 0, 0, 0],
    [0, -1, -1, -1, 0],
  ],
  start: { x: 0, y: 1 },
  goal: { x: 4, y: 1 },
  entities: [
    {
      type: 'tram',
      x: 1,
      y: 1,
      id: 'tram-a',
      level: 0,
      cells: [
        { x: 1, y: 1 },
        { x: 2, y: 1 },
        { x: 3, y: 1 },
      ],
      dir: 1,
    },
  ],
}

describe('restoreSession 움직이는 발판', () => {
  it('발판 자리와 방향을 그대로 이어간다', () => {
    const state = move(createState(TRAM_STAGE), 'up').state

    expect(state.trams).toEqual([{ id: 'tram-a', at: 1, dir: 1 }])
    expect(restoreSession(toSession(state), TRAM_STAGE)).toEqual(state)
  })

  it('발판에 탄 채로 나가도 그 자리에서 이어간다', () => {
    const state = move(createState(TRAM_STAGE), 'right').state

    expect(state.player).toEqual({ x: 2, y: 1 })
    expect(TRAM_STAGE.heights[1][2]).toBe(-1)
    expect(restoreSession(toSession(state), TRAM_STAGE)).toEqual(state)
  })

  it('탄 횟수를 그대로 이어간다', () => {
    const rode = move(createState(TRAM_STAGE), 'right').state
    const state = move(rode, 'up').state

    expect(state.rides).toBe(1)
    expect(restoreSession(toSession(state), TRAM_STAGE)?.rides).toBe(1)
  })

  it('스테이지의 발판과 어긋나면 버린다', () => {
    const session = toSession(move(createState(TRAM_STAGE), 'up').state)

    expect(restoreSession({ ...session, trams: [] }, TRAM_STAGE)).toBeNull()
    expect(restoreSession({ ...session, trams: undefined }, TRAM_STAGE)).toBeNull()
    expect(
      restoreSession({ ...session, trams: [{ id: 'tram-b', at: 1, dir: 1 }] }, TRAM_STAGE),
    ).toBeNull()
    expect(
      restoreSession({ ...session, trams: [{ id: 'tram-a', at: 3, dir: 1 }] }, TRAM_STAGE),
    ).toBeNull()
    expect(
      restoreSession({ ...session, trams: [{ id: 'tram-a', at: 1, dir: 0 }] }, TRAM_STAGE),
    ).toBeNull()
  })
})

const SWAMP_STAGE: Stage = {
  version: 1,
  id: '6-1',
  heights: [[0, 0, 0]],
  start: { x: 0, y: 0 },
  goal: { x: 2, y: 0 },
  entities: [],
  swamp: ['.#.'],
}

describe('restoreSession 늪', () => {
  it('버둥거린 수와 남은 늪 칸을 그대로 이어간다', () => {
    const entered = move(createState(SWAMP_STAGE), 'right').state
    const state = move(entered, 'right').state

    expect(state.struggles).toBe(1)
    expect(restoreSession(toSession(state), SWAMP_STAGE)).toEqual(state)
  })

  it('늪이 없던 때 저장한 것은 늪 칸 전부와 버둥 0으로 읽는다', () => {
    const session = {
      ...toSession(createState(SWAMP_STAGE)),
      swamps: undefined,
      struggles: undefined,
    }
    const state = restoreSession(session, SWAMP_STAGE)

    expect(state?.swamps).toEqual([{ x: 1, y: 0 }])
    expect(state?.struggles).toBe(0)
  })

  it('스테이지에 없는 늪 칸이나 버둥 수가 들어오면 버린다', () => {
    const session = toSession(createState(SWAMP_STAGE))

    expect(restoreSession({ ...session, swamps: [{ x: 0, y: 0 }] }, SWAMP_STAGE)).toBeNull()
    expect(restoreSession({ ...session, struggles: 3 }, SWAMP_STAGE)).toBeNull()
    expect(restoreSession({ ...session, struggles: -1 }, SWAMP_STAGE)).toBeNull()
  })
})

const DEEP_SWAMP_STAGE: Stage = {
  version: 1,
  id: '6-10',
  heights: [[0, 0, 0, 0]],
  start: { x: 0, y: 0 },
  goal: { x: 3, y: 0 },
  entities: [],
  swamp: ['.#..'],
  rules: { swampDeepen: true },
}

describe('restoreSession 깊어지는 늪', () => {
  it('빠진 횟수를 그대로 이어간다', () => {
    const state = move(createState(DEEP_SWAMP_STAGE), 'right').state

    expect(state.sinks).toBe(1)
    expect(restoreSession(toSession(state), DEEP_SWAMP_STAGE)).toEqual(state)
  })

  it('깊어지는 늪이 없던 때 저장한 것은 빠진 횟수 0으로 읽는다', () => {
    const session = { ...toSession(createState(DEEP_SWAMP_STAGE)), sinks: undefined }

    expect(restoreSession(session, DEEP_SWAMP_STAGE)?.sinks).toBe(0)
  })

  it('빠진 횟수가 깨졌거나 버둥 수가 그보다 많으면 버린다', () => {
    const session = toSession(createState(DEEP_SWAMP_STAGE))

    expect(restoreSession({ ...session, sinks: -1 }, DEEP_SWAMP_STAGE)).toBeNull()
    expect(restoreSession({ ...session, sinks: 2, struggles: 5 }, DEEP_SWAMP_STAGE)).toBeNull()
    expect(restoreSession({ ...session, sinks: 2, struggles: 3 }, DEEP_SWAMP_STAGE)).not.toBeNull()
  })
})
