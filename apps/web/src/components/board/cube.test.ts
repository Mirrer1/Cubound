import { describe, expect, it } from 'vitest'

import { CUBE, rollingCubeFaces, tiltOnTop } from './cube'
import { TILE, blockFaces, toScreen } from '@/game/iso'

const roundPoints = (points: string) =>
  points.split(/[ ,]/).map((v) => Math.round(Number(v) * 100) / 100)

describe('rollingCubeFaces', () => {
  it('회전하지 않으면 정지한 큐브 블록과 같은 세 면을 그린다', () => {
    const faces = rollingCubeFaces(2, 1, 1, 'right', 0)
    const { x, y } = toScreen({ x: 2, y: 1 }, 1)
    const block = blockFaces(x, y - TILE.layer, TILE.width * (60 / 104), TILE.layer)

    expect(faces.map((f) => f.face).sort()).toEqual(['left', 'right', 'top'])
    expect(roundPoints(faces.find((f) => f.face === 'top')!.points)).toEqual(roundPoints(block.top))
  })

  it('90도 굴러도 보이는 면은 세 개다', () => {
    for (const direction of ['up', 'right', 'down', 'left'] as const) {
      expect(rollingCubeFaces(0, 0, 0, direction, Math.PI / 2)).toHaveLength(3)
    }
  })

  it('45도에서는 모서리로 서서 바닥 중심보다 높이 뜬다', () => {
    const flat = rollingCubeFaces(0, 0, 0, 'right', 0)
    const tilted = rollingCubeFaces(0, 0, 0, 'right', Math.PI / 4)
    const topY = (faces: typeof flat) =>
      Math.min(...faces.flatMap((f) => f.points.split(' ').map((p) => Number(p.split(',')[1]))))

    expect(topY(tilted)).toBeLessThan(topY(flat))
  })
})

describe('tiltOnTop', () => {
  const corners = (direction: 'up' | 'right' | 'down' | 'left', angle: number) =>
    rollingCubeFaces(0, 0, 0, direction, angle)
      .find((f) => f.face === 'top')!
      .points.split(' ')
      .map((p) => p.split(',').map(Number))

  it('기울지 않으면 옮기지 않는다', () => {
    expect(tiltOnTop('right', 0)(0.1, -0.2, 5)).toEqual({ x: 0, y: 0 })
  })

  it('윗면 네 귀퉁이가 기울어진 큐브 윗면의 귀퉁이로 간다', () => {
    const h = CUBE / 2
    const local = [
      [-h, -h],
      [h, -h],
      [h, h],
      [-h, h],
    ]
    for (const direction of ['up', 'right', 'down', 'left'] as const) {
      const flat = corners(direction, 0)
      const tilted = corners(direction, 0.24)
      local.forEach(([u, v], i) => {
        const d = tiltOnTop(direction, 0.24)(u, v, 0)
        expect(flat[i][0] + d.x).toBeCloseTo(tilted[i][0], 1)
        expect(flat[i][1] + d.y).toBeCloseTo(tilted[i][1], 1)
      })
    }
  })

  it('윗면에서 높이 선 점은 미는 방향으로 넘어간다', () => {
    const lean = (direction: 'up' | 'right' | 'down' | 'left') =>
      tiltOnTop(direction, 0.24)(0, 0, 10).x - tiltOnTop(direction, 0.24)(0, 0, 0).x
    expect(lean('right')).toBeGreaterThan(0)
    expect(lean('up')).toBeGreaterThan(0)
    expect(lean('down')).toBeLessThan(0)
    expect(lean('left')).toBeLessThan(0)
  })
})
