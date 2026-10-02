import { describe, expect, it } from 'vitest'

import { boardCells } from './cellFrame'
import type { VineLook } from './vineFrame'
import { toScreen } from '@/game/iso'

const NO_VINES = new Map<string, VineLook>()

describe('boardCells', () => {
  it('바닥 있는 칸만 화면 좌표와 함께 앞뒤 순서로 모은다', () => {
    const heights = [
      [0, 1],
      [-1, 0],
    ]
    const cells = boardCells(heights, heights, new Map(), NO_VINES, null)

    expect(cells.map((cell) => cell.key)).toEqual(['0-0', '1-0', '1-1'])
    expect(cells[1]).toEqual({
      ...toScreen({ x: 1, y: 0 }, 1),
      h: 1,
      rail: '',
      pit: false,
      p: { x: 1, y: 0 },
      key: '1-0',
    })
  })

  it('발판 길 칸은 높이 0의 구덩이로 둔다', () => {
    const heights = [[0, -1]]
    const cells = boardCells(heights, heights, new Map([['1-0', '-1,0']]), NO_VINES, null)

    expect(cells[1]).toMatchObject({ key: '1-0', h: 0, pit: true, rail: '-1,0' })
  })

  it('아직 바닥 없는 덩굴 길은 구덩이로 둔다', () => {
    const heights = [[0, -1]]
    const vines = new Map([['1-0', {} as VineLook]])
    const cells = boardCells(heights, heights, new Map(), vines, null)

    expect(cells[1]).toMatchObject({ key: '1-0', h: 0, pit: true })
  })

  it('메운 칸이 다시 구멍이 되면 사라지기 전 높이로 그린다', () => {
    const cells = boardCells([[0, -1]], [[0, 0]], new Map(), NO_VINES, null)

    expect(cells[1]).toMatchObject({ key: '1-0', h: 0, pit: false })
  })

  it('상자가 메우는 중인 칸은 앞 높이로 판정한다', () => {
    const vines = new Map([['1-0', {} as VineLook]])

    expect(boardCells([[0, 0]], [[0, -1]], new Map(), vines, '1-0')[1].pit).toBe(true)
    expect(boardCells([[0, 0]], [[0, -1]], new Map(), vines, null)[1].pit).toBe(false)
  })
})
