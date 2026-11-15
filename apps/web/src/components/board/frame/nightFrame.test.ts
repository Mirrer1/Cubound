import { describe, expect, it } from 'vitest'

import {
  bridgeLight,
  cubeCover,
  guideNightOf,
  movingBoxCover,
  nightCellOf,
  nightDisplay,
  nightScene,
  nightVeils,
  sinkingBoxCovers,
  stillBoxCover,
} from './nightFrame'
import { TILE } from '@/game/iso'
import { createState } from '@/game/rules'
import type { Stage } from '@/game/types'

const NIGHT: Stage = {
  version: 1,
  id: '21-1',
  heights: [[0, 0, 0]],
  start: { x: 0, y: 0 },
  goal: { x: 2, y: 0 },
  entities: [],
}

const at = (moves: number, stage = NIGHT) => ({ ...createState(stage), moves })

describe('nightDisplay', () => {
  it('밝을 때는 다음 어둠까지 남은 수, 어두울 때는 남은 어둠 수', () => {
    const shown = [0, 1, 2, 3, 4, 5, 6].map((m) => nightDisplay(at(m)))

    expect(shown.map((s) => s?.left)).toEqual([4, 3, 2, 1, 2, 1, 4])
    expect(shown.map((s) => s?.phase)).toEqual([
      'light',
      'light',
      'light',
      'pre',
      'dark',
      'dark',
      'light',
    ])
  })

  it('20월드까지는 없다', () => {
    expect(nightDisplay(at(3, { ...NIGHT, id: '20-1' }))).toBeNull()
    expect(nightDisplay(null)).toBeNull()
  })
})

describe('nightScene', () => {
  const ROW = [0, 0, 0, 0, 0, 0, 0]
  const WIDE: Stage = {
    ...NIGHT,
    heights: [ROW, ROW, ROW],
    start: { x: 1, y: 1 },
    goal: { x: 6, y: 0 },
  }
  const scene = (from: number, to: number, t: number) =>
    nightScene({ prev: at(from, WIDE), game: at(to, WIDE), events: [], t, cube: { x: 1, y: 1 } })

  it('밝은 수끼리는 막이 없다', () => {
    expect(scene(1, 2, 0.5)).toBeNull()
  })

  it('어둠 1수 전은 칸 막 없이 다리만 반 진하기다', () => {
    const half = scene(2, 3, 0.5)

    expect(half?.field).toBe(0)
    expect(scene(2, 3, 1)?.bridge).toBeCloseTo(0.5)
  })

  it('어둠에는 빛 칸만 옅고 나머지는 까맣다', () => {
    const dark = scene(3, 4, 1)

    expect(dark?.field).toBe(1)
    expect(dark?.veilOf({ x: 1, y: 1 }, 0).top).toEqual([0.2])
    expect(dark?.veilOf({ x: 5, y: 1 }, 0).top).toEqual([1])
    expect(dark?.bridge).toBe(1)
  })

  it('도착 칸은 큐브가 가는 내내 켜져 도착할 때 다 켜지고 떠나는 칸은 뒤 절반에 꺼진다', () => {
    const prev = at(3, WIDE)
    const game = { ...at(4, WIDE), player: { x: 2, y: 1 } }
    const scene = (x: number) => nightScene({ prev, game, events: [], t: 0.5, cube: { x, y: 1 } })!

    expect(scene(1.5).veilOf({ x: 1, y: 1 }, 0).top).toEqual([0.2])
    expect(scene(1.5).veilOf({ x: 2, y: 1 }, 0).top[0]).toBeGreaterThan(0.2)
    expect(scene(1.75).veilOf({ x: 1, y: 1 }, 0).top[0]).toBeGreaterThan(0.2)
    expect(scene(2).veilOf({ x: 2, y: 1 }, 0).top).toEqual([0.2])
  })

  it('빛보다 높은 칸은 윗면이 까맣고 옆면만 빛을 받는다', () => {
    const dark = scene(3, 4, 1)
    const wall = dark?.veilOf({ x: 2, y: 1 }, 2)

    expect(wall?.top).toEqual([1])
    expect(Math.min(...(wall?.sides ?? []))).toBeLessThan(1)
  })

  it('밝아지는 수에 막과 다리가 걷힌다', () => {
    expect(scene(5, 6, 0)?.field).toBe(1)
    expect(scene(5, 6, 1)?.field).toBe(0)
    expect(scene(5, 6, 1)?.bridge).toBe(0)
  })

  it('20월드까지는 막이 없다', () => {
    const plain = { ...WIDE, id: '20-1' }
    expect(
      nightScene({
        prev: at(3, plain),
        game: at(4, plain),
        events: [],
        t: 1,
        cube: { x: 0, y: 0 },
      }),
    ).toBeNull()
  })
})

