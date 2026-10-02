import type { VineKind } from '../frame/vineFrame'
import { CUBE } from './cubeView'
import { blend, checker, shade } from './shadeView'
import { TILE, isoDelta } from '@/game/iso'
import type { Direction } from '@/game/types'

// 닳은 칸의 네 조각, 밟힌 만큼 들리는 조각, 칸마다 어긋나는 들리는 자리
const QUARTERS: [number, number][] = [
  [-0.25, -0.25],
  [0.25, -0.25],
  [0.25, 0.25],
  [-0.25, 0.25],
]
export const QUARTER = { scale: 0.485, depth: 4, rise: 4 }

// 무너질 때만 갈라지는 네 조각, 가만히 있을 때 갈라 두면 붙은 칸이 줄눈처럼 보이는 탓
const SHARDS: [number, number][] = [
  [-0.25, -0.25],
  [0.25, -0.25],
  [0.25, 0.25],
  [-0.25, 0.25],
]
export const SHARD = { scale: 0.46, away: 0.72, sink: [0, 7, 3, 10], thin: 5 }

const SURFACES = {
  hole: {
    top: 'var(--color-goal)',
    left: 'var(--color-floor-left)',
    right: 'var(--color-floor-right)',
  },
  tool: { top: shade('tool', 'top'), left: shade('tool', 'left'), right: shade('tool', 'right') },
  ice: {
    top: 'var(--color-ice)',
    left: 'var(--color-ice-left)',
    right: 'var(--color-ice-right)',
  },
  machine: {
    top: 'var(--color-machine-frame-top)',
    left: 'var(--color-machine-frame-left)',
    right: 'var(--color-machine-frame-right)',
  },
  vine: {
    top: 'var(--color-vine-top)',
    left: 'var(--color-vine-left)',
    right: 'var(--color-vine-right)',
  },
  hardVine: {
    top: 'var(--color-vine-hard-top)',
    left: 'var(--color-vine-hard-left)',
    right: 'var(--color-vine-hard-right)',
  },
}

// 칸 크기의 틀 위에 얹힌 승강 발판의 판, 틀과 판의 밝기 차이로 읽히는 기계
export const PLATE = { scale: 0.84, rise: 4, depth: 4 }

// 칸 안쪽만 꺼진 늪의 진흙 면, 땅색 칸 테두리로 읽히는 웅덩이
export const MUD = { scale: 0.8, drop: 5 }
// 잠긴 큐브와 상자의 밑면 앞 모서리가 진흙 면 아래로 내려가는 거리, 둘 다 같은 폭
export const MUD_DIP = (TILE.width * CUBE) / 4
// 가라앉는 상자가 진흙 아래로 다 들어가는 거리, 상자 윗면 꼭짓점이 진흙 면 밑에 닿는 깊이
export const BOX_SINK = TILE.layer + MUD.drop + (TILE.width * CUBE) / 4

const CAP = {
  live: {
    stem: 'var(--color-mushroom-stem-top)',
    top: 'var(--color-mushroom-cap-top)',
    left: 'var(--color-mushroom-cap-left)',
    right: 'var(--color-mushroom-cap-right)',
    crown: 'var(--color-mushroom-crown)',
  },
  dry: {
    stem: 'var(--color-mushroom-withered-stem)',
    top: 'var(--color-mushroom-withered-top)',
    left: 'var(--color-mushroom-withered-left)',
    right: 'var(--color-mushroom-withered-right)',
    crown: 'var(--color-mushroom-withered-crown)',
  },
}

const vineFaces = (hard: number) =>
  hard <= 0
    ? SURFACES.vine
    : hard >= 1
      ? SURFACES.hardVine
      : {
          top: blend(SURFACES.vine.top, SURFACES.hardVine.top, hard),
          left: blend(SURFACES.vine.left, SURFACES.hardVine.left, hard),
          right: blend(SURFACES.vine.right, SURFACES.hardVine.right, hard),
        }

// 구덩이로 그리는 발판 길 칸의 바닥 깊이, 높이 0 칸의 윗면 기준
export const PIT_FLOOR = 11
// 길 끝에서 방향이 뒤집히는 자리에 서는 블록
export const STOP = { offset: 0.36, scale: 0.2, depth: 9 }

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

export const spotPoints = (x: number, y: number, spots: [number, number][]) =>
  spots
    .map(([u, v]) => {
      const d = isoDelta(u, v)
      return `${x + d.x},${y + d.y}`
    })
    .join(' ')

