import { describe, expect, it } from 'vitest'

import { playerFrame } from './cubeFrame'
import { board, ride } from './testStages'
import {
  type Tram,
  railDirsOf,
  slidingCell,
  tramFacing,
  tramFramesOf,
  tramNext,
  tramProgress,
} from './tramFrame'
import { TILE, toScreen } from '@/game/iso'

describe('tramProgress', () => {
  it('되돌아가지 않고 끝에서 다 간다', () => {
    const { events } = ride()
    let last = 0

    for (let t = 0; t <= 1; t += 0.05) {
      const p = tramProgress(events, t)
      expect(p).toBeGreaterThanOrEqual(last)
      last = p
    }

    expect(tramProgress(events, 1)).toBe(1)
  })

  it('올라타는 이동에서는 큐브가 발판 칸에 앉은 뒤에 움직인다', () => {
    const { prev, state, events } = board()

    for (let t = 0; t <= 1; t += 0.02) {
      if (tramProgress(events, t) > 0) {
        expect(playerFrame(prev, state, events, t).x).toBeGreaterThanOrEqual(1)
      }
    }
  })

  it('발판이 가지 않는 이동은 1이다', () => {
    expect(tramProgress([{ type: 'blocked', direction: 'left' }], 0.5)).toBe(1)
  })
})

describe('slidingCell', () => {
  const from = { x: 1, y: 1 }
  const to = { x: 2, y: 1 }

  it('출발 전에는 출발 칸, 도착 뒤에는 도착 칸에 그린다', () => {
    expect(slidingCell(from, to, 0)).toBe(from)
    expect(slidingCell(from, to, 1)).toBe(to)
  })

  it('가는 동안은 두 칸 중 앞쪽 칸에 그린다', () => {
    expect(slidingCell(from, to, 0.5)).toBe(to)
    expect(slidingCell(to, from, 0.5)).toBe(to)
  })

  it('앞뒤가 같은 줄이면 출발 칸에 그린다', () => {
    const side = { x: 2, y: 0 }

    expect(slidingCell(from, side, 0.5)).toBe(from)
  })
})

describe('발판 그리기', () => {
  const TRAM: Tram = {
    type: 'tram',
    id: 't',
    x: 0,
    y: 0,
    level: 1,
    dir: 1,
    cells: [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
    ],
  }
  const spot = (at: number, dir: 1 | -1) => ({ id: 't', at, dir })

  it('tramNext는 다음 수에 갈 칸이고 끝에서는 되돌아온다', () => {
    expect(tramNext(TRAM, spot(0, 1))).toEqual({ x: 1, y: 0 })
    expect(tramNext(TRAM, spot(2, 1))).toEqual({ x: 1, y: 0 })
  })

  it('tramFacing은 다음에 갈 쪽을 가리키고 끝에 닿으면 오던 쪽을 유지한다', () => {
    expect(tramFacing(TRAM, spot(1, 1))).toEqual({ x: 0, y: 1 })
    expect(tramFacing(TRAM, spot(1, -1))).toEqual({ x: -1, y: 0 })
    expect(tramFacing(TRAM, spot(2, 1))).toEqual({ x: 0, y: 1 })
  })

  it('railDirsOf는 길 칸마다 이웃한 길 칸의 방향을 담는다', () => {
    expect(railDirsOf([TRAM])).toEqual(
      new Map([
        ['0-0', '1,0'],
        ['1-0', '-1,0|0,1'],
        ['1-1', '0,-1'],
      ]),
    )
  })

  const frames = (from: number, to: number, tramPhase: number) =>
    tramFramesOf({
      trams: [TRAM],
      before: { trams: [spot(from, 1)] },
      game: { trams: [spot(to, 1)] },
      tramPhase,
      PIT_FLOOR: 10,
    })[0]

  it('tramFramesOf는 진행도만큼 미끄러진 화면 자리와 발판 높이만큼 올린 깊이를 준다', () => {
    const half = frames(0, 1, 0.5)
    const screen = toScreen({ x: 0.5, y: 0 }, 0)

    expect(half.x).toBe(screen.x)
    expect(half.y).toBe(screen.y - TILE.layer)
    expect(half.depth).toBe(10 + TILE.layer)
  })

  it('가는 동안은 가는 쪽을 가리키고 앞쪽 칸에 그린다', () => {
    const half = frames(0, 1, 0.5)

    expect({ dx: half.dx, dy: half.dy }).toEqual({ dx: 1, dy: 0 })
    expect(half.cell).toEqual({ x: 1, y: 0 })
    expect(half.next).toEqual({ x: 1, y: 0 })
  })

  it('도착하면 코와 다음 칸이 그다음 쪽으로 넘어간다', () => {
    const done = frames(0, 1, 1)

    expect({ dx: done.dx, dy: done.dy }).toEqual({ dx: 0, dy: 1 })
    expect(done.next).toEqual({ x: 1, y: 1 })
    expect(done.to).toEqual({ x: 1, y: 0 })
  })

  it('출발 전에는 앞 자리 기준으로 다음 쪽을 가리킨다', () => {
    const start = frames(0, 1, 0)

    expect(start.cell).toEqual({ x: 0, y: 0 })
    expect({ dx: start.dx, dy: start.dy }).toEqual({ dx: 1, dy: 0 })
  })
})
