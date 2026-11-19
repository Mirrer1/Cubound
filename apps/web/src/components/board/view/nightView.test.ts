import { describe, expect, it } from 'vitest'

import {
  cellVeil,
  coverOutline,
  coverPath,
  edgeFade,
  lightVeil,
  shadeShapes,
  veilFootprint,
  veilMiddle,
  veilShapes,
} from './nightView'
import { TILE } from '@/game/iso'

const CUBE = { x: 2, y: 2, h: 0, wide: false, weight: 1 }

describe('lightVeil', () => {
  it('빛 칸 0.2, 옆 칸 가운데 0.75, 한 칸 반 너머 1.0', () => {
    expect([0, 0.5, 1, 1.5, 3].map((d) => lightVeil(d, false))).toEqual([0.2, 0.2, 0.75, 1, 1])
  })

  it('화로 불 붙은 큐브는 한 칸 더 옅게 0.2, 0.6, 0.9', () => {
    expect([0, 1, 2, 2.5].map((d) => lightVeil(d, true))).toEqual([0.2, 0.6, 0.9, 1])
  })
})

describe('cellVeil', () => {
  it('빛 칸은 고른 값 하나, 먼 칸은 1', () => {
    expect(cellVeil([CUBE], 2, 2)).toEqual([0.2])
    expect(cellVeil([CUBE], 6, 2)).toEqual([1])
    expect(cellVeil([], 2, 2)).toEqual([1])
  })

  it('옆 칸은 빛 쪽 변이 옅고 바깥 변이 짙은 8x8', () => {
    const veil = cellVeil([CUBE], 3, 2)

    expect(veil).toHaveLength(64)
    expect(veil[0]).toBeLessThan(0.6)
    expect(veil[7]).toBeGreaterThan(0.9)
  })

  it('서로 다른 빛이 겹치면 더해 밝고, 큐브 빛 한 벌은 밝은 쪽만', () => {
    const a = cellVeil([CUBE], 3, 2)
    const b = cellVeil([{ ...CUBE, x: 4 }], 3, 2)
    const both = cellVeil([CUBE, { ...CUBE, x: 4 }], 3, 2)
    both.forEach((v, i) => expect(v).toBeLessThanOrEqual(Math.min(a[i], b[i])))
    expect(both.some((v, i) => v < Math.min(a[i], b[i]))).toBe(true)
    const cube = { ...CUBE, cube: true }
    expect(cellVeil([cube, { ...cube, x: 4 }], 3, 2)).toEqual(a.map((v, i) => Math.min(v, b[i])))
  })

  it('켜지는 빛은 무게만큼 옅게 한다', () => {
    expect(cellVeil([{ ...CUBE, weight: 0.5 }], 2, 2)).toEqual([0.6])
  })
})

describe('veilShapes', () => {
  it('고른 칸은 윗면과 옆면 한 장에 까만 받침 띠를 더한다', () => {
    const shapes = veilShapes(0, 0, 40, [0.75])

    expect(shapes.map((shape) => shape.opacity)).toEqual([0.75, 1])
  })

  it('8x8 칸은 같은 값끼리 줄마다 묶고 옆면 띠와 받침 띠를 더한다', () => {
    const shapes = veilShapes(0, 0, 40, cellVeil([CUBE], 3, 2))

    expect(shapes.length).toBeGreaterThan(8)
    expect(shapes.length).toBeLessThanOrEqual(64 + 16 + 1)
    expect(shapes.at(-1)?.opacity).toBe(1)
  })

  it('바닥 높이 칸은 옆면이 받침 띠뿐이다', () => {
    const values = cellVeil([CUBE], 3, 2)
    expect(veilShapes(0, 0, TILE.lip, values).length).toBeLessThan(
      veilShapes(0, 0, TILE.lip + 30, values).length,
    )
  })
})

describe('veilShapes', () => {
  it('앞이 트인 변은 받침 띠가 윗면 위로 살짝 올라온다', () => {
    const values = [0.5]
    const lipOf = (left: boolean) =>
      veilShapes(0, 0, TILE.lip, values, values, {
        left,
        right: false,
        backLeft: false,
        backRight: false,
      })
        .at(-1)!
        .points.split(' ')
        .map((p) => p.split(',').map(Number))

    expect(Math.min(...lipOf(true).map(([, y]) => y))).toBeLessThan(0)
    expect(Math.min(...lipOf(false).map(([, y]) => y))).toBe(0)
  })
})

