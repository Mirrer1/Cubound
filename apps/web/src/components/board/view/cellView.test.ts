import { describe, expect, it } from 'vitest'

import {
  BOX_SINK,
  MUD,
  MUD_DIP,
  QUARTER,
  SHARD,
  STOP,
  capColors,
  cellFaces,
  clamp01,
  crackQuarters,
  crackShards,
  crackSplit,
  isPit,
  leaningOf,
  railLayout,
  spotPoints,
} from './cellView'
import { CUBE } from './cubeView'
import { checker } from './shadeView'
import { TILE, isoDelta } from '@/game/iso'

describe('BOX_SINK', () => {
  it('가라앉는 상자는 한 층에 진흙 깊이와 밑면이 잠기는 거리를 더한 만큼 내려간다', () => {
    expect(BOX_SINK).toBe(TILE.layer + MUD.drop + MUD_DIP)
  })
})

describe('MUD_DIP', () => {
  it('잠긴 밑면 앞 모서리는 큐브 폭의 4분의 1만큼 진흙 아래로 내려간다', () => {
    expect(MUD_DIP).toBe((TILE.width * CUBE) / 4)
  })
})

describe('clamp01', () => {
  it('0과 1 사이로 자른다', () => {
    expect(clamp01(-0.5)).toBe(0)
    expect(clamp01(0.3)).toBe(0.3)
    expect(clamp01(1.5)).toBe(1)
  })
})

describe('spotPoints', () => {
  it('칸 단위 자리를 화면 점으로 바꿔 잇는다', () => {
    const d = isoDelta(0.5, 0)

    expect(spotPoints(10, 20, [[0, 0]])).toBe('10,20')
    expect(spotPoints(10, 20, [[0.5, 0]])).toBe(`${10 + d.x},${20 + d.y}`)
  })
})

describe('isPit', () => {
  it('발판 길 칸은 구덩이다', () => {
    expect(isPit('1,0', null, false, 1)).toBe(true)
  })

  it('아직 안 자란 덩굴 길은 구덩이다', () => {
    expect(isPit('', 'next', false, 1)).toBe(true)
    expect(isPit('', 'future', false, 1)).toBe(true)
    expect(isPit('', 'spent', false, 1)).toBe(true)
  })

  it('자란 덩굴 칸은 판이 다 차오르기 전까지만 구덩이다', () => {
    expect(isPit('', 'grown', true, 0.5)).toBe(true)
    expect(isPit('', 'grown', true, 1)).toBe(false)
  })

  it('뿌리 칸과 보통 칸은 구덩이가 아니다', () => {
    expect(isPit('', 'root', false, 1)).toBe(false)
    expect(isPit('', null, false, 1)).toBe(false)
  })
})

describe('cellFaces', () => {
  it('보통 바닥은 번갈아 두 토큰을 쓰고 체크 무늬를 더하지 않는다', () => {
    expect(cellFaces(null, false, 0, false, 0, false).top).toBe('var(--color-floor-top)')
    expect(cellFaces(null, false, 0, false, 0, true).top).toBe('var(--color-floor-top-alt)')
  })

  it('구멍은 체크 무늬를 더하지 않는다', () => {
    expect(cellFaces('hole', false, 0, false, 0, true).top).toBe('var(--color-goal)')
  })

  it('얼음 같은 제 색 칸은 한 칸씩 번갈아 어둡게 한다', () => {
    expect(cellFaces('ice', false, 0, false, 0, true).top).toBe(checker('var(--color-ice)', true))
    expect(cellFaces('ice', false, 0, false, 0, false).top).toBe('var(--color-ice)')
  })

  it('자란 덩굴은 굳은 만큼 굳은 덩굴 색으로 바뀐다', () => {
    expect(cellFaces(null, true, 0, false, 0, false).left).toBe('var(--color-vine-left)')
    expect(cellFaces(null, true, 1, false, 0, false).left).toBe('var(--color-vine-hard-left)')
    expect(cellFaces(null, true, 0.5, false, 0, false).left).toContain(
      'var(--color-vine-hard-left)',
    )
  })

  it('무너지는 칸은 닳은 단계 사이 색을 섞는다', () => {
    const faces = cellFaces(null, false, 0, true, 0.5, false)

    expect(faces.left).toContain('var(--color-crack-left-0)')
    expect(faces.left).toContain('var(--color-crack-left-1)')
  })
})

