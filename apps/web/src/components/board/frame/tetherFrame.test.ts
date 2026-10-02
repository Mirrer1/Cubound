import { describe, expect, it } from 'vitest'

import { ropeEnds, ropePoints } from '../view'
import { movingBox } from './boxFrame'
import { lastMove } from './testStages'
import { coversRope, moorLooks, tetherFrames } from './tetherFrame'
import { createState } from '@/game/rules'
import type { Direction, Stage } from '@/game/types'

// 물 높이 1, x 2~5와 y 1~2가 물 칸, (2,0) 말뚝에 줄 길이 2로 묶인 배가 (2,1)
const TETHER_STAGE: Stage = {
  version: 1,
  id: 'test-tether-frame',
  heights: [
    [1, 1, 1, 1, 1, 1, 1],
    [1, 1, 0, 0, 0, 0, 1],
    [1, 1, 0, 0, 0, 0, 1],
    [1, 1, 1, 1, 1, 1, 1],
  ],
  water: 1,
  start: { x: 1, y: 1 },
  goal: { x: 6, y: 3 },
  entities: [
    { type: 'box', x: 2, y: 1 },
    { type: 'post', x: 2, y: 0, length: 2, boat: { x: 2, y: 1 } },
  ],
}

const POST = { x: 2, y: 0 }

const still = (directions: Direction[]) => {
  const { game } = lastMove(TETHER_STAGE, directions)
  return tetherFrames({ prev: null, game, box: null, t: 1, dropping: false })[0]
}

const rowing = (t: number) => {
  const { prev, game, events } = lastMove(TETHER_STAGE, ['right', 'right'])
  const box = movingBox(prev, game, events, t)
  return { box, frame: tetherFrames({ prev, game, box, t, dropping: false })[0] }
}

describe('tetherFrames', () => {
  it('범위 안에 선 배의 줄은 말뚝 머리에서 배 윗면으로 처져 이어진다', () => {
    const frame = tetherFrames({
      prev: null,
      game: createState(TETHER_STAGE),
      box: null,
      t: 1,
      dropping: false,
    })[0]
    const { from, to } = ropeEnds(POST, 1, { x: 2, y: 1 }, 1)

    expect(frame).toEqual({
      slack: 1,
      active: 0,
      opacity: 1,
      points: ropePoints(from, to, 1),
      depth: 2,
      ridden: false,
    })
  })

  it('범위 끝에 선 배의 줄은 곧게 펴진다', () => {
    expect(still(['right', 'right']).slack).toBe(0)
  })

  it('큐브가 탄 배는 탄 정도 1이고 타는 수 동안 차오른다', () => {
    const { prev, game } = lastMove(TETHER_STAGE, ['right'])
    const half = tetherFrames({ prev, game, box: null, t: 0.5, dropping: false })[0]

    expect(still(['right']).active).toBe(1)
    expect(still(['right']).ridden).toBe(true)
    expect(half.active).toBeGreaterThan(0)
    expect(half.active).toBeLessThan(1)
  })

  it('저어 가는 동안 줄 끝은 배를 따라가고 처짐은 끝에 다가갈수록 서서히 펴진다', () => {
    const { box, frame } = rowing(0.5)
    const { from, to } = ropeEnds(POST, 1, { x: box!.x, y: box!.y }, box!.level + 1)

    expect(box!.x).toBeGreaterThan(2)
    expect(box!.x).toBeLessThan(3)
    expect(frame.slack).toBeGreaterThan(0)
    expect(frame.slack).toBeLessThan(1)
    expect(frame.points).toBe(ropePoints(from, to, frame.slack))
    expect(rowing(0.25).frame.slack).toBeGreaterThan(rowing(0.75).frame.slack)
    expect(rowing(0.01).frame.slack).toBeCloseTo(1, 2)
    expect(rowing(0.99).frame.slack).toBeCloseTo(0, 2)
  })

  it('재시작으로 내려앉는 동안 줄은 배와 같이 나타난다', () => {
    const game = createState(TETHER_STAGE)
    const at = (t: number) => tetherFrames({ prev: null, game, box: null, t, dropping: true })[0]

    expect(at(0).opacity).toBe(0)
    expect(at(1).opacity).toBe(1)
    expect(at(0).points).not.toBe(at(1).points)
  })
})

describe('moorLooks', () => {
  it('범위 칸마다 그 말뚝의 배에 탄 정도를 담고 범위 밖 칸은 없다', () => {
    const { game } = lastMove(TETHER_STAGE, ['right'])
    const frames = tetherFrames({ prev: null, game, box: null, t: 1, dropping: false })
    const looks = moorLooks(TETHER_STAGE, frames)

    expect([...looks.keys()].sort()).toEqual(['2-1', '2-2', '3-1'])
    expect(looks.get('3-1')).toBe(1)
    expect(looks.has('4-1')).toBe(false)
  })
})

describe('coversRope', () => {
  const frame = { slack: 1, active: 0, opacity: 1, points: '', depth: 2, ridden: false }

  it('줄의 뒤쪽 끝보다 앞에 선 큐브만 줄을 가린다', () => {
    expect(coversRope({ x: 2, y: 1 }, frame)).toBe(true)
    expect(coversRope({ x: 1, y: 1 }, frame)).toBe(false)
    expect(coversRope({ x: 0, y: 1 }, frame)).toBe(false)
  })

  it('말뚝 옆이나 앞의 배에 탄 큐브는 줄을 가린다', () => {
    expect(coversRope({ x: 1, y: 1 }, { ...frame, ridden: true })).toBe(true)
  })
})
