import { describe, expect, it } from 'vitest'

import { VALID, errorsOf } from './testStages'

// 윗줄 불씨 (1,0)과 숯 벽 (2,0), 아랫줄 숯 다리 (2,1)
const FIRE_VALID = {
  ...VALID,
  heights: [
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  fire: ['.*#.', '..=.'],
  start: { x: 0, y: 0 },
  goal: { x: 3, y: 1 },
  entities: [],
  guides: undefined,
  zones: [{ x: 0, y: 0, w: 4, h: 2 }],
}

describe('checkFire', () => {
  it('불은 없어도 되고 있으면 heights와 같은 모양이어야 한다', () => {
    const shape = 'fire는 heights와 같은 모양의 문자열 배열이어야 한다'

    expect(errorsOf({ ...FIRE_VALID, fire: undefined })).toEqual([])
    expect(errorsOf(FIRE_VALID)).toEqual([])
    expect(errorsOf({ ...FIRE_VALID, fire: ['.*#.'] })).toContain(shape)
    expect(errorsOf({ ...FIRE_VALID, fire: ['.*#', '..=.'] })).toContain(shape)
    expect(errorsOf({ ...FIRE_VALID, fire: '.*#.' })).toContain(shape)
  })

  it('불 값은 점이나 *, #, =여야 한다', () => {
    expect(errorsOf({ ...FIRE_VALID, fire: ['.*#.', '..1.'] })).toContain(
      'fire 값은 점이나 *, #, =여야 한다',
    )
  })

  it('바닥 없는 칸에는 불씨와 숯을 둘 수 없다', () => {
    const heights = [
      [0, 0, 0, 0],
      [0, 0, -1, 0],
    ]

    expect(errorsOf({ ...FIRE_VALID, heights })).toContain('바닥 없는 칸에 불씨나 숯이 있다')
  })

  it('물, 얼음, 무너지는 칸, 늪, 버섯과 겹칠 수 없다', () => {
    const on = (extra: object) => errorsOf({ ...FIRE_VALID, ...extra })

    expect(on({ water: 1 })).toContain('물 칸에 불씨나 숯이 있다')
    expect(on({ ice: ['..#.', '....'] })).toContain('얼음 칸에 불씨나 숯이 있다')
    expect(on({ cracks: ['.2..', '....'] })).toContain('무너지는 칸에 불씨나 숯이 있다')
    expect(on({ swamp: ['....', '..#.'] })).toContain('늪 칸에 불씨나 숯이 있다')
    expect(on({ mushroom: ['.#..', '....'] })).toContain('버섯 칸에 불씨나 숯이 있다')
  })

  it('start와 goal은 불씨나 숯 칸에 둘 수 없다', () => {
    expect(errorsOf({ ...FIRE_VALID, start: { x: 1, y: 0 } })).toContain(
      'start가 불씨나 숯 칸에 있다',
    )
    expect(errorsOf({ ...FIRE_VALID, goal: { x: 2, y: 1 } })).toContain(
      'goal이 불씨나 숯 칸에 있다',
    )
  })

  it('불씨나 숯 칸에는 숯 다리 위 상자만 둘 수 있다', () => {
    const on = (entity: object) => errorsOf({ ...FIRE_VALID, entities: [entity] })

    expect(on({ type: 'box', x: 2, y: 1 })).toEqual([])
    expect(on({ type: 'box', x: 2, y: 0 })).toContain('entities[0]가 불씨나 숯 칸에 있다')
    expect(on({ type: 'box', x: 1, y: 0 })).toContain('entities[0]가 불씨나 숯 칸에 있다')
    expect(on({ type: 'ladder', x: 2, y: 1 })).toContain('entities[0]가 불씨나 숯 칸에 있다')
    expect(on({ type: 'switch', x: 1, y: 0, target: 'a' })).toContain(
      'entities[0]가 불씨나 숯 칸에 있다',
    )
  })

  it('움직이는 발판 길과 덩굴 길은 불씨나 숯 칸을 지날 수 없다', () => {
    const tram = {
      type: 'tram',
      id: 't',
      level: 0,
      x: 3,
      y: 0,
      dir: 1,
      cells: [
        { x: 3, y: 0 },
        { x: 2, y: 0 },
      ],
    }
    const vine = { type: 'vine', id: 'v', x: 3, y: 1, cells: [{ x: 2, y: 1 }] }

    expect(errorsOf({ ...FIRE_VALID, entities: [tram] })).toContain(
      'entities[0]의 길이 불씨나 숯 칸을 지난다',
    )
    expect(errorsOf({ ...FIRE_VALID, entities: [vine] })).toContain(
      'entities[0]의 길이 불씨나 숯 칸을 지난다',
    )
  })

  it('맞닿은 불씨와 숯은 높이 차 한 층까지 둘 수 있다', () => {
    const steep = '맞닿은 불씨나 숯 (1,0)과 (2,0)의 높이 차가 두 층 이상이다'
    const raise = (h: number) => ({
      ...FIRE_VALID,
      heights: [
        [0, 0, h, 0],
        [0, 0, 0, 0],
      ],
    })

    expect(errorsOf(raise(1))).toEqual([])
    expect(errorsOf(raise(2))).toContain(steep)
  })

  it('불씨 칸 없이 숯만 있는 판은 실패한다', () => {
    expect(errorsOf({ ...FIRE_VALID, fire: ['..#.', '..=.'] })).toContain('불씨 칸 없이 숯이 있다')
  })

  it('쫓아오는 불은 참이나 거짓이고 불씨 칸이 있는 판에만 쓴다', () => {
    expect(errorsOf({ ...FIRE_VALID, rules: { chase: true } })).toEqual([])
    expect(errorsOf({ ...FIRE_VALID, rules: { chase: 1 } })).toContain(
      'rules.chase는 참이나 거짓이어야 한다',
    )
    expect(errorsOf({ ...VALID, rules: { chase: true } })).toContain(
      'rules.chase 판에 불씨 칸이 없다',
    )
  })
})
