import { describe, expect, it } from 'vitest'

import { filledCells, fillingCellKey, heightNow, wallHeight } from './fillFrame'
import type { VineFrame, VineLook } from './vineFrame'
import type { Entity, GameEvent } from '@/game/types'

describe('filledCells', () => {
  const STAGE_HEIGHTS = [[0, -1, -1, -1]]
  const VINE: Entity = {
    type: 'vine',
    id: 'v',
    x: 0,
    y: 0,
    cells: [
      { x: 2, y: 0 },
      { x: 3, y: 0 },
    ],
  }

  it('처음에 구덩이였다가 바닥이 된 칸을 고른다', () => {
    expect(filledCells([[0, 0, -1, -1]], STAGE_HEIGHTS, [], [])).toEqual([{ x: 1, y: 0 }])
  })

  it('처음부터 바닥이던 칸과 아직 구덩이인 칸은 뺀다', () => {
    expect(filledCells([[0, -1, -1, -1]], STAGE_HEIGHTS, [], [])).toEqual([])
  })

  it('덩굴이 자라 메운 칸은 빼고 아직 안 자란 길 칸은 상자가 메웠으면 넣는다', () => {
    const vines = [{ id: 'v', grown: 1, stopped: false }]

    expect(filledCells([[0, 0, 0, 0]], STAGE_HEIGHTS, [VINE], vines)).toEqual([
      { x: 1, y: 0 },
      { x: 3, y: 0 },
    ])
  })
})

describe('fillingCellKey', () => {
  const FILLED: GameEvent = {
    type: 'pushed',
    from: { x: 1, y: 0 },
    to: { x: 2, y: 0 },
    result: 'filled',
  }
  const NO_VINES = new Map<string, VineLook>()
  const VINE_AT_TARGET = new Map<string, VineLook>([
    ['2-0', { kind: 'next', enter: 'right', leave: null, hard: false, knot: false }],
  ])

  it('옆에서 밀어 한 칸 안에 있으면 바로 바닥으로 그린다', () => {
    expect(fillingCellKey({ x: 1.5, y: 0 }, [FILLED], NO_VINES)).toBeNull()
    expect(fillingCellKey({ x: 1, y: 0 }, [FILLED], NO_VINES)).toBeNull()
  })

  it('멀리서 날아오는 상자는 한 칸 안으로 들어올 때까지 구덩이로 둔다', () => {
    const far: GameEvent = { ...FILLED, from: { x: 0, y: 0 }, to: { x: 3, y: 0 } }

    expect(fillingCellKey({ x: 1.5, y: 0 }, [far], NO_VINES)).toBe('3-0')
    expect(fillingCellKey({ x: 2, y: 0 }, [far], NO_VINES)).toBeNull()
  })

  it('덩굴이 올 칸은 상자가 옆에 있어도 상자가 움직이는 동안 구덩이로 둔다', () => {
    expect(fillingCellKey({ x: 1.9, y: 0 }, [FILLED], VINE_AT_TARGET)).toBe('2-0')
  })

  it('상자가 다 움직였거나 메우는 이동이 아니면 없다', () => {
    const slid: GameEvent = { ...FILLED, result: 'slid' }

    expect(fillingCellKey(null, [FILLED], VINE_AT_TARGET)).toBeNull()
    expect(fillingCellKey({ x: 1.5, y: 0 }, [slid], VINE_AT_TARGET)).toBeNull()
  })
})

describe('heightNow', () => {
  const view = { heights: [[0, 1]], before: { heights: [[0, -1]] }, fillingKey: '1-0' }

  it('메우는 중이라 아직 구덩이로 그리는 칸은 앞 높이를 쓴다', () => {
    expect(heightNow(view, 1, 0)).toBe(-1)
  })

  it('나머지 칸은 지금 높이를 쓰고 맵 밖은 없다', () => {
    expect(heightNow(view, 0, 0)).toBe(0)
    expect(heightNow({ ...view, fillingKey: null }, 1, 0)).toBe(1)
    expect(heightNow(view, 0, 5)).toBeUndefined()
  })
})

describe('wallHeight', () => {
  const vineAt = (kind: VineFrame['kind'], rise: number) =>
    new Map([['1-0', { kind, rise } as VineFrame]])
  const base = {
    heights: [[0, 2, -1]],
    before: { heights: [[0, 1, -1]] },
    fillingKey: null,
    vineFrame: new Map<string, VineFrame>(),
    railDirs: new Map<string, string>(),
  }

  it('옆 칸의 지금 높이와 앞 높이 중 높은 쪽까지 벽을 세운다', () => {
    expect(wallHeight(base, 1, 0)).toBe(2)
    expect(wallHeight({ ...base, heights: [[0, 0, -1]] }, 1, 0)).toBe(1)
  })

  it('옆 칸이 구덩이이거나 맵 밖이면 -1이다', () => {
    expect(wallHeight(base, 2, 0)).toBe(-1)
    expect(wallHeight(base, 0, 3)).toBe(-1)
  })

  it('옆 칸이 발판 길이면 구덩이가 이어져 벽이 없다', () => {
    expect(wallHeight({ ...base, railDirs: new Map([['1-0', '1,0']]) }, 1, 0)).toBe(-1)
  })

  it('옆 칸이 아직 구덩이인 덩굴 길이거나 판이 덜 차오른 덩굴 칸이면 벽이 없다', () => {
    const pit = { ...base, heights: [[0, -1, -1]], before: { heights: [[0, -1, -1]] } }

    expect(wallHeight({ ...pit, vineFrame: vineAt('next', 0) }, 1, 0)).toBe(-1)
    expect(wallHeight({ ...base, vineFrame: vineAt('grown', 0.5) }, 1, 0)).toBe(-1)
  })

  it('다 차오른 덩굴 칸과 뿌리 칸은 높이만큼 벽을 세운다', () => {
    expect(wallHeight({ ...base, vineFrame: vineAt('grown', 1) }, 1, 0)).toBe(2)
    expect(wallHeight({ ...base, vineFrame: vineAt('root', 0) }, 1, 0)).toBe(2)
  })

  it('메우는 중인 칸은 앞 높이로 본다', () => {
    const filling = { ...base, heights: [[0, 0, -1]], before: { heights: [[0, -1, -1]] } }

    expect(wallHeight(filling, 1, 0)).toBe(0)
    expect(wallHeight({ ...filling, fillingKey: '1-0' }, 1, 0)).toBe(-1)
  })
})
