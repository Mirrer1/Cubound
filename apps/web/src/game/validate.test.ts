import { describe, expect, it } from 'vitest'

import { validateStage } from './validate'

const VALID = {
  version: 1,
  id: '1-3',
  name: '테스트',
  heights: [
    [0, 0, 1],
    [0, -1, 1],
  ],
  start: { x: 0, y: 0 },
  goal: { x: 2, y: 1 },
  entities: [
    { type: 'box', x: 1, y: 0 },
    { type: 'switch', x: 0, y: 1, target: 'a' },
    { type: 'door', x: 2, y: 0, id: 'a' },
  ],
  best: 5,
  guides: [
    { id: 'box', target: { x: 1, y: 0 } },
    { id: 'restart', target: 'restart' },
    { id: 'moves', target: 'moves' },
  ],
  zones: [{ x: 0, y: 0, w: 3, h: 2 }],
}

const errorsOf = (data: unknown) => {
  const result = validateStage(data)
  return result.ok ? [] : result.errors
}

describe('validateStage', () => {
  it('올바른 스테이지는 통과하고 그대로 돌려준다', () => {
    const result = validateStage(VALID)

    expect(result.ok).toBe(true)
    expect(result.ok && result.stage.id).toBe('1-3')
  })

  it('객체가 아니면 실패한다', () => {
    expect(errorsOf(null)).toEqual(['스테이지가 객체가 아니다'])
    expect(errorsOf('stage')).toEqual(['스테이지가 객체가 아니다'])
  })

  it('name은 없어도 되고 문자열이 아니면 실패한다', () => {
    expect(errorsOf({ ...VALID, name: undefined })).toEqual([])
    expect(errorsOf({ ...VALID, name: 1 })).toContain('name이 문자열이 아니다')
  })

  it('지원하지 않는 버전은 실패한다', () => {
    expect(errorsOf({ ...VALID, version: 2 })).toContain('version은 1이어야 한다')
  })

  it('높이 맵은 비어 있지 않은 직사각형 정수 배열이어야 한다', () => {
    expect(errorsOf({ ...VALID, heights: [] })).toContain('heights가 비어 있다')
    expect(errorsOf({ ...VALID, heights: [[0, 0], [0]] })).toContain(
      'heights의 모든 행 길이가 같아야 한다',
    )
    expect(
      errorsOf({
        ...VALID,
        heights: [
          [0, 1.5],
          [0, -2],
        ],
      }),
    ).toContain('heights 값은 -1 이상의 정수여야 한다')
  })

  it('얼음 마스크는 없어도 되고 있으면 heights와 같은 모양이어야 한다', () => {
    const shape = 'ice는 heights와 같은 모양의 문자열 배열이어야 한다'

    expect(errorsOf({ ...VALID, ice: undefined })).toEqual([])
    expect(errorsOf({ ...VALID, ice: ['.#.', '...'] })).toEqual([])
    expect(errorsOf({ ...VALID, ice: ['...'] })).toContain(shape)
    expect(errorsOf({ ...VALID, ice: ['..', '...'] })).toContain(shape)
    expect(errorsOf({ ...VALID, ice: '...' })).toContain(shape)
  })

  it('바닥 없는 칸에는 얼음을 둘 수 없다', () => {
    expect(errorsOf({ ...VALID, ice: ['...', '.#.'] })).toContain('바닥 없는 칸에 얼음이 있다')
  })

  it('무너지는 칸은 없어도 되고 있으면 heights와 같은 모양이어야 한다', () => {
    const shape = 'cracks는 heights와 같은 모양의 문자열 배열이어야 한다'

    expect(errorsOf({ ...VALID, cracks: undefined })).toEqual([])
    expect(errorsOf({ ...VALID, cracks: ['21.', '...'] })).toEqual([])
    expect(errorsOf({ ...VALID, cracks: ['...'] })).toContain(shape)
    expect(errorsOf({ ...VALID, cracks: ['..', '...'] })).toContain(shape)
    expect(errorsOf({ ...VALID, cracks: '...' })).toContain(shape)
  })

  it('무너지는 칸 값은 점이나 1~9여야 한다', () => {
    const value = 'cracks 값은 점이나 1~9여야 한다'

    expect(errorsOf({ ...VALID, cracks: ['0..', '...'] })).toContain(value)
    expect(errorsOf({ ...VALID, cracks: ['#..', '...'] })).toContain(value)
  })

  it('바닥 없는 칸에는 무너지는 칸을 둘 수 없다', () => {
    expect(errorsOf({ ...VALID, cracks: ['...', '.2.'] })).toContain(
      '바닥 없는 칸에 무너지는 칸이 있다',
    )
  })

  it('얼음과 무너지는 칸은 겹칠 수 없다', () => {
    expect(errorsOf({ ...VALID, ice: ['.#.', '...'], cracks: ['.2.', '...'] })).toContain(
      '얼음 칸에 무너지는 칸이 있다',
    )
  })

  it('목표 칸에는 무너지는 칸을 둘 수 없다', () => {
    expect(errorsOf({ ...VALID, cracks: ['...', '..2'] })).toContain('goal이 무너지는 칸에 있다')
  })

  it('상자 말고 다른 오브젝트는 무너지는 칸에 둘 수 없다', () => {
    expect(errorsOf({ ...VALID, cracks: ['.2.', '...'] })).toEqual([])
    expect(errorsOf({ ...VALID, cracks: ['..2', '...'] })).toContain(
      'entities[2]이 무너지는 칸에 있다',
    )
    expect(errorsOf({ ...VALID, cracks: ['...', '2..'] })).toContain(
      'entities[1]이 무너지는 칸에 있다',
    )
  })

  it('시작과 목표는 맵 안의 바닥 칸이고 서로 달라야 한다', () => {
    expect(errorsOf({ ...VALID, start: { x: 1, y: 1 } })).toContain('start가 바닥 칸이 아니다')
    expect(errorsOf({ ...VALID, goal: { x: 9, y: 0 } })).toContain('goal이 바닥 칸이 아니다')
    expect(errorsOf({ ...VALID, goal: { x: 0, y: 0 } })).toContain('start와 goal이 같다')
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

  it('best는 양의 정수여야 한다', () => {
    expect(errorsOf({ ...VALID, best: 0 })).toContain('best는 양의 정수여야 한다')
  })

  it('구역은 맵 안에 있고 모든 바닥 칸을 덮어야 한다', () => {
    expect(errorsOf({ ...VALID, zones: [{ x: 0, y: 0, w: 9, h: 2 }] })).toContain(
      'zones[0]이 맵을 벗어난다',
    )
    expect(errorsOf({ ...VALID, zones: [{ x: 0, y: 0, w: 1, h: 2 }] })).toContain(
      '구역에 속하지 않은 바닥 칸이 있다',
    )
  })

  it('가이드는 없어도 되고 있으면 1~3단계여야 한다', () => {
    expect(errorsOf({ ...VALID, guides: undefined })).toEqual([])
    expect(errorsOf({ ...VALID, guides: [] })).toContain('guides는 1~3단계여야 한다')
    expect(errorsOf({ ...VALID, guides: [...VALID.guides, VALID.guides[0]] })).toContain(
      'guides는 1~3단계여야 한다',
    )
  })

  it('가이드 단계는 문구 id가 있어야 한다', () => {
    expect(errorsOf({ ...VALID, guides: [{ id: '', target: 'moves' }] })).toContain(
      'guides[0]의 id가 비어 있다',
    )
  })

  it('가이드 대상 칸은 맵 안에 있어야 한다', () => {
    const target = (value: unknown) => errorsOf({ ...VALID, guides: [{ id: 'a', target: value }] })

    expect(target({ x: 1, y: 1 })).toEqual([])
    expect(target({ x: 3, y: 0 })).toContain('guides[0]의 target이 맵 밖이다')
    expect(target({ x: 0, y: -1 })).toContain('guides[0]의 target이 맵 밖이다')
    expect(target({ x: 0.5, y: 0 })).toContain('guides[0]의 target이 맵 밖이다')
  })

  it('가이드 대상 화면 요소는 정해진 이름만 허용한다', () => {
    expect(errorsOf({ ...VALID, guides: [{ id: 'a', target: 'undo' }] })).toContain(
      'guides[0]의 target을 알 수 없다',
    )
    expect(errorsOf({ ...VALID, guides: [{ id: 'a', target: 3 }] })).toContain(
      'guides[0]의 target을 알 수 없다',
    )
  })

  it('rules는 없어도 되고 객체가 아니면 실패한다', () => {
    expect(errorsOf({ ...VALID, rules: undefined })).toEqual([])
    expect(errorsOf({ ...VALID, rules: {} })).toEqual([])
    expect(errorsOf({ ...VALID, rules: 24 })).toContain('rules가 객체가 아니다')
  })

  it('이동 제한은 양의 정수여야 한다', () => {
    const limit = (value: unknown) => errorsOf({ ...VALID, rules: { moveLimit: value } })

    expect(limit(6)).toEqual([])
    expect(limit(0)).toContain('rules.moveLimit은 양의 정수여야 한다')
    expect(limit(-1)).toContain('rules.moveLimit은 양의 정수여야 한다')
    expect(limit(5.5)).toContain('rules.moveLimit은 양의 정수여야 한다')
  })

  it('이동 제한이 best보다 작으면 실패한다', () => {
    expect(errorsOf({ ...VALID, rules: { moveLimit: 5 } })).toEqual([])
    expect(errorsOf({ ...VALID, rules: { moveLimit: 4 } })).toContain(
      'rules.moveLimit이 best보다 작다',
    )
  })

  it('밀기 제한은 양의 정수여야 한다', () => {
    const limit = (value: unknown) => errorsOf({ ...VALID, rules: { pushLimit: value } })

    expect(limit(3)).toEqual([])
    expect(limit(0)).toContain('rules.pushLimit은 양의 정수여야 한다')
    expect(limit(-1)).toContain('rules.pushLimit은 양의 정수여야 한다')
    expect(limit(2.5)).toContain('rules.pushLimit은 양의 정수여야 한다')
  })
})
