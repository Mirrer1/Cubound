import { describe, expect, it } from 'vitest'

import { rollingCubeFaces } from './cube'
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
