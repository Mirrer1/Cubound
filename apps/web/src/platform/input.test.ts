import { describe, expect, it } from 'vitest'

import { directionFromSwipe } from './input'

describe('directionFromSwipe', () => {
  it('오른쪽 위로 밀면 up이다', () => {
    expect(directionFromSwipe(40, -40)).toBe('up')
  })

  it('오른쪽 아래로 밀면 right다', () => {
    expect(directionFromSwipe(40, 40)).toBe('right')
  })

  it('왼쪽 아래로 밀면 down이다', () => {
    expect(directionFromSwipe(-40, 40)).toBe('down')
  })

  it('왼쪽 위로 밀면 left다', () => {
    expect(directionFromSwipe(-40, -40)).toBe('left')
  })

  it('최소 거리보다 짧으면 방향이 없다', () => {
    expect(directionFromSwipe(10, -10)).toBeNull()
    expect(directionFromSwipe(0, 0)).toBeNull()
  })

  it('가로세로 합쳐 최소 거리를 넘으면 한 축이 짧아도 방향이 나온다', () => {
    expect(directionFromSwipe(24, -24)).toBe('up')
  })

  it('수평에 가까우면 세로 부호로 위아래를 가른다', () => {
    expect(directionFromSwipe(40, -3)).toBe('up')
    expect(directionFromSwipe(40, 3)).toBe('right')
  })

  it('수직에 가까우면 가로 부호로 좌우를 가른다', () => {
    expect(directionFromSwipe(3, -40)).toBe('up')
    expect(directionFromSwipe(-3, -40)).toBe('left')
  })
})
