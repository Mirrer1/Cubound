import { describe, expect, it } from 'vitest'

import { type Box, type ViewBox, type ViewSize, viewBoxFor, zoneBox } from './camera'
import { rollingCubeFaces } from './cube'
import { TILE } from '@/game/iso'
import type { Direction } from '@/game/types'

const VIEWS = [
  { width: 1806, height: 876 }, // 1920x1080 데스크톱
  { width: 1326, height: 596 }, // 1440x800 노트북
  { width: 324, height: 612 }, // 390x844 폰
  { width: 600, height: 600 },
]

const flat = (w: number, h: number, height = 0) =>
  Array.from({ length: h }, () => Array.from({ length: w }, () => height))

const inside = ([vx, vy, vw, vh]: ViewBox, box: Box) =>
  box.minX >= vx && box.maxX <= vx + vw && box.minY >= vy && box.maxY <= vy + vh

const tilePx = ([, , vw]: ViewBox, view: ViewSize) => (TILE.width * view.width) / vw

const margins = ([vx, vy, vw, vh]: ViewBox, box: Box) => ({
  left: box.minX - vx,
  right: vx + vw - box.maxX,
  top: box.minY - vy,
  bottom: vy + vh - box.maxY,
})

// 구르는 도중까지 포함해 큐브가 닿는 가장 위쪽 화면 좌표
const cubeTop = (x: number, y: number, level: number) => {
  const angles = [0, 0.2, Math.PI / 6, Math.PI / 4, Math.PI / 3, Math.PI / 2]
  const directions: Direction[] = ['up', 'right', 'down', 'left']

  return Math.min(
    ...directions.flatMap((direction) =>
      angles.flatMap((angle) =>
        rollingCubeFaces(x, y, level, direction, angle).flatMap((face) =>
          face.points.split(' ').map((point) => Number(point.split(',')[1])),
        ),
      ),
    ),
  )
}

describe('zoneBox', () => {
  it('구역 안 칸만 담는다', () => {
    const heights = flat(6, 6)
    const box = zoneBox(heights, { x: 0, y: 0, w: 2, h: 2 })
    const whole = zoneBox(heights)

    expect(box.maxX).toBeLessThan(whole.maxX)
    expect(box.maxY).toBeLessThan(whole.maxY)
  })

  it('빈 칸은 담지 않는다', () => {
    const heights = [
      [0, 0, -1],
      [0, 0, -1],
    ]

    expect(zoneBox(heights)).toEqual(
      zoneBox([
        [0, 0],
        [0, 0],
      ]),
    )
  })

  it('높은 칸은 위로 자라고 바닥 두께는 그대로 아래에 둔다', () => {
    const low = zoneBox([[0]])
    const high = zoneBox([[3]])

    expect(low.minY - high.minY).toBe(3 * TILE.layer)
    expect(high.maxY).toBe(low.maxY)
  })

  it('위아래 여유를 같게 둔다', () => {
    const box = zoneBox([[0]])

    expect(box.minY + TILE.height / 2).toBe(-(box.maxY - TILE.height / 2 - TILE.lip))
  })
})

describe('viewBoxFor', () => {
  it('구역을 화면 한가운데에 놓는다', () => {
    const box = zoneBox(flat(6, 4, 1), { x: 0, y: 0, w: 6, h: 4 })

    for (const view of VIEWS) {
      const { left, right, top, bottom } = margins(viewBoxFor(box, view), box)
      expect(left).toBeCloseTo(right)
      expect(top).toBeCloseTo(bottom)
    }
  })

  it('화면 비율이 달라도 구역 전체가 들어온다', () => {
    const wide = zoneBox(flat(9, 2, 2))
    const tall = zoneBox(flat(2, 9, 2))

    for (const view of VIEWS) {
      expect(inside(viewBoxFor(wide, view), wide)).toBe(true)
      expect(inside(viewBoxFor(tall, view), tall)).toBe(true)
    }
  })

  it('viewBox 비율을 화면 비율과 같게 만든다', () => {
    const box = zoneBox(flat(6, 5, 1))

    for (const view of VIEWS) {
      const [, , vw, vh] = viewBoxFor(box, view)
      expect(vw / vh).toBeCloseTo(view.width / view.height)
    }
  })

  it('화면 짧은 쪽에 여백을 남긴다', () => {
    const box = zoneBox(flat(6, 5, 1))

    for (const view of VIEWS) {
      const viewBox = viewBoxFor(box, view)
      const { left, top } = margins(viewBox, box)
      expect(left / viewBox[2]).toBeGreaterThan(0.03)
      expect(top / viewBox[3]).toBeGreaterThan(0.03)
    }
  })

  it('상한에 닿지 않는 크기에서는 화면이 커져도 구역이 차지하는 비율이 같다', () => {
    const box = zoneBox(flat(6, 5, 1))
    const small = viewBoxFor(box, { width: 660, height: 400 })
    const large = viewBoxFor(box, { width: 891, height: 540 })

    expect((box.maxX - box.minX) / small[2]).toBeCloseTo((box.maxX - box.minX) / large[2])
  })

  it('가장 높은 칸 위의 큐브가 잘리지 않는다', () => {
    const heights = [
      [2, 1, 0],
      [1, 0, 0],
      [0, 0, 0],
    ]
    const box = zoneBox(heights)

    expect(cubeTop(0, 0, 2)).toBeGreaterThanOrEqual(box.minY)
    for (const view of VIEWS) {
      expect(cubeTop(0, 0, 2)).toBeGreaterThanOrEqual(viewBoxFor(box, view)[1])
    }
  })

  it('작은 구역은 화면이 커져도 칸이 더 커지지 않는다', () => {
    const small = zoneBox(flat(3, 3, 1))
    const wide = viewBoxFor(small, { width: 1806, height: 876 })
    const wider = viewBoxFor(small, { width: 3612, height: 1752 })

    expect(tilePx(wide, { width: 1806, height: 876 })).toBeCloseTo(
      tilePx(wider, { width: 3612, height: 1752 }),
    )
  })

  it('상한이 걸려도 구역 전체가 들어온다', () => {
    const small = zoneBox(flat(3, 3, 1))

    for (const view of VIEWS) expect(inside(viewBoxFor(small, view), small)).toBe(true)
  })

  it('큰 구역은 상한에 걸리지 않고 화면을 채운다', () => {
    const big = zoneBox(flat(10, 9, 2))
    const view = { width: 1806, height: 876 }
    const viewBox = viewBoxFor(big, view)
    const { top } = margins(viewBox, big)

    expect(top / viewBox[3]).toBeCloseTo(0.04)
    expect(
      tilePx(viewBoxFor(big, { width: 2400, height: 1160 }), { width: 2400, height: 1160 }),
    ).toBeGreaterThan(tilePx(viewBox, view))
  })

  it('폰 크기에서는 상한이 칸을 줄이지 않는다', () => {
    const box = zoneBox(flat(4, 4, 1))
    const view = { width: 340, height: 628 }
    const viewBox = viewBoxFor(box, view)

    expect(margins(viewBox, box).left / viewBox[2]).toBeCloseTo(0.04)
  })

  it('화면 크기를 아직 재지 못했으면 구역 범위를 그대로 쓴다', () => {
    const box = zoneBox(flat(4, 4))

    expect(viewBoxFor(box, { width: 0, height: 0 })).toEqual([
      box.minX,
      box.minY,
      box.maxX - box.minX,
      box.maxY - box.minY,
    ])
  })
})
