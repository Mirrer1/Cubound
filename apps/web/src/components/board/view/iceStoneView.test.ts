import { describe, expect, it } from 'vitest'

import { ICE, STONE, icePlate, stoneSteps } from './iceStoneView'
import { TILE } from '@/game/iso'

const pointsOf = (points: string) => points.split(' ').map((p) => p.split(',').map(Number))

describe('stoneSteps', () => {
  it('땅 위 돌은 14, 8, 4px 세 단이 차례로 쌓여 26px이다', () => {
    const steps = stoneSteps(0, 100, 0, 1)

    expect(steps.map((s) => s.depth)).toEqual([14, 8, 4])
    expect(steps.map((s) => s.width)).toEqual(STONE.steps.map((s) => s.width * TILE.width))
    expect(steps.map((s) => s.y)).toEqual([86, 78, 74])
  })

  it('물에 뜬 돌은 아랫단이 잠겨 18px이고 녹으면 크기가 줄어든다', () => {
    const floating = stoneSteps(0, 100, STONE.floatCut, 1)
    const melting = stoneSteps(0, 100, STONE.floatCut, 0.5)

    expect(floating.reduce((sum, s) => sum + s.depth, 0)).toBe(18)
    expect(melting[0].width).toBeCloseTo(STONE.steps[0].width * TILE.width * 0.5)
    expect(melting.reduce((sum, s) => sum + s.depth, 0)).toBe(9)
  })
})

describe('icePlate', () => {
  it('다 덮인 판은 칸 윗면 그대로이고 옆면은 판 두께만큼 내려온다', () => {
    const { top, left } = icePlate(0, 0, 1, 'left')
    const corners = pointsOf(top)

    expect(corners).toContainEqual([0, -TILE.height / 2])
    expect(corners).toContainEqual([TILE.width / 2, 0])
    expect(Math.max(...pointsOf(left).map(([, y]) => y))).toBe(TILE.height / 2 + ICE.slab)
  })

  it('덮이는 중인 판은 붙은 쪽 가장자리에서 자라고 앞 가장자리는 가운데가 먼저 나온 둥근 꼴이다', () => {
    const half = pointsOf(icePlate(0, 0, 0.5, 'left').top)
    // 왼쪽 위(x-) 가장자리에 붙어 오른쪽 아래로 자람, 칸 가운데 줄(u - v 축)에서 가장 멀리
    const reach = (x: number, y: number) => x / TILE.width + y / TILE.height
    const front = Math.max(...half.map(([x, y]) => reach(x, y)))
    const edgeFront = Math.max(
      ...half
        .filter(([x, y]) => Math.abs(x / TILE.width - y / TILE.height) > 0.49)
        .map(([x, y]) => reach(x, y)),
    )

    expect(Math.min(...half.map(([x]) => x))).toBe(-TILE.width / 2)
    expect(front).toBeGreaterThan(edgeFront)
    // 가운데는 덮인 만큼 그대로 자라 빨라지지 않음
    expect(front).toBeCloseTo(0)
  })

  it('반대쪽 가장자리에 붙으면 반대쪽에서 자란다', () => {
    const xs = pointsOf(icePlate(0, 0, 0.5, 'right').top).map(([x]) => x)

    expect(Math.max(...xs)).toBe(TILE.width / 2)
    expect(Math.min(...xs)).toBeGreaterThan(-TILE.width / 2)
  })
})
