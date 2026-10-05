import { describe, expect, it } from 'vitest'

import { errorsOf } from './testStages'

describe('checkWater', () => {
  const WATER_VALID = {
    version: 1,
    id: 'water',
    heights: [
      [1, 1, 1, 1],
      [1, 0, 0, 1],
    ],
    water: 1,
    start: { x: 0, y: 0 },
    goal: { x: 3, y: 0 },
    entities: [{ type: 'box', x: 1, y: 1 }],
  }

  it('물 높이는 없어도 되고 있으면 양의 정수여야 한다', () => {
    const message = 'water는 양의 정수여야 한다'

    expect(errorsOf(WATER_VALID)).toEqual([])
    expect(errorsOf({ ...WATER_VALID, water: undefined })).toEqual([])
    expect(errorsOf({ ...WATER_VALID, water: 0 })).toContain(message)
    expect(errorsOf({ ...WATER_VALID, water: 1.5 })).toContain(message)
    expect(errorsOf({ ...WATER_VALID, water: '1' })).toContain(message)
  })

  it('시작 칸과 목표 칸은 물 칸에 둘 수 없다', () => {
    expect(errorsOf({ ...WATER_VALID, start: { x: 2, y: 1 } })).toContain('start가 물 칸에 있다')
    expect(errorsOf({ ...WATER_VALID, goal: { x: 2, y: 1 } })).toContain('goal이 물 칸에 있다')
  })

  it('상자만 물 칸에 둘 수 있다', () => {
    const entities = [
      { type: 'box', x: 1, y: 1 },
      { type: 'ladder', x: 2, y: 1 },
    ]

    expect(errorsOf({ ...WATER_VALID, entities })).toEqual(['entities[1]이 물 칸에 있다'])
  })

  it('얼음과 늪과 버섯과 무너지는 칸은 물 칸에 둘 수 없다', () => {
    const on = (field: string, cell: string) =>
      errorsOf({ ...WATER_VALID, [field]: ['....', `..${cell}.`] })

    expect(on('ice', '#')).toContain('물 칸에 얼음이 있다')
    expect(on('swamp', '#')).toContain('물 칸에 늪이 있다')
    expect(on('mushroom', '#')).toContain('물 칸에 버섯이 있다')
    expect(on('cracks', '2')).toContain('물 칸에 무너지는 칸이 있다')
  })
})
