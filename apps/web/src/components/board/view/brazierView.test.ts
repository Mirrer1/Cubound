import { describe, expect, it } from 'vitest'

import { boxBurn, boxHeat, boxHeatBands, boxTone, cubeHeatBands } from './brazierView'
import { CUBE, rollingCubeFaces } from './cubeView'
import { TILE } from '@/game/iso'

const pointsOf = (points: string) => points.split(' ').map((p) => p.split(',').map(Number))

describe('cubeHeatBands', () => {
  it('서 있는 큐브는 보이는 두 옆면에 세 겹, 띠 아래 모서리가 옆면 아래 모서리', () => {
    const bands = cubeHeatBands(2, 1, 0, 'right', 0, 0.55)
    expect(bands).toHaveLength(6)
    const sides = rollingCubeFaces(2, 1, 0, 'right', 0).filter((f) => f.face !== 'top')
    const bottoms = sides.map((f) => pointsOf(f.points).sort((a, b) => b[1] - a[1])[0][1])
    const lowest = Math.max(...bands.flatMap((b) => pointsOf(b.points).map((p) => p[1])))
    expect(lowest).toBeCloseTo(Math.max(...bottoms))
  })

  it('맨 아래 띠가 가장 높고 옅음, 높이는 한 변 배수', () => {
    const bands = cubeHeatBands(0, 0, 0, 'right', 0, 0.5)
    const height = (b: { points: string }) => {
      const ys = pointsOf(b.points).map((p) => p[1])
      return Math.max(...ys) - Math.min(...ys)
    }
    const side = TILE.layer
    expect(height(bands[0]) - height(bands[4])).toBeCloseTo(side * 0.5 * (1 - 0.32), 1)
    expect(bands[0].opacity).toBeLessThan(bands[4].opacity)
    expect(CUBE * TILE.height).toBeCloseTo(side)
  })

  it('구르는 중에도 옆면을 따라가는 띠', () => {
    expect(cubeHeatBands(0, 0, 0, 'right', Math.PI / 4, 0.55).length).toBeGreaterThan(0)
  })
})

describe('boxHeatBands', () => {
  it('두 옆면 아래 모서리에서 rise px 오른 띠 세 겹', () => {
    const bands = boxHeatBands(0, 0, 12)
    expect(bands).toHaveLength(6)
    const left = pointsOf(bands[0].points)
    expect(left[0][1] - left[3][1]).toBeCloseTo(12)
    expect(left[0][1]).toBeCloseTo(TILE.layer)
  })
})

describe('boxBurn, boxHeat, boxTone', () => {
  it('밀려 멈출 즈음 달아오르고 잠깐 탄 뒤 부서짐', () => {
    expect(boxBurn(-1)).toEqual({ heat: 0, crumble: 0 })
    expect(boxBurn(0.1)).toEqual({ heat: 0, crumble: 0 })
    expect(boxBurn(0.35).heat).toBeCloseTo(0.5)
    expect(boxBurn(0.55)).toEqual({ heat: 1, crumble: 0 })
    expect(boxBurn(0.79).crumble).toBeCloseTo(0.5)
    expect(boxBurn(1).crumble).toBe(1)
  })

  it('열빛에서 달아오름, 불붙음으로 이어지는 빛', () => {
    expect(boxHeat(1, 0)).toMatchObject({ pool: 0.92, poolOpacity: 0.06, band: 12 })
    expect(boxHeat(0, 0).bandOpacity).toBe(0)
    expect(boxHeat(1, 0.5).band).toBeCloseTo(TILE.layer * 0.6)
    expect(boxHeat(1, 1)).toMatchObject({ pool: 1.35, band: TILE.layer, bandOpacity: 0.5 })
  })

  it('평소 상자는 노란 면 그대로', () => {
    expect(boxTone(0).top).toContain(' 0%)')
    expect(boxTone(1).left).toContain('80%')
  })
})
