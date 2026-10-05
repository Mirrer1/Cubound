import { describe, expect, it } from 'vitest'

import { errorsOf } from './testStages'

const VINE = {
  type: 'vine',
  x: 0,
  y: 1,
  id: 'vine-a',
  cells: [
    { x: 1, y: 1 },
    { x: 2, y: 1 },
    { x: 3, y: 1 },
  ],
}

const VINE_VALID = {
  version: 1,
  id: '8-1',
  heights: [
    [0, 0, 0, 0, 0],
    [0, -1, -1, -1, 0],
    [0, -1, -1, -1, 0],
  ],
  start: { x: 0, y: 0 },
  goal: { x: 4, y: 0 },
  entities: [VINE],
}

const vineErrors = (vine: object) => errorsOf({ ...VINE_VALID, entities: [{ ...VINE, ...vine }] })

describe('checkVines', () => {
  it('올바른 덩굴은 통과한다', () => {
    expect(errorsOf(VINE_VALID)).toEqual([])
  })

  it('cells는 비어 있을 수 없다', () => {
    expect(vineErrors({ cells: [] })).toContain('entities[0]의 cells가 비어 있다')
  })

  it('cells는 뿌리부터 이웃한 칸으로 이어져야 한다', () => {
    const gap = [
      { x: 1, y: 1 },
      { x: 3, y: 1 },
    ]

    expect(vineErrors({ cells: gap })).toContain('entities[0]의 cells가 이어져 있지 않다')
    expect(vineErrors({ cells: [{ x: 2, y: 1 }] })).toContain(
      'entities[0]의 cells가 이어져 있지 않다',
    )
  })

  it('cells는 맵 안이어야 한다', () => {
    const cells = [
      { x: 1, y: 1 },
      { x: 1, y: 9 },
    ]

    expect(vineErrors({ cells })).toContain('entities[0]의 cells에 맵 밖 칸이 있다')
  })

  it('cells는 바닥 없는 칸이어야 한다', () => {
    const cells = [
      { x: 1, y: 1 },
      { x: 1, y: 0 },
    ]

    expect(vineErrors({ cells })).toContain('entities[0]의 cells가 바닥 없는 칸이 아니다')
  })

  it('뿌리는 바닥 칸이어야 한다', () => {
    expect(vineErrors({ x: 1, y: 2 })).toContain('entities[0]의 뿌리가 바닥 칸이 아니다')
  })

  it('뿌리에는 goal을 둘 수 없다', () => {
    expect(errorsOf({ ...VINE_VALID, goal: { x: 0, y: 1 } })).toContain(
      'entities[0]의 뿌리에 goal이 있다',
    )
  })

  it('뿌리는 무너지는 칸에 둘 수 없다', () => {
    const cracks = ['.....', '1....', '.....']

    expect(errorsOf({ ...VINE_VALID, cracks })).toContain('entities[0]의 뿌리가 무너지는 칸에 있다')
  })

  it('cells에 같은 칸이 두 번 나올 수 없다', () => {
    const cells = [
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: 1, y: 1 },
    ]

    expect(vineErrors({ cells })).toContain('entities[0]의 cells에 같은 칸이 두 번 있다')
  })

  it('꺾임은 두 번까지다', () => {
    const twice = [
      { x: 1, y: 1 },
      { x: 1, y: 2 },
      { x: 2, y: 2 },
    ]
    const thrice = [...twice, { x: 2, y: 1 }]

    expect(vineErrors({ cells: twice })).toEqual([])
    expect(vineErrors({ cells: thrice })).toContain('entities[0]의 cells가 세 번 이상 꺾인다')
  })

  it('다른 덩굴의 길과 겹칠 수 없다', () => {
    const other = {
      type: 'vine',
      x: 4,
      y: 1,
      id: 'vine-b',
      cells: [
        { x: 3, y: 1 },
        { x: 3, y: 2 },
      ],
    }

    expect(errorsOf({ ...VINE_VALID, entities: [VINE, other] })).toContain(
      'entities[1]의 길이 다른 덩굴과 겹친다',
    )
  })

  it('id는 비어 있거나 겹칠 수 없다', () => {
    const other = { ...VINE, x: 0, y: 2, cells: [{ x: 1, y: 2 }] }

    expect(vineErrors({ id: '' })).toContain('entities[0]의 덩굴 id가 비어 있다')
    expect(errorsOf({ ...VINE_VALID, entities: [VINE, other] })).toContain(
      '덩굴 id vine-a가 겹친다',
    )
  })

  it('굳는 자리는 참이나 거짓이어야 한다', () => {
    const stop = (value: unknown) => errorsOf({ ...VINE_VALID, rules: { vineStop: value } })

    expect(stop(true)).toEqual([])
    expect(stop(false)).toEqual([])
    expect(stop(1)).toContain('rules.vineStop은 참이나 거짓이어야 한다')
  })
})
