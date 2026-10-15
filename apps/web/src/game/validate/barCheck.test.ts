import { describe, expect, it } from 'vitest'

import { VALID, errorsOf } from './testStages'

// 막대 (0,1)-(1,1), 스위치 (2,1)
const BAR_VALID = {
  ...VALID,
  heights: [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ],
  start: { x: 0, y: 0 },
  goal: { x: 2, y: 0 },
  entities: [{ type: 'bar', x: 0, y: 1, axis: 'x' }],
  guides: undefined,
  zones: [{ x: 0, y: 0, w: 3, h: 3 }],
}

const withEntities = (...entities: object[]) => errorsOf({ ...BAR_VALID, entities })

describe('checkBars', () => {
  it('가로 막대와 세로 막대를 둘 수 있다', () => {
    expect(errorsOf(BAR_VALID)).toEqual([])
    expect(withEntities({ type: 'bar', x: 1, y: 1, axis: 'y' })).toEqual([])
  })

  it('axis는 x나 y다', () => {
    expect(withEntities({ type: 'bar', x: 0, y: 1, axis: 'z' })).toContain(
      'entities[0]의 axis는 x나 y여야 한다',
    )
  })

  it('두 칸이 다 바닥이고 높이가 같아야 한다', () => {
    expect(withEntities({ type: 'bar', x: 2, y: 1, axis: 'x' })).toContain(
      'entities[0]의 막대 두 칸이 바닥 칸이 아니다',
    )
    const heights = [
      [0, 0, 0],
      [0, 1, 0],
      [0, 0, 0],
    ]
    expect(errorsOf({ ...BAR_VALID, heights })).toContain('entities[0]의 막대 두 칸 높이가 다르다')
  })

  it('둘째 칸도 다른 오브젝트, 시작과 목표 칸과 겹칠 수 없다', () => {
    expect(withEntities(BAR_VALID.entities[0], { type: 'box', x: 1, y: 1 })).toContain(
      'entities[0]의 막대가 다른 오브젝트와 같은 칸에 있다',
    )
    expect(withEntities(BAR_VALID.entities[0], { type: 'bar', x: 1, y: 0, axis: 'y' })).toContain(
      'entities[0]의 막대가 다른 오브젝트와 같은 칸에 있다',
    )
    expect(errorsOf({ ...BAR_VALID, goal: { x: 1, y: 1 } })).toContain(
      'entities[0]의 막대가 시작이나 목표 칸에 있다',
    )
  })

  it('스위치와 무너지는 칸 위에서 시작할 수 있다', () => {
    const entities = [
      BAR_VALID.entities[0],
      { type: 'switch', x: 1, y: 1, target: 'a' },
      { type: 'switch', x: 0, y: 1, target: 'a' },
      { type: 'door', x: 2, y: 2, id: 'a' },
    ]

    expect(errorsOf({ ...BAR_VALID, entities })).toEqual([])
    expect(errorsOf({ ...BAR_VALID, cracks: ['...', '22.', '...'] })).toEqual([])
  })

  it('불씨, 숯 벽, 화로 위에 둘 수 없고 숯 다리 위에는 둘 수 있다', () => {
    expect(errorsOf({ ...BAR_VALID, fire: ['...', '.#*', '...'] })).toContain(
      'entities[0]가 불씨나 숯 칸에 있다',
    )
    expect(errorsOf({ ...BAR_VALID, fire: ['...', '#=*', '...'] })).toContain(
      'entities[0]가 불씨나 숯 칸에 있다',
    )
    expect(errorsOf({ ...BAR_VALID, fire: ['...', '==*', '...'] })).toEqual([])
  })

  it('발판 길에 둘 수 없다', () => {
    const heights = [
      [0, 0, 0],
      [0, 0, -1],
      [0, 0, -1],
    ]
    const tram = {
      type: 'tram',
      id: 't',
      x: 2,
      y: 2,
      level: 0,
      cells: [
        { x: 2, y: 1 },
        { x: 2, y: 2 },
      ],
      dir: -1,
    }
    const entities = [{ type: 'bar', x: 1, y: 1, axis: 'x' }, tram]

    expect(errorsOf({ ...BAR_VALID, heights, entities })).toContain(
      'entities[0]의 막대 두 칸이 바닥 칸이 아니다',
    )
    const raised = heights.map((r) => r.map((h) => (h < 0 ? 0 : h)))
    expect(errorsOf({ ...BAR_VALID, heights: raised, entities })).toContain(
      'entities[0]의 막대가 발판 길에 있다',
    )
  })

  it('얼음, 늪, 버섯, 물, 바람, 덩굴, 씨앗과 한 판에 둘 수 없다', () => {
    const on = (extra: object) => errorsOf({ ...BAR_VALID, ...extra })
    const add = (entity: object) => withEntities(BAR_VALID.entities[0], entity)

    expect(on({ ice: ['...', '...', '.#.'] })).toContain('막대 판에 얼음이 있다')
    expect(on({ swamp: ['...', '...', '.#.'] })).toContain('막대 판에 늪이 있다')
    expect(on({ mushroom: ['...', '...', '.#.'] })).toContain('막대 판에 버섯이 있다')
    expect(
      on({
        water: 1,
        heights: [
          [1, 1, 1],
          [1, 1, 1],
          [1, 0, 1],
        ],
      }),
    ).toContain('막대 판에 물이 있다')
    expect(on({ rules: { wind: 'up' } })).toContain('막대 판에 바람이 있다')
    expect(add({ type: 'seed', x: 2, y: 2 })).toContain('막대 판에 씨앗이 있다')
    expect(add({ type: 'vine', id: 'v', x: 2, y: 2, cells: [{ x: 2, y: 1 }] })).toContain(
      '막대 판에 덩굴이 있다',
    )
  })

  it('달군 쇠 판에는 막대가 있어야 한다', () => {
    expect(errorsOf({ ...BAR_VALID, rules: { forge: true } })).toEqual([])
    expect(errorsOf({ ...BAR_VALID, entities: [], rules: { forge: true } })).toContain(
      'rules.forge 판에 막대가 없다',
    )
    expect(errorsOf({ ...BAR_VALID, rules: { forge: 1 } })).toContain(
      'rules.forge는 참이나 거짓이어야 한다',
    )
  })
})
