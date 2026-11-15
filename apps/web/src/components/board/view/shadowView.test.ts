import { describe, expect, it } from 'vitest'

import { bridgeAxis, bridgeFaces } from './shadowView'

// (1,0) (2,0) 가로 다리, (1,2) 세로 다리
const SHADOW = ['.00.', '....', '.0..']
const HEIGHTS = [
  [0, -1, -1, 0],
  [-1, 0, -1, -1],
  [-1, -1, -1, -1],
]

describe('bridgeAxis', () => {
  it('땅이나 다리로 이어진 쪽이 다리 방향이다', () => {
    expect(bridgeAxis(SHADOW, HEIGHTS, { x: 1, y: 0 })).toBe('x')
    expect(
      bridgeAxis(SHADOW, [...HEIGHTS.slice(0, 2), [-1, -1, -1, -1], [-1, 0, -1, -1]], {
        x: 1,
        y: 2,
      }),
    ).toBe('y')
  })
})

describe('bridgeFaces', () => {
  it('윗면과 앞 옆면 하나, 아래 번짐 세 겹', () => {
    const faces = bridgeFaces(0, 0, 'x')

    expect(faces.top.split(' ')).toHaveLength(4)
    expect(faces.side.split(' ')).toHaveLength(4)
    expect(faces.glow).toHaveLength(3)
  })
})
