import { describe, expect, it } from 'vitest'

import { directionFromKey, directionFromSwipe } from './input'

describe('directionFromKey', () => {
  it('방향키를 네 방향으로 읽는다', () => {
    expect(directionFromKey('ArrowUp')).toBe('up')
    expect(directionFromKey('ArrowRight')).toBe('right')
    expect(directionFromKey('ArrowDown')).toBe('down')
    expect(directionFromKey('ArrowLeft')).toBe('left')
  })

  it('WASD는 방향키와 같다', () => {
    expect(directionFromKey('w')).toBe('up')
    expect(directionFromKey('d')).toBe('right')
    expect(directionFromKey('s')).toBe('down')
    expect(directionFromKey('a')).toBe('left')
  })

  it('큰 글자로 눌러도 같게 읽는다', () => {
    expect(directionFromKey('W')).toBe('up')
    expect(directionFromKey('A')).toBe('left')
  })

  it('방향과 상관없는 키는 방향이 없다', () => {
    expect(directionFromKey('q')).toBeNull()
    expect(directionFromKey('Enter')).toBeNull()
  })
})

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

  it('미는 중에는 축에 가까우면 판정하지 않는다', () => {
    expect(directionFromSwipe(40, -3)).toBeNull()
    expect(directionFromSwipe(40, 3)).toBeNull()
    expect(directionFromSwipe(3, -40)).toBeNull()
    expect(directionFromSwipe(-3, -40)).toBeNull()
  })

  it('손을 뗄 때는 수평에 가까워도 세로 부호로 위아래를 가른다', () => {
    expect(directionFromSwipe(40, -3, true)).toBe('up')
    expect(directionFromSwipe(40, 3, true)).toBe('right')
  })

  it('손을 뗄 때는 수직에 가까워도 가로 부호로 좌우를 가른다', () => {
    expect(directionFromSwipe(3, -40, true)).toBe('up')
    expect(directionFromSwipe(-3, -40, true)).toBe('left')
  })

  it('손을 떼도 최소 거리보다 짧으면 방향이 없다', () => {
    expect(directionFromSwipe(10, -10, true)).toBeNull()
  })

  it('작은 흔들림으로 방향이 뒤집히지 않는다', () => {
    expect(directionFromSwipe(-30, -14)).toBe('left')
    expect(directionFromSwipe(-30, -2)).toBeNull()
    expect(directionFromSwipe(-30, 2)).toBeNull()
  })
})
