import { clamp01 } from './cellView'
import { blend } from './shadeView'
import { TILE } from '@/game/iso'

const smooth = (t: number) => t * t * (3 - 2 * t)

// 숯 벽 높이 px
export const CHAR_WALL = { height: 22 }

// 불티 하나가 오르는 ms
export const EMBER_LIFE = 1600

// 보통 불과 보스 불, 빛 고임 칸 폭 배수와 진하기, 숯 안쪽 빛 배수, 불티 수와 오르는 높이 px와 새로 나는 간격 ms
export const fireStyle = (boss: boolean) =>
  boss
    ? { pool: 1.75, poolOpacity: 0.2, inner: 1.25, count: 7, rise: 20, every: 450 }
    : { pool: 1.35, poolOpacity: 0.13, inner: 1, count: 2, rise: 12, every: 900 }

// 2.4초 주기 빛 일렁임
export const FLICKER: Keyframe[] = [
  { offset: 0, opacity: 1, easing: 'ease-in-out' },
  { offset: 1 / 3, opacity: 0.8, easing: 'ease-in-out' },
  { offset: 2 / 3, opacity: 0.92, easing: 'ease-in-out' },
  { offset: 1, opacity: 1 },
]
export const FLICKER_MS = 2400

// 칸 윗면 가운데 x, y에서 u, v 칸 배수와 높이 z px만큼 옮긴 화면 자리
export const isoPoint = (x: number, y: number, u: number, v: number, z = 0) => ({
  x: x + ((u - v) * TILE.width) / 2,
  y: y + ((u + v) * TILE.height) / 2 - z,
})

// u, v 범위의 납작한 사각형 꼭짓점
export const uvQuad = (
  x: number,
  y: number,
  u0: number,
  u1: number,
  v0: number,
  v1: number,
  z = 0,
) =>
  [
    isoPoint(x, y, u0, v0, z),
    isoPoint(x, y, u1, v0, z),
    isoPoint(x, y, u1, v1, z),
    isoPoint(x, y, u0, v1, z),
  ]
    .map((p) => `${p.x},${p.y}`)
    .join(' ')

// heat 0 숯에서 1 숯불빛으로 섞은 면 색, 위 덩이와 장작 윗결이 먼저 물드는 hi
export const charTone = (heat: number) => ({
  top: blend('var(--color-char-top)', 'var(--color-heat-top)', heat),
  left: blend('var(--color-char-left)', 'var(--color-heat-left)', heat),
  right: blend('var(--color-char-right)', 'var(--color-heat-right)', heat),
  hi: blend('var(--color-char-hi)', 'var(--color-heat-hot)', heat * 0.85),
  lo: blend('var(--color-char-lo)', 'var(--color-heat-ring)', heat),
})

// 숯 안쪽 빛 세기, 달아오름까지는 0
export const glowOf = (heat: number) => clamp01((heat - 0.5) * 2)

export interface Lump {
  u: number
  v: number
  scale: number // 칸 폭 배수
  z: number // 밑 높이 px
  height: number
}

const lump = ([u, v, scale, z, height]: number[]): Lump => ({ u, v, scale, z, height })

// 체크 칸마다 엇갈린 두 벌 숯 더미, 밑 덩이 위에 작은 덩이 둘
const PILES = [
  [
    [0, 0, 0.8, 0, 13],
    [-0.13, -0.1, 0.46, 13, 9],
    [0.17, 0.13, 0.3, 13, 6],
  ],
  [
    [0, 0, 0.8, 0, 13],
    [-0.15, 0.15, 0.3, 13, 6],
    [0.1, -0.14, 0.46, 13, 9],
  ],
]

export const pileLumps = (parity: boolean) =>
  PILES[parity ? 1 : 0]
    .map(lump)
    .sort((a, b) => (a.z === b.z ? a.u + a.v - (b.u + b.v) : a.z - b.z))

// 칸 윗면 가운데에서 숯 벽 맨 위 꼭짓점까지 높이 px
export const pileReach = () =>
  Math.max(
    ...[false, true].flatMap((parity) =>
      pileLumps(parity).map(
        (l) => l.z + l.height - ((l.u + l.v) * TILE.height) / 2 + (TILE.width * l.scale) / 4,
      ),
    ),
  )

