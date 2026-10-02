import { describe, expect, it } from 'vitest'

import { CUBE } from './cubeView'
import { POST, ROPE, moorCells, postBands, postBlocks, ropeEnds, ropePoints } from './tetherView'
import { TILE, toScreen } from '@/game/iso'
import type { Stage } from '@/game/types'

// 물 높이 1, y 1~3이 물 칸, (2,0) 말뚝 줄 길이 2, (4,4) 말뚝 줄 길이 1
const STAGE: Stage = {
  version: 1,
  id: 'test-tether-view',
  heights: [
    [1, 1, 1, 1, 1],
    [0, 0, 0, 0, 1],
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
    [1, 1, 1, 1, 1],
  ],
  water: 1,
  start: { x: 0, y: 0 },
  goal: { x: 0, y: 4 },
  entities: [
    { type: 'box', x: 2, y: 1 },
    { type: 'post', x: 2, y: 0, length: 2, boat: { x: 2, y: 1 } },
    { type: 'box', x: 4, y: 3 },
    { type: 'post', x: 4, y: 4, length: 1, boat: { x: 4, y: 3 } },
  ],
}

const pairs = (points: string) => points.split(' ').map((p) => p.split(',').map(Number))

describe('postBands', () => {
  it('말뚝 칸은 판의 말뚝 순서대로 띠 하나, 둘이고 다른 칸은 0이다', () => {
    expect(postBands(STAGE, { x: 2, y: 0 })).toBe(1)
    expect(postBands(STAGE, { x: 4, y: 4 })).toBe(2)
    expect(postBands(STAGE, { x: 2, y: 1 })).toBe(0)
  })

  it('셋째 말뚝부터 띠 하나, 둘을 번갈아 쓴다', () => {
    const post = (x: number) => ({ type: 'post' as const, x, y: 0, length: 1, boat: { x, y: 1 } })
    const stage: Stage = { ...STAGE, entities: [0, 1, 2, 3].map(post) }

    expect([0, 1, 2, 3].map((x) => postBands(stage, { x, y: 0 }))).toEqual([1, 2, 1, 2])
  })
})

describe('moorCells', () => {
  it('말뚝에서 가로와 세로 칸 수의 합이 줄 길이 이하인 물 칸만 담는다', () => {
    const cells = moorCells(STAGE)

    expect([...cells.keys()].sort()).toEqual(['1-1', '2-1', '2-2', '3-1', '4-3'])
    expect(cells.get('2-2')).toEqual([0])
    expect(cells.get('4-3')).toEqual([1])
  })

  it('말뚝 둘의 범위가 겹친 칸은 두 말뚝을 다 담는다', () => {
    const stage: Stage = {
      ...STAGE,
      entities: [
        ...STAGE.entities.slice(0, 2),
        { type: 'box', x: 2, y: 3 },
        { type: 'post', x: 2, y: 4, length: 2, boat: { x: 2, y: 3 } },
      ],
    }

    expect(moorCells(stage).get('2-2')).toEqual([0, 1])
  })
})

describe('postBlocks', () => {
  it('바닥에서 18px 솟은 기둥과 띠 수만큼 5px 간격의 띠다', () => {
    const blocks = postBlocks(100, 2)

    expect(blocks.pillar).toEqual({
      y: 100 - POST.height,
      width: TILE.width * POST.width,
      depth: 18,
    })
    expect(blocks.bands).toEqual([
      { y: 90, width: TILE.width * POST.band.width, depth: 2 },
      { y: 85, width: TILE.width * POST.band.width, depth: 2 },
    ])
  })
})

describe('ropeEnds', () => {
  const onRim = (q: { x: number; y: number }, c: { x: number; y: number }, hw: number) =>
    Math.abs(q.x - c.x) / hw + Math.abs(q.y - c.y) / (hw / 2)

  it('두 끝은 서로를 향한 말뚝과 배의 테두리 점이다', () => {
    const { from, to } = ropeEnds({ x: 2, y: 0 }, 1, { x: 2, y: 2 }, 1)
    const foot = toScreen({ x: 2, y: 0 }, 1)
    const top = toScreen({ x: 2, y: 2 }, 1)

    // 배가 말뚝보다 앞이라 배 쪽 끝은 뒤 테두리 그대로
    expect(
      onRim(from, { x: foot.x, y: foot.y - ROPE.tie }, (TILE.width * POST.width) / 2),
    ).toBeCloseTo(1, 5)
    expect(onRim(to, top, (TILE.width * CUBE) / 2)).toBeCloseTo(1, 5)
    expect(from.x).toBeLessThan(foot.x)
    expect(to.x).toBeGreaterThan(top.x)
  })

  it('배가 말뚝보다 뒤면 배 쪽 끝이 옆 테두리까지 내려간다', () => {
    const { to } = ropeEnds({ x: 2, y: 2 }, 1, { x: 2, y: 0 }, 1)
    const top = toScreen({ x: 2, y: 0 }, 1)

    expect(onRim({ x: to.x, y: to.y - ROPE.drop }, top, (TILE.width * CUBE) / 2)).toBeCloseTo(1, 5)
  })

  it('말뚝이 배 옆에 있으면 배 쪽 끝은 내려가지 않고 테두리에서 멈춘다', () => {
    const { to } = ropeEnds({ x: 1, y: 2 }, 1, { x: 2, y: 1 }, 1)
    const top = toScreen({ x: 2, y: 1 }, 1)

    expect(onRim(to, top, (TILE.width * CUBE) / 2)).toBeCloseTo(1, 5)
  })

  it('배가 조금 움직이면 끝도 조금만 움직인다', () => {
    const a = ropeEnds({ x: 0, y: 1 }, 1, { x: 2, y: 1 }, 1).to
    const b = ropeEnds({ x: 0, y: 1 }, 1, { x: 2.05, y: 0.95 }, 1).to
    const shift = toScreen({ x: 2.05, y: 0.95 }, 1)
    const base = toScreen({ x: 2, y: 1 }, 1)

    expect(Math.hypot(b.x - shift.x - (a.x - base.x), b.y - shift.y - (a.y - base.y))).toBeLessThan(
      2,
    )
  })
})

describe('ropePoints', () => {
  const from = { x: 0, y: 0 }
  const to = { x: 100, y: 40 }
  // 위아래 가장자리 짝의 가운데가 줄의 중심선
  const middle = (points: number[][], i: number) => [
    (points[i][0] + points[21 - i][0]) / 2,
    (points[i][1] + points[21 - i][1]) / 2,
  ]

  it('팽팽한 줄은 두 끝을 곧게 잇는다', () => {
    const points = pairs(ropePoints(from, to, 0))

    for (let i = 0; i <= 10; i++) {
      const [x, y] = middle(points, i)
      expect(y).toBeCloseTo((x / 100) * 40, 1)
    }
  })

  it('처진 줄은 가운데가 7px 아래로 처진다', () => {
    expect(middle(pairs(ropePoints(from, to, 1)), 5)[1]).toBeCloseTo(20 + ROPE.sag, 1)
  })

  it('줄 두께는 기울기와 상관없이 2.2px다', () => {
    ;[to, { x: 2, y: 100 }].forEach((end) => {
      const points = pairs(ropePoints(from, end, 0))
      const [ax, ay] = points[3]
      const [bx, by] = points[18]
      expect(Math.hypot(ax - bx, ay - by)).toBeCloseTo(ROPE.width, 1)
    })
  })
})