describe('coverOutline', () => {
  const pointsOf = (outline: string) => outline.split(' ').map((p) => p.split(',').map(Number))
  const area = (points: number[][]) =>
    points.reduce((sum, [x, y], i) => {
      const [nx, ny] = points[(i + 1) % points.length]
      return sum + x * ny - nx * y
    }, 0)

  it('블록 하나는 꼭대기부터 밑 꼭짓점까지 여섯 점이고 칸 막과 같은 방향으로 돈다', () => {
    const points = pointsOf(coverOutline(0, 0, [{ x: 0, y: 0, width: 60, height: 30 }]))

    expect(points).toHaveLength(6)
    expect(Math.min(...points.map(([, y]) => y))).toBe(-45)
    expect(Math.max(...points.map(([, y]) => y))).toBe(15)
    expect(area(points)).toBeGreaterThan(0)
  })

  it('여러 덩이는 하나의 볼록 둘레로 감싼다', () => {
    const points = pointsOf(
      coverOutline(0, 0, [
        { x: 0, y: 0, width: 80, height: 13 },
        { x: -10, y: -13, width: 40, height: 9 },
      ]),
    )

    expect(Math.min(...points.map(([, y]) => y))).toBe(-33)
    expect(area(points)).toBeGreaterThan(0)
  })
})

describe('veilMiddle', () => {
  it('빛 지도 가운데 값을 고른다', () => {
    expect(veilMiddle([0.5])).toBe(0.5)
    expect(veilMiddle(cellVeil([CUBE], 3, 2))).toBeCloseTo(0.75, 1)
  })
})

describe('coverPath', () => {
  it('덩이마다 닫힌 경로 하나씩 이어 합친 모양을 만든다', () => {
    const path = coverPath(0, 0, [
      { x: 0, y: 0, width: 80, height: 13 },
      { x: -10, y: -13, width: 40, height: 9 },
    ])

    expect(path.match(/M/g)).toHaveLength(2)
    expect(path.match(/Z/g)).toHaveLength(2)
  })
})

describe('edgeFade', () => {
  const CLOSED = { left: false, right: false, back: false, front: false }

  it('판 끝에 닿지 않으면 그대로다', () => {
    expect(edgeFade([0.2], CLOSED)).toEqual([0.2])
  })

  it('판 끝 변 쪽은 어둠 색에 가깝고 반대쪽은 그대로다', () => {
    const faded = edgeFade([0.2], { ...CLOSED, right: true })

    expect(faded).toHaveLength(64)
    expect(faded[7]).toBeGreaterThan(0.8)
    expect(faded[0]).toBe(0.2)
  })
})

describe('veilFootprint', () => {
  const corners = (points: string) => points.split(' ').map((p) => p.split(',').map(Number))
  const shut = { left: false, right: false, backLeft: false, backRight: false }
  const open = { left: true, right: true, backLeft: true, backRight: true }

  it('안쪽 둘레는 옆 칸과 맞닿은 변을 칸 끝에 맞춤', () => {
    const [left, top] = corners(veilFootprint(0, 0, 10, shut, 'inner'))
    expect(left).toEqual([-TILE.width / 2, 0])
    expect(top).toEqual([0, -TILE.height / 2])
  })

  it('바깥 둘레는 판 끝 변을 칸 끝에 맞추고 옆 칸 쪽은 넉넉히', () => {
    expect(corners(veilFootprint(0, 0, 10, open, 'outer'))[1]).toEqual([0, -TILE.height / 2])
    expect(corners(veilFootprint(0, 0, 10, shut, 'outer'))[1][1]).toBeLessThan(-TILE.height / 2)
  })
})

describe('shadeShapes', () => {
  it('빛이 안 닿아 다 어두운 칸은 조각 없음', () => {
    expect(shadeShapes(0, 0, 16, [1])).toEqual([])
  })

  it('고른 윗면은 조각 하나, 옆면과 받침 띠는 따로', () => {
    const pieces = shadeShapes(0, 0, 40, [0.5])
    expect(pieces.filter((p) => p.face === 'top')).toHaveLength(1)
    expect(pieces.filter((p) => p.face === 'left').length).toBeGreaterThan(0)
  })
})

describe('shadeShapes 빛 지도', () => {
  it('고르지 않은 윗면은 여덟 줄 모두 칠함', () => {
    const values = Array.from({ length: 64 }, (_, k) => (k % 8) / 8)
    const tops = shadeShapes(0, 0, 16, values).filter((p) => p.face === 'top')
    expect(tops).toHaveLength(64)
  })
})
