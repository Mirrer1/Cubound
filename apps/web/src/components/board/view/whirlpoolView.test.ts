import { describe, expect, it } from 'vitest'

import { spotPoints } from './cellView'
import {
  BOWL_SHAPES,
  LANE,
  LEAN,
  cellMatrix,
  lanePoints,
  leanShift,
  pullLanes,
  ringPath,
  whirlpoolsOf,
} from './whirlpoolView'
import { TILE, isoDelta } from '@/game/iso'
import type { Stage } from '@/game/types'

// 물 높이 1, (1,1) 소용돌이의 오른쪽 줄 (2~3,1)은 (4,1) 땅에서 끊기고 아래 줄은 (1,2)
const STAGE: Stage = {
  version: 1,
  id: 'test-whirl-view',
  heights: [
    [1, 1, 1, 1, 1, 1],
    [1, 0, 0, 0, 1, 0],
    [1, 0, 1, 1, 1, 1],
  ],
  water: 1,
  start: { x: 0, y: 0 },
  goal: { x: 5, y: 2 },
  entities: [{ type: 'whirlpool', x: 1, y: 1 }],
}

describe('pullLanes', () => {
  it('소용돌이에서 가로세로로 물 칸이 이어진 데까지가 물길이고 땅에서 끊긴다', () => {
    const lanes = pullLanes(STAGE)

    expect([...lanes.keys()].sort()).toEqual(['1-2', '2-1', '3-1'])
    expect(lanes.get('2-1')).toEqual({ whirl: 0, axis: 'x', toward: 'left', front: true })
    expect(lanes.get('3-1')).toEqual({ whirl: 0, axis: 'x', toward: 'left', front: false })
    expect(lanes.get('1-2')).toEqual({ whirl: 0, axis: 'y', toward: 'up', front: true })
  })

  it('소용돌이가 없는 판은 물길이 없다', () => {
    expect(pullLanes({ ...STAGE, entities: [] }).size).toBe(0)
  })
})

describe('whirlpoolsOf', () => {
  it('판의 소용돌이 자리를 차례대로 돌려준다', () => {
    expect(whirlpoolsOf(STAGE)).toEqual([{ x: 1, y: 1 }])
  })
})

describe('BOWL_SHAPES', () => {
  it('원 넷과 바깥 원 셋의 초승달을 바깥부터 그리고 가장 안쪽은 가장 깊은 물빛이다', () => {
    expect(BOWL_SHAPES).toHaveLength(7)
    expect(BOWL_SHAPES.filter((s) => s.fill === 'var(--color-water-reflect)')).toHaveLength(3)
    expect(BOWL_SHAPES.at(-1)?.fill).toBe('var(--color-water-3)')
  })

  it('모든 점이 칸 안에 있다', () => {
    const coords = BOWL_SHAPES.flatMap((s) =>
      s.points.split(' ').map((p) => p.split(',').map(Number)),
    )
    expect(coords.every(([u, v]) => Math.abs(u) <= 0.5 && Math.abs(v) <= 0.5)).toBe(true)
  })
})

describe('cellMatrix', () => {
  it('칸 단위 한 칸이 아이소메트릭 한 칸 거리로 옮겨진다', () => {
    expect(cellMatrix(10, 20)).toBe(
      `matrix(${TILE.width / 2} ${TILE.height / 2} ${-TILE.width / 2} ${TILE.height / 2} 10 20)`,
    )
  })
})

describe('lanePoints', () => {
  it('가로 물길은 칸 폭 0.4배 띠이고 먼 가장자리에 선이 선다', () => {
    const { band, edge } = lanePoints(0, 0, 'x')

    expect(band).toBe(
      spotPoints(0, 0, [
        [-0.5, -LANE.half],
        [0.5, -LANE.half],
        [0.5, LANE.half],
        [-0.5, LANE.half],
      ]),
    )
    expect(edge).toBe(
      spotPoints(0, 0, [
        [-0.5, -LANE.half],
        [0.5, -LANE.half],
        [0.5, -LANE.half + LANE.edge],
        [-0.5, -LANE.half + LANE.edge],
      ]),
    )
  })

  it('세로 물길은 축을 바꾼 같은 띠다', () => {
    expect(lanePoints(0, 0, 'y').band).toBe(
      spotPoints(0, 0, [
        [-LANE.half, -0.5],
        [-LANE.half, 0.5],
        [LANE.half, 0.5],
        [LANE.half, -0.5],
      ]),
    )
  })
})

describe('leanShift', () => {
  it('소용돌이 쪽으로 0.08칸 가고 3px 잠기는 끝 자리다', () => {
    const d = isoDelta(LEAN.reach, 0)

    expect(leanShift('right', true)).toEqual({
      '--lean-x': `${d.x}px`,
      '--lean-y': `${d.y + 3}px`,
      '--lean-amp': 1,
    })
  })

  it('큐브가 탄 배는 쏠림 세기가 0이다', () => {
    expect(leanShift('right', false)['--lean-amp']).toBe(0)
  })
})

describe('ringPath', () => {
  it('바깥 마름모와 안쪽 마름모 두 겹이다', () => {
    expect(ringPath(0, 0, 1).match(/M/g)).toHaveLength(2)
  })
})
