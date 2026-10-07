import { describe, expect, it } from 'vitest'

import { errorsOf } from './testStages'

describe('checkSluices', () => {
  // 물 높이 1, (1,1)과 (2,1)이 잠기는 줄, (3,1)은 늘 물, (0,2) 수위 장치
  const SLUICE_VALID = {
    version: 1,
    id: 'sluice',
    heights: [
      [2, 2, 2, 2, 2],
      [2, 1, 1, 0, 2],
      [2, 2, 2, 2, 2],
    ],
    water: 1,
    start: { x: 1, y: 1 },
    goal: { x: 4, y: 0 },
    entities: [
      { type: 'sluice', x: 0, y: 2 },
      { type: 'box', x: 1, y: 2 },
      { type: 'iceStone', x: 4, y: 1 },
    ],
  }
  const withEntities = (entities: object[], rest: object = {}) => ({
    ...SLUICE_VALID,
    ...rest,
    entities,
  })

  // 물 높이 1, 가 웅덩이 (1,1)과 (2,1), 나 웅덩이 (4,1)과 (5,1), 사이 (3,1)은 높은 땅
  const LOCK_VALID = {
    version: 1,
    id: 'lock',
    heights: [
      [2, 2, 2, 2, 2, 2, 2],
      [2, 0, 1, 2, 1, 0, 2],
      [2, 2, 2, 2, 2, 2, 2],
    ],
    water: 1,
    start: { x: 0, y: 0 },
    goal: { x: 6, y: 0 },
    entities: [{ type: 'sluice', x: 3, y: 1 }],
    rules: { lock: { x: 2, y: 1 } },
  }

  it('잠기는 줄에 시작, 목표, 상자, 얼음 돌만 둔 수위 판은 통과한다', () => {
    expect(errorsOf(SLUICE_VALID)).toEqual([])
    expect(errorsOf({ ...SLUICE_VALID, goal: { x: 2, y: 1 } })).toEqual([])
    expect(errorsOf(withEntities([...SLUICE_VALID.entities, { type: 'box', x: 2, y: 1 }]))).toEqual(
      [],
    )
  })

  it('수위 판에는 water가 있어야 한다', () => {
    const { water: _, ...dry } = SLUICE_VALID
    expect(errorsOf(dry)).toContain('수위 장치 판에 water가 없다')
  })

  it('잠기는 줄에는 표시 없는 땅만 둔다', () => {
    expect(
      errorsOf(
        withEntities([
          { type: 'sluice', x: 0, y: 2 },
          { type: 'switch', x: 2, y: 1, target: 'a' },
          { type: 'door', x: 0, y: 0, id: 'a' },
        ]),
      ),
    ).toEqual(['entities[1]이 물이 오르면 잠기는 칸에 있다'])
    expect(
      errorsOf(withEntities([{ type: 'sluice', x: 1, y: 1 }], { start: { x: 0, y: 0 } })),
    ).toEqual(['entities[0]이 물이 오르면 잠기는 칸에 있다'])
  })

  it('잠기는 줄에는 얼음, 무너지는 칸을 두지 않는다', () => {
    expect(errorsOf({ ...SLUICE_VALID, ice: ['.....', '..#..', '.....'] })).toEqual([
      '물이 오르면 잠기는 칸에 얼음이 있다',
    ])
    expect(errorsOf({ ...SLUICE_VALID, cracks: ['.....', '..2..', '.....'] })).toEqual([
      '물이 오르면 잠기는 칸에 무너지는 칸이 있다',
    ])
  })

  it('판은 장치가 빈 낮은 물로 시작한다', () => {
    expect(
      errorsOf(
        withEntities([
          { type: 'sluice', x: 1, y: 2 },
          { type: 'box', x: 1, y: 2 },
        ]),
      ),
    ).toContain('entities[1]이 다른 오브젝트와 같은 칸에 있다')
    expect(
      errorsOf(withEntities([{ type: 'sluice', x: 0, y: 2 }], { start: { x: 0, y: 2 } })),
    ).toEqual(['entities[0]이 시작이나 목표 칸에 있다'])
  })

  it('수위 장치는 말뚝, 발판, 녹는 얼음과 한 판에 두지 않는다', () => {
    expect(
      errorsOf(
        withEntities([
          { type: 'sluice', x: 0, y: 2 },
          { type: 'switch', x: 4, y: 2, target: 'l' },
          { type: 'lift', x: 3, y: 0, id: 'l' },
        ]),
      ),
    ).toEqual(['수위 장치와 엘리베이터 발판을 한 판에 같이 둘 수 없다'])
    expect(
      errorsOf(
        withEntities([
          { type: 'sluice', x: 0, y: 2 },
          { type: 'post', x: 4, y: 0, length: 2, boat: { x: 3, y: 1 } },
        ]),
      ),
    ).toContain('수위 장치와 말뚝을 한 판에 같이 둘 수 없다')
    expect(
      errorsOf(
        withEntities(
          [
            { type: 'sluice', x: 0, y: 2 },
            { type: 'iceStone', x: 4, y: 1 },
          ],
          { rules: { melt: 3 } },
        ),
      ),
    ).toEqual(['수위 장치와 rules.melt를 한 판에 같이 둘 수 없다'])
  })

  it('두 웅덩이가 높은 땅으로 갈린 갑문 판은 통과한다', () => {
    expect(errorsOf(LOCK_VALID)).toEqual([])
  })

  it('갑문 칸은 웅덩이 안의 칸이다', () => {
    expect(errorsOf({ ...LOCK_VALID, rules: { lock: { x: 3, y: 0 } } })).toEqual([
      'rules.lock이 웅덩이 칸이 아니다',
    ])
  })

  it('잠기는 줄로 이어진 두 웅덩이는 하나로 세어 갑문 판이 아니다', () => {
    const heights = LOCK_VALID.heights.map((row, y) => (y === 1 ? [2, 0, 1, 1, 1, 0, 2] : row))
    expect(
      errorsOf({ ...LOCK_VALID, heights, entities: [{ type: 'sluice', x: 3, y: 0 }] }),
    ).toEqual(['갑문 판의 웅덩이가 둘이 아니다'])
  })

  it('갑문 판에는 수위 장치가 있어야 한다', () => {
    expect(errorsOf({ ...LOCK_VALID, entities: [] })).toEqual(['rules.lock 판에 수위 장치가 없다'])
  })

  it('갑문 판에서 처음부터 차 있는 가 웅덩이의 잠기는 칸에서는 시작할 수 없다', () => {
    expect(errorsOf({ ...LOCK_VALID, start: { x: 2, y: 1 } })).toContain(
      'start가 처음부터 차 있는 가 웅덩이의 잠기는 칸에 있다',
    )
    expect(errorsOf({ ...LOCK_VALID, start: { x: 4, y: 1 } })).toEqual([])
  })
})

