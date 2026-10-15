import { TILE } from '@/game/iso'
import type { Direction } from '@/game/types'

export type Vec = [number, number, number]
type Face = 'top' | 'left' | 'right'

// 한 층 높이와 같은 큐브 한 변
export const CUBE = TILE.layer / TILE.height

const H = CUBE / 2
export const FACES: { normal: Vec; corners: Vec[] }[] = [
  {
    normal: [0, 0, 1],
    corners: [
      [-H, -H, H],
      [H, -H, H],
      [H, H, H],
      [-H, H, H],
    ],
  },
  {
    normal: [0, 0, -1],
    corners: [
      [-H, -H, -H],
      [H, -H, -H],
      [H, H, -H],
      [-H, H, -H],
    ],
  },
  {
    normal: [1, 0, 0],
    corners: [
      [H, -H, -H],
      [H, H, -H],
      [H, H, H],
      [H, -H, H],
    ],
  },
  {
    normal: [-1, 0, 0],
    corners: [
      [-H, -H, -H],
      [-H, H, -H],
      [-H, H, H],
      [-H, -H, H],
    ],
  },
  {
    normal: [0, 1, 0],
    corners: [
      [-H, H, -H],
      [H, H, -H],
      [H, H, H],
      [-H, H, H],
    ],
  },
  {
    normal: [0, -1, 0],
    corners: [
      [-H, -H, -H],
      [H, -H, -H],
      [H, -H, H],
      [-H, -H, H],
    ],
  },
]

const round = (v: number) => Math.round(v * 100) / 100

// 굴러가는 방향으로 윗면이 넘어가는 회전
export const rotate = ([x, y, z]: Vec, direction: Direction, angle: number): Vec => {
  const a = direction === 'right' || direction === 'down' ? angle : -angle
  const cos = Math.cos(a)
  const sin = Math.sin(a)

  return direction === 'right' || direction === 'left'
    ? [x * cos + z * sin, y, -x * sin + z * cos]
    : [x, y * cos + z * sin, -y * sin + z * cos]
}

export interface CubeFace {
  face: Face
  points: string
}

const project = ([x, y, z]: Vec) => [
  ((x - y) * TILE.width) / 2,
  ((x + y) * TILE.height) / 2 - z * TILE.height,
]

// 큐브 윗면 가운데에서 칸 단위 (u, v)만큼 가고 z px 선 점이 큐브와 함께 기울 때 화면에서 옮겨 가는 거리
export type TopTilt = (u: number, v: number, z: number) => { x: number; y: number }

export const tiltOnTop =
  (direction: Direction, angle: number): TopTilt =>
  (u, v, z) => {
    const lift = H * (Math.abs(Math.cos(angle)) + Math.abs(Math.sin(angle)))
    const local: Vec = [u, v, H + z / TILE.height]
    const [rx, ry, rz] = rotate(local, direction, angle)
    const [tx, ty] = project([rx, ry, rz + lift])
    const [fx, fy] = project([u, v, local[2] + H])
    return { x: tx - fx + 0, y: ty - fy + 0 }
  }

// 다리 막대와 한 몸으로 흔들리는 축, x, y는 축이 지나는 칸 좌표, axis는 축 방향 라디안, z는 축 높이 px
export interface CubeRoll {
  x: number
  y: number
  axis: number
  z: number
  angle: number
  dip?: number // 다리가 큐브 무게로 가라앉은 px
}

// 축을 기준으로 돈 칸 좌표와 높이, 높이는 칸 높이 단위
const rollAbout = (roll: CubeRoll, [wx, wy, wz]: Vec): Vec => {
  const ca = Math.cos(roll.axis)
  const sa = Math.sin(roll.axis)
  const u = (wx - roll.x) * ca + (wy - roll.y) * sa
  const w = -(wx - roll.x) * sa + (wy - roll.y) * ca
  const h = wz - roll.z / TILE.height
  const c = Math.cos(roll.angle)
  const s = Math.sin(roll.angle)
  const w2 = w * c - h * s
  const h2 = w * s + h * c
  return [
    roll.x + u * ca - w2 * sa,
    roll.y + u * sa + w2 * ca,
    (roll.z - (roll.dip ?? 0)) / TILE.height + h2,
  ]
}

// (x, y)는 칸 좌표, level은 바닥 높이, angle은 라디안
export const rollingCubeFaces = (
  x: number,
  y: number,
  level: number,
  direction: Direction,
  angle: number,
  roll: CubeRoll | null = null,
): CubeFace[] => {
  const lift = H * (Math.abs(Math.cos(angle)) + Math.abs(Math.sin(angle)))
  const toScreen = ([vx, vy, vz]: Vec) => {
    const at: Vec = [x + vx, y + vy, level * CUBE + lift + vz]
    const [wx, wy, wz] = roll ? rollAbout(roll, at) : at
    return `${round(((wx - wy) * TILE.width) / 2)},${round(((wx + wy) * TILE.height) / 2 - wz * TILE.height)}`
  }

  return FACES.map(({ normal, corners }) => ({ n: rotate(normal, direction, angle), corners }))
    .filter(({ n }) => n[0] + n[1] + n[2] > 1e-6)
    .map(({ n, corners }) => ({
      face: (n[2] >= n[0] && n[2] >= n[1] ? 'top' : n[0] >= n[1] ? 'right' : 'left') as Face,
      points: corners.map((c) => toScreen(rotate(c, direction, angle))).join(' '),
    }))
}
