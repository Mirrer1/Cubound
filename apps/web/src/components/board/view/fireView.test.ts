import { describe, expect, it } from 'vitest'

import {
  CHAR_WALL,
  bridgePieces,
  charTone,
  emberKeyframes,
  fireStyle,
  glowOf,
  isoPoint,
  logQuads,
  lumpTops,
  pileLumps,
  pileReach,
  wallCrumble,
} from './fireView'
import { TILE } from '@/game/iso'

describe('isoPoint', () => {
  it('칸 윗면 가운데에서 u, v 칸 배수와 높이 z만큼 옮긴 화면 자리다', () => {
    expect(isoPoint(0, 0, 0.5, 0)).toEqual({ x: TILE.width / 4, y: TILE.height / 4 })
    expect(isoPoint(10, 20, 0, 0, 5)).toEqual({ x: 10, y: 15 })
  })
})

describe('charTone', () => {
  it('heat 0은 숯 색, 1은 숯불빛이다', () => {
    expect(charTone(0).top).toContain('var(--color-char-top)')
    expect(charTone(0).top).toContain('0%')
    expect(charTone(1).top).toContain('var(--color-heat-top) 100%')
  })
})

describe('glowOf', () => {
  it('달아오름까지는 0이고 불붙음에서 1로 이어서 오른다', () => {
    expect(glowOf(0)).toBe(0)
    expect(glowOf(0.5)).toBe(0)
    expect(glowOf(0.75)).toBeCloseTo(0.5)
    expect(glowOf(1)).toBe(1)
  })
})

describe('pileLumps', () => {
  it('체크 칸마다 위 덩이 자리가 엇갈린 두 벌이고 밑 덩이는 칸 폭 0.8배다', () => {
    const a = pileLumps(false)
    const b = pileLumps(true)

    expect(a[0].scale).toBe(0.8)
    expect(a[1].u).not.toBe(b[1].u)
    expect(Math.max(...a.map((l) => l.z + l.height))).toBe(CHAR_WALL.height)
  })

  it('화면 안쪽 덩이를 먼저 그리는 순서다', () => {
    const lumps = pileLumps(true)
    const depth = lumps.slice(1).map((l) => l.u + l.v)

    expect(depth).toEqual([...depth].sort((p, q) => p - q))
  })
})

describe('pileReach', () => {
  it('칸 윗면 가운데에서 숯 벽 맨 위 꼭짓점까지 높이로 한 층 블록 윗면보다 낮다', () => {
    expect(pileReach()).toBeGreaterThan(CHAR_WALL.height)
    expect(pileReach()).toBeLessThan(TILE.layer + TILE.width / 4)
  })
})

describe('wallCrumble', () => {
  it('부서지기 전에는 숯만, 다 부서지면 재 덩이 없이 자국만 남는다', () => {
    expect(wallCrumble(0)).toMatchObject({ pile: 1, lumps: 0 })
    expect(wallCrumble(1)).toMatchObject({ pile: 0, lumps: 0 })
  })

  it('가운데에서는 숯이 옅어진 자리에 재 덩이가 보인다', () => {
    const mid = wallCrumble(0.4)

    expect(mid.pile).toBeLessThan(1)
    expect(mid.lumps).toBeGreaterThan(0.5)
  })

  it('숯과 재 덩이 진하기가 이어서 바뀐다', () => {
    for (let c = 0; c < 1; c += 0.02) {
      const a = wallCrumble(c)
      const b = wallCrumble(c + 0.02)
      expect(Math.abs(a.pile - b.pile)).toBeLessThan(0.1)
      expect(Math.abs(a.lumps - b.lumps)).toBeLessThan(0.15)
    }
  })
})

describe('bridgePieces', () => {
  it('조각 셋이 내려앉으며 끝에는 사라진다', () => {
    expect(bridgePieces(0).pieces).toHaveLength(3)
    expect(bridgePieces(0).slab).toBe(1)
    expect(bridgePieces(1).slab).toBe(0)
    expect(bridgePieces(1).opacity).toBe(0)
    expect(bridgePieces(0.5).drop).toBeGreaterThanOrEqual(12)
  })

  it('떨어지는 거리가 되돌아가지 않는다', () => {
    let last = 0
    for (let c = 0; c <= 1; c += 0.05) {
      expect(bridgePieces(c).drop).toBeGreaterThanOrEqual(last)
      last = bridgePieces(c).drop
    }
  })
})

describe('emberKeyframes', () => {
  it('보이지 않게 시작해 오르며 옅어지고 바퀴 끝까지 숨는다', () => {
    const frames = emberKeyframes(12, 1800)

    expect(frames[0]).toMatchObject({ offset: 0, opacity: 0 })
    expect(frames.at(-1)).toMatchObject({ offset: 1, opacity: 0 })
    expect(frames.some((f) => f.transform === 'translate(0px, -12px)')).toBe(true)
  })
})

describe('fireStyle', () => {
  it('보스 불은 빛 고임이 넓고 진하며 불티가 많고 높이 오른다', () => {
    const normal = fireStyle(false)
    const boss = fireStyle(true)

    expect(normal).toMatchObject({ pool: 1.35, poolOpacity: 0.13, count: 2, rise: 12 })
    expect(boss).toMatchObject({ pool: 1.75, poolOpacity: 0.2, count: 7, rise: 20 })
    expect(boss.every).toBeLessThan(normal.every)
  })
})

describe('lumpTops', () => {
  it('덩이마다 윗면 가운데 화면 자리를 붙인다', () => {
    const [base] = lumpTops(0, 0, pileLumps(false))

    expect(base.top).toEqual({ x: 0, y: -13 })
  })

  it('밑 높이가 없는 조각은 두께만큼 위가 윗면이다', () => {
    const [first] = lumpTops(0, 0, [{ u: 0, v: 0, scale: 0.3, height: 8 }])

    expect(first.top).toEqual({ x: 0, y: -8 })
  })
})

describe('logQuads', () => {
  it('장작 둘의 몸통, 윗결, 빛 사각형이고 밝은 윗결은 체크 칸마다 엇갈린다', () => {
    const a = logQuads(0, 0, false)
    const b = logQuads(0, 0, true)

    expect(a).toHaveLength(2)
    expect(a.map((log) => log.bright)).toEqual([false, true])
    expect(b.map((log) => log.bright)).toEqual([true, false])
    expect(a[0].body.split(' ')).toHaveLength(4)
  })
})