// 부서지는 숯 벽에 남는 재 덩이, 앞 둘은 아직 숯불빛
export const ASH_LUMPS = [
  { u: -0.15, v: -0.12, scale: 0.34, height: 10, ember: true },
  { u: 0.17, v: -0.08, scale: 0.28, height: 7, ember: false },
  { u: -0.04, v: 0.18, scale: 0.28, height: 5, ember: true },
  { u: 0.2, v: 0.2, scale: 0.18, height: 4, ember: false },
]

// 덩이마다 윗면 가운데 화면 자리, 밑 높이 z가 없으면 바닥 기준
export const lumpTops = <T extends { u: number; v: number; z?: number; height: number }>(
  x: number,
  y: number,
  lumps: T[],
) => lumps.map((l) => ({ ...l, top: isoPoint(x, y, l.u, l.v, (l.z ?? 0) + l.height) }))

// 재로 부서지는 숯 벽, 숯이 옅어진 자리에 섰다 가라앉는 재 덩이와 자국으로 줄어드는 번진 재
export const wallCrumble = (crumble: number) => ({
  pile: 1 - smooth(clamp01(crumble / 0.6)),
  lumps: smooth(clamp01(crumble / 0.3)) * (1 - smooth(clamp01((crumble - 0.55) / 0.45))),
  sink: smooth(clamp01((crumble - 0.3) / 0.7)),
  smudge: 0.72 - 0.22 * smooth(crumble),
})

// 재 자국 칸 폭 배수
export const ASH_MARK = 0.5

// 숯 다리가 부서지며 떨어지는 조각 셋
const BRIDGE_PIECES = [
  { u: -0.22, v: -0.2, scale: 0.42, height: 8, ember: true },
  { u: 0.2, v: -0.06, scale: 0.38, height: 7, ember: false },
  { u: -0.08, v: 0.24, scale: 0.32, height: 6, ember: false },
]

// 장작 판이 옅어지는 사이 12px 내려앉았다가 더 떨어지며 사라지는 조각
export const bridgePieces = (crumble: number) => {
  const fall = clamp01((crumble - 0.4) / 0.6)
  return {
    slab: 1 - smooth(clamp01(crumble / 0.5)),
    pieces: BRIDGE_PIECES,
    drop: 12 * smooth(clamp01(crumble / 0.4)) + 36 * fall * fall,
    opacity: crumble <= 0 ? 0 : smooth(clamp01(crumble / 0.2)) * (1 - fall * fall),
  }
}

// 숯 다리 장작 둘의 v 범위
const LOGS = [
  [-0.5, -0.02],
  [0.02, 0.5],
]

// 장작마다 몸통, 윗결, 숯불빛 두 겹, bright는 체크 칸마다 엇갈리는 밝은 윗결
export const logQuads = (x: number, y: number, parity: boolean) =>
  LOGS.map(([v0, v1], i) => {
    const mid = (v0 + v1) / 2
    return {
      body: uvQuad(x, y, -0.5, 0.5, v0 + 0.01, v1 - 0.01),
      grain: uvQuad(x, y, -0.5, 0.5, mid - 0.09, mid + 0.04),
      hot: uvQuad(x, y, -0.42, 0.42, mid - 0.11, mid + 0.06),
      core: uvQuad(x, y, -0.3, 0.3, mid - 0.07, mid + 0.02),
      bright: (i + (parity ? 1 : 0)) % 2 === 1,
    }
  })

// 불티가 나는 칸 윗면 기준 자리, 숯 칸 안
export const EMBER_SPOTS = [
  [-0.14, -0.08],
  [0.12, -0.16],
  [0.04, 0.12],
  [-0.22, 0.14],
  [0.24, 0.04],
  [-0.04, -0.26],
  [0.2, -0.3],
]

// 불티 하나가 한 바퀴 cycle ms 안에 top px 오르며 옅어지는 키프레임
export const emberKeyframes = (top: number, cycle: number): Keyframe[] => {
  const at = (ms: number) => Math.min(1, ms / cycle)
  const end = { opacity: 0, transform: `translate(0px, -${top}px)` }
  return [
    { offset: 0, opacity: 0, transform: 'translate(0px, 0px)' },
    { offset: at(120), opacity: 1, transform: `translate(0px, -${top * 0.08}px)` },
    { offset: at(EMBER_LIFE), opacity: 0.4, transform: `translate(0px, -${top}px)` },
    { offset: at(EMBER_LIFE + 100), ...end },
    { offset: 1, ...end },
  ]
}