describe('nightCellOf', () => {
  it('큐브 칸은 칸 덮개 없이 빛 지도를 쉼표로 잇고, 큐브 덮개는 큐브 그림이 따라간다', () => {
    const game = at(4)
    const night = nightScene({ prev: at(3), game, events: [], t: 1, cube: { x: 0, y: 0 } })!
    const cell = nightCellOf(night, game, { x: 0, y: 0 }, 0, [])
    const cover = cubeCover(night, at(3), game, {
      cube: { x: 0, y: 0, level: 0, lift: 0 },
      cubeCell: { x: 0, y: 0 },
      cubeFaces: [{ points: '0,0 10,5 0,10' }],
      cubeSink: 2,
    })

    expect(cell.veil.split(',')).toHaveLength(64)
    expect(cell.cover).toBe('')
    expect(cover.d).toBe('M0,2 10,7 0,12Z')
    expect(nightCellOf(night, game, { x: 0, y: 0 }, 0, [cover]).hole).toBe(cover.d)
  })
})

describe('nightVeils', () => {
  it('1수 전 막이 그 수의 움직임 시간 동안 짙어진다', () => {
    const veils = nightVeils(at(2), at(3), [
      { type: 'moved', from: { x: 0, y: 0 }, to: { x: 1, y: 0 } },
    ])

    expect(veils?.front.opacity).toBeCloseTo(0.22)
    expect(veils?.back.backgroundColor).toBe('var(--color-base-bg)')
    expect(veils?.front.transition).toBe(`opacity ${veils?.seconds}s ease-in 0s`)
    expect(veils?.seconds).toBeGreaterThan(0.2)
  })

  it('어둠에는 게임 화면 바탕이 까매진다', () => {
    const veils = nightVeils(at(3), at(4), [])

    expect(veils?.front.opacity).toBe(0)
    expect(veils?.back.backgroundColor).toBe('var(--color-night)')
  })
})

describe('movingBoxCover', () => {
  it('밀려 가는 상자는 도착 칸 덮개 대신 상자를 따라가는 덮개를 받고 지나는 칸 바닥 막에 구멍을 낸다', () => {
    const game = { ...at(4), boxes: [{ x: 1, y: 0 }] }
    const night = nightScene({ prev: at(3), game, events: [], t: 1, cube: { x: 0, y: 0 } })!
    const to = { x: 1, y: 0 }
    const moving = movingBoxCover(
      night,
      { x: 10, y: 20, to, cell: to },
      { x: 0.5, y: 0, level: 0 },
      [{ type: 'pushed', from: { x: 0, y: 0 }, to, result: 'slid' }],
    )
    const cell = nightCellOf(night, game, to, 0, [moving])

    expect(moving.opacity).toBeLessThan(1)
    expect(cell.cover).toBe('')
    expect(cell.hole).toBe(moving.d)
    expect(nightCellOf(night, game, to, 0, []).cover).not.toBe('')
    expect(nightCellOf(night, game, { x: 2, y: 0 }, 0, [moving]).hole).toBe('')
  })
})

describe('nightCellOf', () => {
  it('재가 된 숯 벽 칸에는 덮개가 없다', () => {
    const stage: Stage = { ...NIGHT, fire: ['.#.'] }
    const game = { ...at(4, stage), ashes: [{ x: 1, y: 0 }] }
    const night = nightScene({ prev: at(3, stage), game, events: [], t: 1, cube: { x: 0, y: 0 } })!

    expect(nightCellOf(night, game, { x: 1, y: 0 }, 0, []).cover).toBe('')
    expect(nightCellOf(night, at(4, stage), { x: 1, y: 0 }, 0, []).cover).not.toBe('')
  })
})

