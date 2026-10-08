import { describe, expect, it } from 'vitest'

import { VALID, errorsOf } from './testStages'

describe('checkEntities', () => {
  it('상자 말고 다른 오브젝트는 무너지는 칸에 둘 수 없다', () => {
    expect(errorsOf({ ...VALID, cracks: ['.2.', '...'] })).toEqual([])
    expect(errorsOf({ ...VALID, cracks: ['..2', '...'] })).toContain(
      'entities[2]이 무너지는 칸에 있다',
    )
    expect(errorsOf({ ...VALID, cracks: ['...', '2..'] })).toContain(
      'entities[1]이 무너지는 칸에 있다',
    )
  })

  it('오브젝트는 알려진 종류이고 바닥 칸에 하나씩만 놓인다', () => {
    const entities = (list: unknown[]) => errorsOf({ ...VALID, entities: list })

    expect(entities([{ type: 'rock', x: 0, y: 0 }])).toContain('entities[0]의 type을 알 수 없다')
    expect(entities([{ type: 'box', x: 1, y: 1 }])).toContain('entities[0]이 바닥 칸이 아니다')
    expect(
      entities([
        { type: 'box', x: 1, y: 0 },
        { type: 'ladder', x: 1, y: 0 },
      ]),
    ).toContain('entities[1]이 다른 오브젝트와 같은 칸에 있다')
    expect(entities([{ type: 'box', x: 2, y: 1 }])).toContain(
      'entities[0]이 시작이나 목표 칸에 있다',
    )
  })

  it('상자와 얼음 돌은 스위치 위에서 시작할 수 있고 둘이 한 스위치에 겹칠 수는 없다', () => {
    const onSwitch = (list: unknown[]) =>
      errorsOf({ ...VALID, entities: [...VALID.entities.slice(1), ...list] })

    expect(onSwitch([{ type: 'box', x: 0, y: 1 }])).toEqual([])
    expect(onSwitch([{ type: 'iceStone', x: 0, y: 1 }])).toEqual([])
    expect(
      onSwitch([
        { type: 'box', x: 0, y: 1 },
        { type: 'iceStone', x: 0, y: 1 },
      ]),
    ).toContain('entities[3]이 다른 오브젝트와 같은 칸에 있다')
    expect(
      errorsOf({
        ...VALID,
        entities: [{ type: 'box', x: 0, y: 1 }, ...VALID.entities.slice(1)],
      }),
    ).toEqual([])
    expect(onSwitch([{ type: 'ladder', x: 0, y: 1 }])).toContain(
      'entities[2]이 다른 오브젝트와 같은 칸에 있다',
    )
  })

  it('스위치는 있는 문이나 발판을 가리키고 문 id는 겹치지 않는다', () => {
    expect(
      errorsOf({ ...VALID, entities: [{ type: 'switch', x: 0, y: 1, target: 'b' }] }),
    ).toContain('entities[0]의 target인 문이나 발판 b가 없다')
    expect(
      errorsOf({
        ...VALID,
        entities: [
          { type: 'door', x: 2, y: 0, id: 'a' },
          { type: 'door', x: 0, y: 1, id: 'a' },
        ],
      }),
    ).toContain('문 id a가 겹친다')
  })

  it('발판은 바닥 칸에 있고 id가 겹치지 않으며 스위치가 가리킬 수 있다', () => {
    const entities = (list: unknown[]) => errorsOf({ ...VALID, entities: list })

    expect(
      entities([
        { type: 'switch', x: 0, y: 1, target: 'b' },
        { type: 'lift', x: 2, y: 0, id: 'b' },
      ]),
    ).toEqual([])
    expect(entities([{ type: 'lift', x: 1, y: 1, id: 'b' }])).toContain(
      'entities[0]이 바닥 칸이 아니다',
    )
    expect(
      entities([
        { type: 'lift', x: 2, y: 0, id: 'b' },
        { type: 'lift', x: 0, y: 1, id: 'b' },
      ]),
    ).toContain('발판 id b가 겹친다')
  })

  it('짝 칸은 같은 id로 정확히 두 칸이어야 한다', () => {
    const entities = (list: unknown[]) => errorsOf({ ...VALID, entities: list })

    expect(
      entities([
        { type: 'warp', x: 1, y: 0, id: 'w' },
        { type: 'warp', x: 0, y: 1, id: 'w' },
      ]),
    ).toEqual([])
    expect(entities([{ type: 'warp', x: 1, y: 0, id: 'w' }])).toContain(
      '짝 칸 id w는 두 칸이어야 한다',
    )
    expect(
      entities([
        { type: 'warp', x: 1, y: 0, id: 'w' },
        { type: 'warp', x: 0, y: 1, id: 'w' },
        { type: 'warp', x: 2, y: 0, id: 'w' },
      ]),
    ).toContain('짝 칸 id w는 두 칸이어야 한다')
  })

  it('짝 칸 id가 비어 있으면 실패한다', () => {
    expect(errorsOf({ ...VALID, entities: [{ type: 'warp', x: 1, y: 0, id: '' }] })).toContain(
      'entities[0]의 짝 칸 id가 비어 있다',
    )
  })

  it('짝 칸 id는 문이나 발판 id와 겹칠 수 없다', () => {
    expect(
      errorsOf({
        ...VALID,
        entities: [
          { type: 'door', x: 2, y: 0, id: 'a' },
          { type: 'warp', x: 1, y: 0, id: 'a' },
          { type: 'warp', x: 0, y: 1, id: 'a' },
        ],
      }),
    ).toContain('짝 칸 id a가 겹친다')
  })

  it('짝인 두 칸의 높이가 다르면 실패한다', () => {
    expect(
      errorsOf({
        ...VALID,
        entities: [
          { type: 'warp', x: 1, y: 0, id: 'w' },
          { type: 'warp', x: 2, y: 0, id: 'w' },
        ],
      }),
    ).toContain('짝 칸 id w의 두 칸 높이가 다르다')
  })

  it('얼음 칸에는 짝 칸을 둘 수 없다', () => {
    expect(
      errorsOf({
        ...VALID,
        ice: ['.#.', '...'],
        entities: [
          { type: 'warp', x: 1, y: 0, id: 'w' },
          { type: 'warp', x: 0, y: 1, id: 'w' },
        ],
      }),
    ).toContain('entities[0]이 얼음 칸에 있다')
  })
})

