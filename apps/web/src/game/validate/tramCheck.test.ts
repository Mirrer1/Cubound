import { describe, expect, it } from 'vitest'

import { errorsOf } from './testStages'

const TRAM = {
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
}

const TRAM_VALID = {
  version: 1,
  id: '4-1',
  heights: [
    [0, -1, -1, -1, 0],
    [0, -1, -1, -1, 0],
  ],
  start: { x: 0, y: 0 },
  goal: { x: 4, y: 1 },
  entities: [TRAM],
}

const tramErrors = (tram: object) => errorsOf({ ...TRAM_VALID, entities: [{ ...TRAM, ...tram }] })

describe('checkTrams', () => {
  it('올바른 발판은 통과한다', () => {
    expect(errorsOf(TRAM_VALID)).toEqual([])
  })

  it('cells는 두 칸 이상이어야 한다', () => {
    expect(tramErrors({ cells: [{ x: 1, y: 1 }] })).toContain(
      'entities[0]의 cells는 두 칸 이상이어야 한다',
    )
  })

  it('cells는 이웃한 칸으로 이어져야 한다', () => {
    const cells = [
      { x: 1, y: 1 },
      { x: 3, y: 1 },
    ]

    expect(tramErrors({ cells })).toContain('entities[0]의 cells가 이어져 있지 않다')
  })

  it('cells에 같은 칸이 두 번 나올 수 없다', () => {
    const cells = [
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: 1, y: 1 },
    ]

    expect(tramErrors({ cells })).toContain('entities[0]의 cells에 같은 칸이 두 번 있다')
  })

  it('cells는 맵 안이어야 한다', () => {
    const cells = [
      { x: 1, y: 1 },
      { x: 1, y: 9 },
    ]

    expect(tramErrors({ cells })).toContain('entities[0]의 cells에 맵 밖 칸이 있다')
  })

  it('cells는 바닥 없는 칸이어야 한다', () => {
    const cells = [
      { x: 0, y: 0 },
      { x: 0, y: 1 },
    ]

    expect(tramErrors({ cells, x: 0, y: 0 })).toContain(
      'entities[0]의 cells가 바닥 없는 칸이 아니다',
    )
  })

  it('시작 자리는 cells 안이어야 한다', () => {
    expect(tramErrors({ x: 0, y: 1 })).toContain('entities[0]의 시작 자리가 cells 안에 없다')
  })

  it('level은 0 이상의 정수여야 한다', () => {
    expect(tramErrors({ level: -1 })).toContain('entities[0]의 level은 0 이상의 정수여야 한다')
    expect(tramErrors({ level: 1.5 })).toContain('entities[0]의 level은 0 이상의 정수여야 한다')
  })

  it('dir은 1이나 -1이어야 한다', () => {
    expect(tramErrors({ dir: -1 })).toEqual([])
    expect(tramErrors({ dir: 0 })).toContain('entities[0]의 dir은 1이나 -1이어야 한다')
  })

  it('id는 문이나 짝 칸과 겹칠 수 없다', () => {
    const entities = [
      TRAM,
      { type: 'switch', x: 4, y: 0, target: 'tram-a' },
      { type: 'door', x: 0, y: 1, id: 'tram-a' },
    ]

    expect(errorsOf({ ...TRAM_VALID, entities })).toContain('문 id tram-a가 겹친다')
  })

  it('발판 둘의 길이 겹칠 수 없다', () => {
    const entities = [TRAM, { ...TRAM, id: 'tram-b' }]

    expect(errorsOf({ ...TRAM_VALID, entities })).toContain('entities[1]의 길이 다른 발판과 겹친다')
  })

  it('길 칸에는 시작 위치와 목표와 다른 오브젝트를 둘 수 없다', () => {
    const entities = [TRAM, { type: 'box', x: 2, y: 1 }]

    expect(errorsOf({ ...TRAM_VALID, start: { x: 2, y: 1 } })).toContain('start가 바닥 칸이 아니다')
    expect(errorsOf({ ...TRAM_VALID, goal: { x: 2, y: 1 } })).toContain('goal이 바닥 칸이 아니다')
    expect(errorsOf({ ...TRAM_VALID, entities })).toContain('entities[1]이 바닥 칸이 아니다')
  })
})