describe('guideNightOf', () => {
  it('다리가 사라지는 가이드 단계에만 첫 어둠 박자를 보여 준다', () => {
    const shown = guideNightOf(at(0), 'shadowFade')

    expect(shown && nightDisplay(shown)?.phase).toBe('dark')
    expect(guideNightOf(at(0), 'shadow')).toBeNull()
    expect(guideNightOf(at(0), undefined)).toBeNull()
  })
})

describe('nightScene', () => {
  it('판 끝에 닿은 빛 칸은 끝 변 쪽으로 어두워진다', () => {
    const game = at(4)
    const night = nightScene({ prev: at(3), game, events: [], t: 1, cube: { x: 0, y: 0 } })!
    const top = night.veilOf({ x: 0, y: 0 }, 0).top

    expect(Math.max(...top)).toBeGreaterThan(0.8)
    expect(Math.min(...top)).toBeLessThan(0.5)
  })
})

describe('stillBoxCover', () => {
  it('다리 위 상자는 다리 높이 위에 서고 그 칸 빛만큼 덮인다', () => {
    const game = at(4)
    const night = nightScene({ prev: at(3), game, events: [], t: 1, cube: { x: 0, y: 0 } })!
    const box = stillBoxCover(night, { x: 0, y: 100, p: { x: 2, y: 0 } }, 0)

    expect(box.top).toBe(100 - TILE.layer)
    expect(box.opacity).toBeGreaterThan(0.5)
  })
})

describe('nightVeils', () => {
  it('되돌림이 있는 수는 이동 뒤에 바탕 어둠이 걷힌다', () => {
    const veils = nightVeils(at(5), at(6), [
      { type: 'moved', from: { x: 0, y: 0 }, to: { x: 1, y: 0 } },
      { type: 'returned', from: { x: 1, y: 0 }, to: { x: 0, y: 0 } },
    ])

    expect(veils?.back.transition).toMatch(/0\.42s ease-out 0\.\d+s$/)
  })
})

describe('sinkingBoxCovers', () => {
  it('다리에서 빠지는 상자 칸마다 덮개와 바닥 막 구멍을 낸다', () => {
    const game = at(6)
    const night = nightScene({
      prev: at(5),
      game,
      events: [{ type: 'shadowFilled', at: { x: 1, y: 0 } }],
      t: 0.5,
      cube: { x: 0, y: 0 },
    })!
    const covers = sinkingBoxCovers(night, game)

    expect(covers).toHaveLength(1)
    expect(nightCellOf(night, game, { x: 1, y: 0 }, 0, covers).hole).toBe(covers[0].d)
  })
})

describe('nightScene', () => {
  it('칸 사이 자리의 빛 지도는 판 끝으로 보지 않는다', () => {
    const row = [0, 0, 0, 0, 0]
    const stage: Stage = { ...NIGHT, heights: [row, row, row], start: { x: 2, y: 1 } }
    const night = nightScene({
      prev: at(3, stage),
      game: at(4, stage),
      events: [],
      t: 1,
      cube: { x: 2, y: 1 },
    })!

    expect(night.veilOf({ x: 2.5, y: 1 }, 0).top.every((v) => v < 0.9)).toBe(true)
  })
})

describe('bridgeLight', () => {
  it('큐브 칸 다리는 많이, 먼 다리는 빛을 받지 않고, 밝을 때는 0이다', () => {
    const night = nightScene({ prev: at(3), game: at(4), events: [], t: 1, cube: { x: 0, y: 0 } })!

    expect(bridgeLight(night, { x: 0, y: 0 }, 0)).toBeGreaterThan(0.5)
    expect(bridgeLight(night, { x: 2, y: 0 }, 0)).toBeLessThan(0.1)
    expect(bridgeLight(null, { x: 0, y: 0 }, 0)).toBe(0)
  })
})
