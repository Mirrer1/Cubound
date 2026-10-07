import { describe, expect, it } from 'vitest'

import { createState, isLiftRaised, move, tideLeft, windLeft } from './rules'
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
  tethered: [],
  plugged: [],
  stones: [],
  iced: [],
  melt: null,
  cracks: [],
  trams: [],
  swamps: [],
  mushrooms: [],
  vines: [],
  struggles: 0,
  ladders: [],
  leaningLadders: [],
  seeds: [],
  planted: [],
  carrying: null,
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

  it('든 것이 참과 거짓이던 예전 저장은 참을 사다리로 읽는다', () => {
    const stage: Stage = { ...STAGE, entities: [...STAGE.entities, { type: 'ladder', x: 0, y: 1 }] }

    expect(restoreSession(saved({ ...MID, carrying: true }), stage)?.carrying).toBe('ladder')
    expect(restoreSession(saved({ ...MID, carrying: false }), stage)?.carrying).toBeNull()
    expect(restoreSession(saved({ ...MID, carrying: true }), STAGE)).toBeNull()
  })

  it('든 것이 사다리도 씨앗도 아니면 버린다', () => {
    expect(restoreSession(saved({ ...MID, carrying: 'box' }), STAGE)).toBeNull()
    expect(restoreSession(saved({ ...MID, carrying: 'seed' }), STAGE)).toBeNull()
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

const VINE_STAGE: Stage = {
  version: 1,
  id: '8-1',
  heights: [[0, 0, -1, -1, 0]],
  start: { x: 0, y: 0 },
  goal: { x: 4, y: 0 },
  entities: [
    {
      type: 'vine',
      id: 'vine-a',
      x: 1,
      y: 0,
      cells: [
        { x: 2, y: 0 },
        { x: 3, y: 0 },
      ],
    },
  ],
}

// (3, 0)이 한 층 높아 (2, 0)에 심는 판
const SEED_STAGE: Stage = {
  version: 1,
  id: '9-1',
  heights: [
    [0, 0, 0, 1],
    [0, 0, 0, 0],
  ],
  start: { x: 0, y: 0 },
  goal: { x: 3, y: 1 },
  entities: [
    { type: 'seed', x: 1, y: 0 },
    { type: 'seed', x: 1, y: 1 },
  ],
}

const played = (stage: Stage, directions: Direction[]) =>
  directions.reduce((state, d) => move(state, d).state, createState(stage))

// 하나를 (2, 0)에 심고 두 수 뒤 다른 하나를 주운 상태
const SEEDED: Direction[] = ['right', 'right', 'right', 'down', 'left']

describe('restoreSession 씨앗', () => {
  it('심은 칸의 남은 수와 든 것을 그대로 이어간다', () => {
    const state = played(SEED_STAGE, SEEDED)

    expect(state.planted).toEqual([{ x: 2, y: 0, left: 2, rises: 0 }])
    expect(state.carrying).toBe('seed')
    expect(state.seeds).toEqual([])
    expect(restoreSession(toSession(state), SEED_STAGE)).toEqual(state)
  })

  it('솟은 높이와 콩나무의 층을 그대로 이어간다', () => {
    const stage: Stage = { ...SEED_STAGE, rules: { seedGrow: true } }
    const state = played(stage, [...SEEDED, 'right', 'left'])

    expect(state.heights[0][2]).toBe(1)
    expect(state.planted).toEqual([{ x: 2, y: 0, left: 4, rises: 1 }])
    expect(restoreSession(toSession(state), stage)).toEqual(state)
  })

  it('씨앗이 없던 때 저장한 것은 바닥의 씨앗을 스테이지대로 읽는다', () => {
    const { seeds: _seeds, planted: _planted, ...session } = toSession(createState(SEED_STAGE))
    const state = restoreSession(session, SEED_STAGE)

    expect(state?.seeds).toEqual([
      { x: 1, y: 0 },
      { x: 1, y: 1 },
    ])
    expect(state?.planted).toEqual([])
  })

  it('씨앗이 스테이지보다 많으면 버린다', () => {
    const session = toSession(played(SEED_STAGE, SEEDED))
    const more = { ...session, seeds: [{ x: 0, y: 1 }] }

    expect(restoreSession(more, SEED_STAGE)).toBeNull()
  })

  it('심은 칸의 값이 어긋나면 버린다', () => {
    const session = toSession(played(SEED_STAGE, SEEDED))
    const planted = (value: unknown) => restoreSession({ ...session, planted: value }, SEED_STAGE)

    expect(planted([{ x: 2, y: 0, left: 4, rises: 0 }])?.planted).toEqual([
      { x: 2, y: 0, left: 4, rises: 0 },
    ])
    expect(planted([{ x: 2, y: 0, left: 0, rises: 0 }])).toBeNull()
    expect(planted([{ x: 2, y: 0, left: 5, rises: 0 }])).toBeNull()
    expect(planted([{ x: 2, y: 0, left: 2, rises: 1 }])).toBeNull()
    expect(planted([{ x: 9, y: 0, left: 2, rises: 0 }])).toBeNull()
    expect(planted('2,0')).toBeNull()
  })

  it('씨앗이 없는 판에서 바닥이 솟아 있으면 버린다', () => {
    const risen = toSession(played(SEED_STAGE, [...SEEDED, 'right', 'left']))
    const stage: Stage = { ...SEED_STAGE, entities: [] }

    expect(restoreSession(risen, SEED_STAGE)?.heights[0][2]).toBe(1)
    expect(restoreSession({ ...risen, seeds: [], carrying: null }, stage)).toBeNull()
  })
})

describe('restoreSession 덩굴', () => {
  it('자란 길이와 굳은 것을 그대로 이어간다', () => {
    const stage: Stage = { ...VINE_STAGE, rules: { vineStop: true } }
    const state = move(move(createState(stage), 'right').state, 'right').state

    expect(state.vines).toEqual([{ id: 'vine-a', grown: 1, stopped: true }])
    expect(restoreSession(toSession(state), stage)).toEqual(state)
  })

  it('덩굴이 없던 때 저장한 것은 하나도 안 자란 것으로 읽는다', () => {
    const { vines: _, ...session } = toSession(createState(VINE_STAGE))

    expect(restoreSession(session, VINE_STAGE)?.vines).toEqual([
      { id: 'vine-a', grown: 0, stopped: false },
    ])
  })

  it('스테이지의 덩굴과 어긋나면 버린다', () => {
    const session = toSession(createState(VINE_STAGE))
    const vines = (value: unknown) => restoreSession({ ...session, vines: value }, VINE_STAGE)

    expect(vines([])).toBeNull()
    expect(vines([{ id: 'vine-b', grown: 0, stopped: false }])).toBeNull()
    expect(vines([{ id: 'vine-a', grown: 3, stopped: false }])).toBeNull()
    expect(vines([{ id: 'vine-a', grown: -1, stopped: false }])).toBeNull()
    expect(vines([{ id: 'vine-a', grown: 0, stopped: 1 }])).toBeNull()
  })
})

describe('restoreSession 바람', () => {
  it('이동 수에서 다음 바람까지 남은 수를 그대로 이어간다', () => {
    const stage: Stage = {
      version: 1,
      id: '10-10',
      heights: [[0, 0, 0, 0, 0, 0]],
      start: { x: 2, y: 0 },
      goal: { x: 5, y: 0 },
      entities: [],
      rules: { wind: 'left' },
    }
    const state = (['right', 'left', 'right'] as Direction[]).reduce(
      (s, d) => move(s, d).state,
      createState(stage),
    )
    const restored = restoreSession(toSession(state), stage)

    expect(restored).toEqual(state)
    expect(restored && windLeft(restored)).toBe(1)
    expect(restored && move(restored, 'right').state.player).toEqual({ x: 3, y: 0 })
  })
})

describe('restoreSession 묶인 배', () => {
  // 물 높이 1, (0,1) 말뚝에 줄 길이 2로 묶인 배가 (1,1)
  const TETHER_STAGE: Stage = {
    version: 1,
    id: '11-10',
    heights: [
      [1, 1, 1, 1, 1],
      [1, 0, 0, 0, 1],
      [1, 1, 1, 1, 1],
    ],
    water: 1,
    start: { x: 1, y: 0 },
    goal: { x: 4, y: 2 },
    entities: [
      { type: 'box', x: 1, y: 1 },
      { type: 'post', x: 0, y: 1, length: 2, boat: { x: 1, y: 1 } },
    ],
  }
  const rowed = (['down', 'right'] as Direction[]).reduce(
    (s, d) => move(s, d).state,
    createState(TETHER_STAGE),
  )

  it('묶인 배 자리를 그대로 이어가고 줄 길이 끝에서 막힌다', () => {
    const restored = restoreSession(toSession(rowed), TETHER_STAGE)

    expect(restored).toEqual(rowed)
    expect(restored?.tethered).toEqual([{ x: 2, y: 1 }])
    expect(restored && move(restored, 'right').state).toBe(restored)
  })

  it('묶인 배가 없던 때 저장한 것은 판의 처음 자리로 읽는다', () => {
    const session = { ...toSession(createState(TETHER_STAGE)), tethered: undefined }

    expect(restoreSession(session, TETHER_STAGE)?.tethered).toEqual([{ x: 1, y: 1 }])
  })

  it('묶인 배가 상자 자리에 없거나 말뚝 수와 다르면 버린다', () => {
    const session = toSession(rowed)

    expect(restoreSession({ ...session, tethered: [{ x: 3, y: 1 }] }, TETHER_STAGE)).toBeNull()
    expect(restoreSession({ ...session, tethered: [] }, TETHER_STAGE)).toBeNull()
    expect(restoreSession({ ...session, tethered: undefined }, TETHER_STAGE)).toBeNull()
  })
})

describe('restoreSession 소용돌이', () => {
  // 물 높이 1, (1,2) 소용돌이 위 (1,1)에 마개로 밀어 넣을 땅 상자
  const PLUG_STAGE: Stage = {
    version: 1,
    id: '12-10',
    heights: [
      [1, 1, 1, 1],
      [1, 1, 1, 1],
      [1, 0, 0, 1],
      [1, 1, 1, 1],
    ],
    water: 1,
    start: { x: 1, y: 0 },
    goal: { x: 3, y: 3 },
    entities: [
      { type: 'whirlpool', x: 1, y: 2 },
      { type: 'box', x: 1, y: 1 },
    ],
    rules: { plug: true },
  }
  const plugged = move(createState(PLUG_STAGE), 'down').state

  it('막힌 소용돌이를 그대로 이어간다', () => {
    const restored = restoreSession(toSession(plugged), PLUG_STAGE)

    expect(restored).toEqual(plugged)
    expect(restored?.plugged).toEqual([{ x: 1, y: 2 }])
  })

  it('막힌 소용돌이가 없던 때 저장한 것은 막힌 것 없이 읽는다', () => {
    const session = { ...toSession(createState(PLUG_STAGE)), plugged: undefined }

    expect(restoreSession(session, PLUG_STAGE)?.plugged).toEqual([])
  })

  it('소용돌이가 아닌 칸이나 겹친 칸이 막혔다고 하면 버린다', () => {
    const session = toSession(plugged)
    const at = { x: 1, y: 2 }

    expect(restoreSession({ ...session, plugged: [{ x: 2, y: 2 }] }, PLUG_STAGE)).toBeNull()
    expect(restoreSession({ ...session, plugged: [at, at] }, PLUG_STAGE)).toBeNull()
  })
})

describe('restoreSession 얼음 돌', () => {
  // 물 높이 1, (1,1) 돌을 띄우고 (2,1) 상자를 언 칸 (2,2) 위로 민 판
  const STONE_STAGE: Stage = {
    version: 1,
    id: '13-10',
    heights: [
      [1, 1, 1, 1],
      [1, 1, 1, 1],
      [1, 0, 0, 0],
      [1, 0, 0, 0],
    ],
    water: 1,
    start: { x: 1, y: 0 },
    goal: { x: 0, y: 3 },
    entities: [
      { type: 'iceStone', x: 1, y: 1 },
      { type: 'box', x: 2, y: 1 },
    ],
    rules: { melt: 5 },
  }
  const iced = played(STONE_STAGE, ['down', 'up', 'right', 'down'])

  it('돌 자리와 언 칸 위 상자와 녹는 숫자를 그대로 이어간다', () => {
    expect(iced.stones).toEqual([{ x: 1, y: 2 }])
    expect(iced.iced).toEqual([{ x: 2, y: 2 }])
    expect(iced.melt).toBe(2)
    expect(restoreSession(toSession(iced), STONE_STAGE)).toEqual(iced)
  })

  it('얼음 돌이 없던 때 저장한 것은 판의 처음 돌로 읽는다', () => {
    const session = {
      ...toSession(createState(STONE_STAGE)),
      stones: undefined,
      iced: undefined,
      melt: undefined,
    }

    expect(restoreSession(session, STONE_STAGE)).toEqual(createState(STONE_STAGE))
  })

  it('판 숫자보다 큰 녹는 숫자와 상자가 없는 언 칸 위 상자는 버린다', () => {
    const session = toSession(iced)

    expect(restoreSession({ ...session, melt: 6 }, STONE_STAGE)).toBeNull()
    expect(restoreSession({ ...session, iced: [{ x: 3, y: 3 }] }, STONE_STAGE)).toBeNull()
    expect(restoreSession({ ...session, stones: [{ x: 9, y: 9 }] }, STONE_STAGE)).toBeNull()
  })
})

describe('restoreSession 밀물', () => {
  it('이동 수에서 다음 물때까지 남은 수를 그대로 이어간다', () => {
    const stage: Stage = {
      version: 1,
      id: '15-10',
      heights: [
        [2, 2, 2],
        [2, 1, 2],
      ],
      water: 1,
      start: { x: 0, y: 0 },
      goal: { x: 2, y: 1 },
      entities: [],
      rules: { tide: true },
    }
    const state = (['right', 'left', 'right'] as Direction[]).reduce(
      (s, d) => move(s, d).state,
      createState(stage),
    )
    const restored = restoreSession(toSession(state), stage)

    expect(restored).toEqual(state)
    expect(restored && tideLeft(restored)).toEqual({ left: 1, up: true })
    expect(restored && move(restored, 'down').events).toContainEqual({
      type: 'limit',
      limit: 'tide',
    })
  })
})
