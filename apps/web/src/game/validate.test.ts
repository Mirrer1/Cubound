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

  it('스위치는 있는 문을 가리키고 문 id는 겹치지 않는다', () => {
    expect(
      errorsOf({ ...VALID, entities: [{ type: 'switch', x: 0, y: 1, target: 'b' }] }),
    ).toContain('entities[0]의 target인 문 b가 없다')
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
})
