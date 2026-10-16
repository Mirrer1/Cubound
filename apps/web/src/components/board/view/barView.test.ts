import { describe, expect, it } from 'vitest'

import {
  BAR,
  type BarPose,
  barCuts,
  barPieces,
  barTone,
  flatLook,
  footprintCells,
  frontCell,
} from './barView'

const REST: BarPose = {
  x: 0.5,
  y: 0,
  angle: 0,
  length: 1 + BAR.reach * 2,
  span: 1,
  inset: BAR.body.inset,
  z: 0,
  sag: null,
  lips: 0,
}

const keys = (pose: BarPose) => barPieces(pose).map((p) => `${p.cell.x}-${p.cell.y}`)

describe('barCuts', () => {
  it('누운 막대는 양 끝과 칸 경계에서 자른다', () => {
    expect(barCuts(REST).map((u) => Math.round(u * 100) / 100)).toEqual([-0.82, 0, 0.82])
  })

  it('비스듬히 돈 막대는 가운데 줄이 지나는 칸 경계마다 자른다', () => {
    const cuts = barCuts({ ...REST, x: 1, y: 1, angle: -Math.PI / 4 })
    expect(cuts.length).toBeGreaterThan(3)
  })
})

describe('barPieces', () => {
  it('두 칸 막대는 칸마다 한 조각이고 조각마다 발밑 빛 자리가 있다', () => {
    const pieces = barPieces(REST)
    expect(keys(REST)).toEqual(['0-0', '1-0'])
    expect(pieces.every((p) => p.pool !== null && p.faces.length > 0)).toBe(true)
  })

  it('칸 경계에서 자른 쪽에는 끝 면을 그리지 않는다', () => {
    const [back, front] = barPieces(REST)
    const sides = (faces: typeof back.faces) => faces.filter((f) => f.layer === 'base' && !f.top)
    // 앞쪽 끝 면과 오른쪽 옆면은 앞 조각, 뒤 조각은 옆면 하나
    expect(sides(back.faces)).toHaveLength(1)
    expect(sides(front.faces)).toHaveLength(2)
  })

  it('돌 때는 자르지 않고 정한 칸 하나에 한 덩이로 그린다', () => {
    const pieces = barPieces({ ...REST, angle: -Math.PI / 4, hold: { x: 1, y: 0 } })
    expect(pieces.map((p) => p.cell)).toEqual([{ x: 1, y: 0 }])
  })

  it('돌 때는 먼저 그리는 칸에 막대 전체, 나중 칸에 자기 쪽만 보이는 막대 전체를 그린다', () => {
    const turn = { cut: 0.2, side: 1, pivot: { x: 1, y: 0 }, front: { x: 0, y: 1 } }
    const pieces = barPieces({ ...REST, angle: Math.PI / 4, turn })
    const at = (x: number, y: number) => pieces.find((p) => p.cell.x === x && p.cell.y === y)!
    expect(at(1, 0).faces).toEqual(at(0, 1).faces)
    expect(at(1, 0).clip).toBeUndefined()
    expect(at(0, 1).clip).toBeDefined()
  })

  it('처진 막대는 받치는 칸에 그늘과 닿는 띠를 깐다', () => {
    const pieces = barPieces({ ...REST, sag: { at: 0, angle: BAR.sag } })
    expect(pieces[0].flats.map((f) => f.kind)).toEqual(['shadow', 'contact'])
  })

  it('다리 막대는 양 끝이 가장자리 땅 칸에 얹힌다', () => {
    const bridge = { ...REST, length: 2, inset: 0, z: -13, lips: 1 }
    const pieces = barPieces(bridge)
    const lips = pieces.filter((p) => p.flats.some((f) => f.kind === 'lip'))
    expect(lips.map((p) => p.cell.x)).toEqual([-1, 2])
  })

  it('처진 끝은 바닥 쪽으로 내려간 화면 자리', () => {
    const top = (pose: BarPose) =>
      Math.max(
        ...barPieces(pose)[1]
          .faces.filter((f) => f.top)
          .flatMap((f) => f.points.split(' ').map((q) => Number(q.split(',')[1]))),
      )
    expect(top({ ...REST, sag: { at: 0, angle: BAR.sag } })).toBeGreaterThan(top(REST))
  })
})

describe('frontCell', () => {
  it('받침이 닿는 칸 중 가장 앞 칸, 같은 깊이면 아래 줄', () => {
    expect(frontCell(footprintCells(REST))).toEqual({ x: 1, y: 0 })
    expect(
      frontCell([
        { x: 2, y: 0 },
        { x: 1, y: 1 },
      ]),
    ).toEqual({ x: 1, y: 1 })
  })
})

describe('barTone', () => {
  it('식은 쇠는 쇠빛이고 달궈지면 숯불빛이 섞인다', () => {
    expect(barTone({ layer: 'body', top: true, k: 0 }, 0)).not.toContain('heat')
    expect(barTone({ layer: 'body', top: true, k: 0 }, 1)).toContain('heat-hi')
    expect(barTone({ layer: 'sheen', top: true, k: 0 }, 0)).toBe('var(--color-iron-sheen)')
  })

  it('돌아가는 옆면은 왼쪽 면과 오른쪽 면 사이 색', () => {
    expect(barTone({ layer: 'base', top: false, k: 0.5 }, 0)).toContain('50%')
  })
})

describe('flatLook', () => {
  it('그늘은 먹 14%, 닿는 띠는 막대 색 55%', () => {
    expect(flatLook({ kind: 'shadow', opacity: 1, points: '' }).opacity).toBeCloseTo(0.14)
    expect(flatLook({ kind: 'contact', opacity: 1, points: '' }).opacity).toBeCloseTo(0.55)
  })
})