// 구덩이로 그리는 칸, 발판 길과 아직 안 자란 덩굴 길과 판이 차오르는 중인 칸
export const isPit = (rail: string, vine: VineKind | null, grownVine: boolean, vineRise: number) =>
  rail !== '' ||
  vine === 'next' ||
  vine === 'future' ||
  vine === 'spent' ||
  (grownVine && vineRise < 1)

export const cellFaces = (
  surface: 'hole' | 'tool' | 'ice' | 'machine' | null,
  grownVine: boolean,
  vineHard: number,
  crack: boolean,
  crackStage: number,
  parity: boolean,
) => {
  // 닳은 단계 사이는 앞뒤 단계 색을 섞은 색
  const worn = Math.min(1, Math.floor(crackStage))
  const crackFace = (face: string) =>
    blend(
      `var(--color-crack-${face}-${worn})`,
      `var(--color-crack-${face}-${worn + 1})`,
      crackStage - worn,
    )
  const plain = grownVine
    ? vineFaces(vineHard)
    : surface
      ? SURFACES[surface]
      : crack
        ? { top: crackFace('top'), left: crackFace('left'), right: crackFace('right') }
        : {
            top: parity ? 'var(--color-floor-top-alt)' : 'var(--color-floor-top)',
            left: 'var(--color-floor-left)',
            right: 'var(--color-floor-right)',
          }
  // 체크 무늬 제외, 토큰 둘로 이미 번갈아 있는 바닥과 한 칸뿐인 구멍과 마디로 세이는 덩굴
  const evenOdd = crack || (surface !== null && surface !== 'hole')
  return evenOdd ? { ...plain, top: checker(plain.top, parity) } : plain
}

// 한 번 밟은 뒤부터의 갈라짐, 무너지는 중에는 따로 날아가는 조각
export const crackSplit = (crack: boolean, crackBroken: number, crackStage: number) =>
  crack && crackBroken === 0 ? clamp01(crackStage) : 0

export const crackQuarters = (
  x: number,
  y: number,
  split: number,
  crackStage: number,
  crackSeed: number,
) =>
  split > 0
    ? QUARTERS.map(([u, v], i) => {
        const d = isoDelta(u, v)
        const lifted = (i - crackSeed + 4) % 4 < Math.round(crackStage)
        return {
          key: i,
          x: x + d.x * (1 + split * 0.025),
          y: y + d.y * (1 + split * 0.025) - (lifted ? split * QUARTER.rise : 0),
        }
      })
    : []

export const crackShards = (x: number, y: number, crackBroken: number, depth: number) =>
  crackBroken > 0
    ? SHARDS.map(([u, v], i) => {
        const d = isoDelta(u, v)
        const away = 1 + crackBroken * SHARD.away
        return {
          key: i,
          x: x + d.x * away,
          y: y + d.y * away + crackBroken * SHARD.sink[i],
          depth: Math.max(SHARD.thin, depth - crackBroken * (depth - SHARD.thin)),
        }
      })
    : []

export const leaningOf = (leaning: string) =>
  leaning
    ? leaning.split('|').map((item) => {
        const [direction, opacity] = item.split(':')
        return { direction: direction as Direction, opacity: Number(opacity) }
      })
    : []

export const railLayout = (rail: string) => {
  const neighbors = rail ? rail.split('|').map((d) => d.split(',').map(Number)) : []
  // 이웃이 하나인 길 끝 칸은 반대쪽까지 이은 띠, 그 자리가 멈춤 블록 자리
  const stopAt = neighbors.length === 1 ? [-neighbors[0][0], -neighbors[0][1]] : null
  const rails = stopAt ? [neighbors[0], stopAt] : neighbors
  const stopOffset = stopAt ? isoDelta(STOP.offset * stopAt[0], STOP.offset * stopAt[1]) : null
  return { rails, stopOffset }
}

// 시드는 동안 흙분홍에서 따뜻한 회색으로 빠지는 갓 색
export const capColors = (wither: number) =>
  wither > 0
    ? {
        stem: blend(CAP.live.stem, CAP.dry.stem, wither),
        top: blend(CAP.live.top, CAP.dry.top, wither),
        left: blend(CAP.live.left, CAP.dry.left, wither),
        right: blend(CAP.live.right, CAP.dry.right, wither),
        crown: blend(CAP.live.crown, CAP.dry.crown, wither),
      }
    : CAP.live