const SEED_VALID = {
  version: 1,
  id: '9-1',
  heights: [
    [0, 0, 0, 1],
    [0, 0, 0, 1],
  ],
  start: { x: 0, y: 0 },
  goal: { x: 3, y: 1 },
  entities: [{ type: 'seed', x: 1, y: 0 }],
}

describe('checkEntities 씨앗', () => {
  it('기본 바닥 칸의 씨앗은 통과한다', () => {
    expect(errorsOf(SEED_VALID)).toEqual([])
  })

  it('바닥 없는 칸에는 씨앗을 둘 수 없다', () => {
    const heights = [
      [0, -1, 0, 1],
      [0, 0, 0, 1],
    ]

    expect(errorsOf({ ...SEED_VALID, heights })).toContain('entities[0]이 바닥 칸이 아니다')
  })

  it('얼음과 늪과 버섯과 무너지는 칸에는 씨앗을 둘 수 없다', () => {
    const mask = ['.#..', '....']

    expect(errorsOf({ ...SEED_VALID, ice: mask })).toContain('entities[0]이 얼음 칸에 있다')
    expect(errorsOf({ ...SEED_VALID, swamp: mask })).toContain('entities[0]이 늪 칸에 있다')
    expect(errorsOf({ ...SEED_VALID, mushroom: mask })).toContain('entities[0]이 버섯 칸에 있다')
    expect(errorsOf({ ...SEED_VALID, cracks: ['.2..', '....'] })).toContain(
      'entities[0]이 무너지는 칸에 있다',
    )
  })

  it('다른 오브젝트나 시작 칸이나 목표 칸과 겹칠 수 없다', () => {
    const box = { type: 'box', x: 1, y: 0 }

    expect(errorsOf({ ...SEED_VALID, entities: [box, ...SEED_VALID.entities] })).toContain(
      'entities[1]이 다른 오브젝트와 같은 칸에 있다',
    )
    expect(errorsOf({ ...SEED_VALID, start: { x: 1, y: 0 } })).toContain(
      'entities[0]이 시작이나 목표 칸에 있다',
    )
  })

  it('덩굴 뿌리에는 씨앗을 둘 수 없다', () => {
    const heights = [
      [0, 0, -1, 1],
      [0, 0, 0, 1],
    ]
    const vine = { type: 'vine', id: 'v', x: 1, y: 0, cells: [{ x: 2, y: 0 }] }

    expect(
      errorsOf({ ...SEED_VALID, heights, entities: [vine, ...SEED_VALID.entities] }),
    ).toContain('entities[1]이 덩굴 뿌리에 있다')
  })

  it('콩나무는 참이나 거짓이어야 한다', () => {
    const grow = (value: unknown) => errorsOf({ ...SEED_VALID, rules: { seedGrow: value } })

    expect(grow(true)).toEqual([])
    expect(grow(false)).toEqual([])
    expect(grow(1)).toContain('rules.seedGrow는 참이나 거짓이어야 한다')
  })

  it('씨앗 가이드를 씨앗 칸에 둔다', () => {
    const guides = [
      { id: 'seed', target: { x: 1, y: 0 } },
      { id: 'seedRise', target: { x: 2, y: 0 } },
      { id: 'seedGrow', target: { x: 2, y: 0 } },
    ]

    expect(errorsOf({ ...SEED_VALID, guides })).toEqual([])
  })
})