describe('checkSluices 밀물', () => {
  // 물 높이 1, (1,1)과 (2,1)이 잠기는 줄, (3,1)은 늘 물
  const TIDE_VALID = {
    version: 1,
    id: 'tide',
    heights: [
      [2, 2, 2, 2, 2],
      [2, 1, 1, 0, 2],
      [2, 2, 2, 2, 2],
    ],
    water: 1,
    start: { x: 1, y: 1 },
    goal: { x: 4, y: 0 },
    entities: [{ type: 'box', x: 2, y: 1 }],
    rules: { tide: true },
  }

  it('잠기는 줄에 시작, 목표, 상자만 둔 밀물 판은 통과한다', () => {
    expect(errorsOf(TIDE_VALID)).toEqual([])
    expect(errorsOf({ ...TIDE_VALID, goal: { x: 2, y: 1 }, entities: [] })).toEqual([])
  })

  it('밀물 판의 가이드는 TIDE 숫자를 비춘다', () => {
    expect(errorsOf({ ...TIDE_VALID, guides: [{ id: 'tide', target: 'tide' }] })).toEqual([])
  })

  it('밀물 판에는 water가 있어야 한다', () => {
    const { water: _, ...dry } = TIDE_VALID
    expect(errorsOf(dry)).toContain('밀물 판에 water가 없다')
  })

  it('밀물 판의 잠기는 줄에는 표시 없는 땅만 둔다', () => {
    expect(
      errorsOf({
        ...TIDE_VALID,
        entities: [
          { type: 'switch', x: 2, y: 1, target: 'a' },
          { type: 'door', x: 0, y: 0, id: 'a' },
        ],
      }),
    ).toEqual(['entities[0]이 물이 오르면 잠기는 칸에 있다'])
    expect(errorsOf({ ...TIDE_VALID, ice: ['.....', '..#..', '.....'] })).toEqual([
      '물이 오르면 잠기는 칸에 얼음이 있다',
    ])
  })

  it('밀물 판에는 물 스위치, 갑문, 마개, 바람, 말뚝, 발판, 녹는 얼음을 두지 않는다', () => {
    const errors = (rest: object) => errorsOf({ ...TIDE_VALID, ...rest })

    expect(errors({ entities: [{ type: 'sluice', x: 0, y: 2 }] })).toEqual([
      '밀물 판에 물 스위치를 같이 둘 수 없다',
    ])
    expect(errors({ rules: { tide: true, plug: true } })).toContain(
      '밀물 판에 rules.plug를 같이 둘 수 없다',
    )
    expect(errors({ rules: { tide: true, wind: 'left' } })).toContain(
      '밀물 판에 rules.wind를 같이 둘 수 없다',
    )
    expect(errors({ rules: { tide: true, lock: { x: 1, y: 1 } } })).toContain(
      '밀물 판에 rules.lock을 같이 둘 수 없다',
    )
    expect(errors({ rules: { tide: true, melt: 3 } })).toContain(
      '밀물 판에 rules.melt를 같이 둘 수 없다',
    )
    expect(
      errors({ entities: [{ type: 'post', x: 4, y: 0, length: 2, boat: { x: 3, y: 1 } }] }),
    ).toContain('밀물 판에 말뚝을 같이 둘 수 없다')
  })
})
