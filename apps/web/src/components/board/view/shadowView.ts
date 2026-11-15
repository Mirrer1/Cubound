import { TILE } from '@/game/iso'
import type { Point } from '@/game/types'

// 다리 폭 0.8칸, 두께 px, 아래 번짐 세 겹의 진하기와 한 겹 높이 px
export const BRIDGE = { half: 0.4, thick: 4, glow: [0.08, 0.06, 0.025], band: 9 }

const HW = TILE.width / 2
const HH = TILE.height / 2

const at = (cx: number, cy: number, u: number, v: number) =>
  `${cx + (u - v) * HW},${cy + (u + v) * HH}`

// 다리가 이어진 축, 가로로 이어진 칸 수가 세로보다 적지 않으면 x
export const bridgeAxis = (shadow: string[], heights: number[][], { x, y }: Point) => {
  const joined = (p: Point) =>
    (shadow[p.y]?.[p.x] ?? '.') !== '.' || (heights[p.y]?.[p.x] ?? -1) >= 0
  const along = (dx: number, dy: number) =>
    Number(joined({ x: x + dx, y: y + dy })) + Number(joined({ x: x - dx, y: y - dy }))
  return along(1, 0) >= along(0, 1) ? 'x' : 'y'
}

const shift = (points: string, dy: number) =>
  points
    .split(' ')
    .map((p) => {
      const [x, y] = p.split(',').map(Number)
      return `${x},${y + dy}`
    })
    .join(' ')

// 칸 윗면 중심 (cx, cy)의 다리 한 칸, 축 방향으로 칸 끝까지 이어 붙은 한 판
export const bridgeFaces = (cx: number, cy: number, axis: 'x' | 'y') => {
  const w = BRIDGE.half
  const [u0, u1, v0, v1] = axis === 'x' ? [-0.5, 0.5, -w, w] : [-w, w, -0.5, 0.5]
  const top = [at(cx, cy, u0, v0), at(cx, cy, u1, v0), at(cx, cy, u1, v1), at(cx, cy, u0, v1)].join(
    ' ',
  )
  // 화면 앞쪽 긴 변, 가로 다리는 v 끝, 세로 다리는 u 끝
  const edge =
    axis === 'x'
      ? [at(cx, cy, u0, v1), at(cx, cy, u1, v1)]
      : [at(cx, cy, u1, v0), at(cx, cy, u1, v1)]
  const side = [edge[0], edge[1], shift(edge[1], BRIDGE.thick), shift(edge[0], BRIDGE.thick)].join(
    ' ',
  )
  const glow = BRIDGE.glow.map((opacity, i) => ({
    opacity,
    points: shift(side, BRIDGE.thick + i * BRIDGE.band),
  }))
  return { top, side, glow }
}

// 윗면 밝기 일렁임 3초 한 바퀴, 0.26에서 0.3 사이
export const SHIMMER_LOOP: Keyframe[] = [{ opacity: 0.85 }, { opacity: 1 }, { opacity: 0.85 }]
