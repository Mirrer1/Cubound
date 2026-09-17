import { TILE } from '@/game/iso'
import type { Direction } from '@/game/types'

type Vec = [number, number, number]
type Face = 'top' | 'left' | 'right'

// 큐브 한 변과 한 층 높이는 같은 길이다
export const CUBE = TILE.layer / TILE.height

const H = CUBE / 2
const FACES: { normal: Vec; corners: Vec[] }[] = [
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

// 굴러가는 방향으로 윗면이 넘어가도록 회전한다
const rotate = ([x, y, z]: Vec, direction: Direction, angle: number): Vec => {
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

// (x, y)는 칸 좌표, level은 바닥 높이, angle은 라디안
export const rollingCubeFaces = (
  x: number,
  y: number,
  level: number,
  direction: Direction,
  angle: number,
): CubeFace[] => {
  const lift = H * (Math.abs(Math.cos(angle)) + Math.abs(Math.sin(angle)))
  const toScreen = ([vx, vy, vz]: Vec) => {
    const wx = x + vx
    const wy = y + vy
    const wz = level * CUBE + lift + vz
    return `${round(((wx - wy) * TILE.width) / 2)},${round(((wx + wy) * TILE.height) / 2 - wz * TILE.height)}`
  }

  return FACES.map(({ normal, corners }) => ({ n: rotate(normal, direction, angle), corners }))
    .filter(({ n }) => n[0] + n[1] + n[2] > 1e-6)
    .map(({ n, corners }) => ({
      face: (n[2] >= n[0] && n[2] >= n[1] ? 'top' : n[0] >= n[1] ? 'right' : 'left') as Face,
      points: corners.map((c) => toScreen(rotate(c, direction, angle))).join(' '),
    }))
}
