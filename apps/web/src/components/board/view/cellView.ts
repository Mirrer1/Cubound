import type { VineKind } from '../frame/vineFrame'
import { CUBE } from './cubeView'
import { blend, checker, shade } from './shadeView'
import { TILE, isoDelta } from '@/game/iso'
import type { Direction } from '@/game/types'

// 닳으면 칸이 네 조각으로 갈라지고 밟힌 만큼 조각이 들린다. 들리는 자리는 칸마다 어긋난다
const QUARTERS: [number, number][] = [
  [-0.25, -0.25],
  [0.25, -0.25],
  [0.25, 0.25],
  [-0.25, 0.25],
]
export const QUARTER = { scale: 0.485, depth: 4, rise: 4 }

// 무너질 때만 네 조각으로 갈라진다. 가만히 있을 때 갈라 두면 칸이 붙었을 때 줄눈처럼 보인다
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

// 승강 발판은 칸 크기의 틀 위에 얹힌 판이다. 틀과 판의 밝기 차이가 기계로 읽힌다
export const PLATE = { scale: 0.84, rise: 4, depth: 4 }

// 늪은 칸 안쪽만 꺼진 진흙 면이다. 칸 테두리가 땅색으로 남아 땅에 난 웅덩이로 읽힌다
export const MUD = { scale: 0.8, drop: 5 }
// 잠긴 큐브와 상자의 밑면 앞 모서리가 진흙 면 아래로 내려가는 거리. 둘은 폭이 같다
export const MUD_DIP = (TILE.width * CUBE) / 4
// 가라앉는 상자가 진흙 아래로 다 들어가는 거리. 상자 윗면 꼭짓점이 진흙 면 밑까지 내려간다
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

// 발판 길 칸은 구덩이로 그린다. 바닥은 높이 0 칸의 윗면보다 이만큼 아래다
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

// 발판 길과 아직 안 자란 덩굴 길은 구덩이로 그린다. 자라는 중인 칸은 구덩이에서 판이 차오른다
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
  // 닳은 단계 사이에서는 앞뒤 단계 색을 섞는다
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
  // 바닥은 제 색 토큰이 둘이라 이미 번갈아 있고 구멍은 한 칸뿐이다. 덩굴은 마디로 칸이 세인다
  const evenOdd = crack || (surface !== null && surface !== 'hole')
  return evenOdd ? { ...plain, top: checker(plain.top, parity) } : plain
}

// 갈라짐은 한 번 밟은 뒤부터다. 무너지는 중에는 조각이 따로 날아간다
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
  // 길 끝 칸은 이웃이 하나라 반대쪽으로도 띠를 이어 칸을 채우고, 그 자리가 멈춤 블록 자리다
  const stopAt = neighbors.length === 1 ? [-neighbors[0][0], -neighbors[0][1]] : null
  const rails = stopAt ? [neighbors[0], stopAt] : neighbors
  const stopOffset = stopAt ? isoDelta(STOP.offset * stopAt[0], STOP.offset * stopAt[1]) : null
  return { rails, stopOffset }
}

// 시드는 동안 갓 색이 흙분홍에서 따뜻한 회색으로 빠진다
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