describe('crackSplit', () => {
  it('무너지는 칸은 닳은 단계만큼 갈라지고 1에서 멈춘다', () => {
    expect(crackSplit(true, 0, 0.4)).toBe(0.4)
    expect(crackSplit(true, 0, 2)).toBe(1)
  })

  it('무너지는 중이거나 무너지는 칸이 아니면 갈라지지 않는다', () => {
    expect(crackSplit(true, 0.5, 1)).toBe(0)
    expect(crackSplit(false, 0, 1)).toBe(0)
  })
})

describe('crackQuarters', () => {
  it('갈라지지 않으면 조각이 없다', () => {
    expect(crackQuarters(0, 0, 0, 1, 0)).toEqual([])
  })

  it('밟힌 단계 수만큼 조각이 들린다', () => {
    const quarters = crackQuarters(0, 0, 1, 1, 0)
    const d = isoDelta(-0.25, -0.25)

    expect(quarters).toHaveLength(4)
    expect(quarters[0]).toEqual({ key: 0, x: d.x * 1.025, y: d.y * 1.025 - QUARTER.rise })
    expect(quarters[1].y).toBe(isoDelta(0.25, -0.25).y * 1.025)
  })

  it('들리는 조각은 칸마다 어긋난다', () => {
    const quarters = crackQuarters(0, 0, 1, 1, 1)

    expect(quarters[0].y).toBe(isoDelta(-0.25, -0.25).y * 1.025)
    expect(quarters[1].y).toBe(isoDelta(0.25, -0.25).y * 1.025 - QUARTER.rise)
  })
})

describe('crackShards', () => {
  it('무너지기 전에는 조각이 없다', () => {
    expect(crackShards(0, 0, 0, 20)).toEqual([])
  })

  it('무너질수록 조각이 벌어지고 내려가며 얇아진다', () => {
    const shards = crackShards(0, 0, 1, 20)
    const d = isoDelta(0.25, -0.25)
    const away = 1 + SHARD.away

    expect(shards).toHaveLength(4)
    expect(shards[1]).toEqual({
      key: 1,
      x: d.x * away,
      y: d.y * away + SHARD.sink[1],
      depth: SHARD.thin,
    })
  })
})

describe('leaningOf', () => {
  it('빈 값이면 사다리가 없다', () => {
    expect(leaningOf('')).toEqual([])
  })

  it('방향과 투명도를 푼다', () => {
    expect(leaningOf('up:1|left:0.5')).toEqual([
      { direction: 'up', opacity: 1 },
      { direction: 'left', opacity: 0.5 },
    ])
  })
})

describe('railLayout', () => {
  it('길 칸이 아니면 레일이 없다', () => {
    expect(railLayout('')).toEqual({ rails: [], stopOffset: null })
  })

  it('이웃이 둘인 칸은 두 쪽으로 레일을 잇고 멈춤 블록이 없다', () => {
    expect(railLayout('1,0|-1,0')).toEqual({
      rails: [
        [1, 0],
        [-1, 0],
      ],
      stopOffset: null,
    })
  })

  it('길 끝 칸은 반대쪽으로도 레일을 잇고 그 자리에 멈춤 블록을 둔다', () => {
    expect(railLayout('0,1')).toEqual({
      rails: [
        [0, 1],
        [-0, -1],
      ],
      stopOffset: isoDelta(STOP.offset * -0, STOP.offset * -1),
    })
  })
})

describe('capColors', () => {
  it('시들지 않은 갓은 제 색이다', () => {
    expect(capColors(0).top).toBe('var(--color-mushroom-cap-top)')
  })

  it('시드는 갓은 시든 색과 섞는다', () => {
    const colors = capColors(0.5)

    expect(colors.top).toContain('var(--color-mushroom-cap-top)')
    expect(colors.top).toContain('var(--color-mushroom-withered-top)')
  })
})
