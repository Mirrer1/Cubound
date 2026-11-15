import { TILE } from '@/game/iso'

export interface NightLight {
  x: number
  y: number
  h: number // 빛이 선 높이
  wide: boolean // 화로 불 붙은 큐브의 한 칸 더 넓은 빛
  weight: number // 켜지고 꺼지는 빛의 세기 0~1
}

export const NIGHT_PRE = 0.22
export const VEIL_STEPS = 8

// 빛 칸 바깥 거리마다의 어둠, 빛 칸 쪽 변은 두 칸 평균
const KNOTS: Record<'normal' | 'wide', [number, number][]> = {
  normal: [
    [0.5, 0.475],
    [1, 0.75],
    [1.5, 1],
  ],
  wide: [
    [0.5, 0.4],
    [1, 0.6],
    [2, 0.9],
    [2.5, 1],
  ],
}

const smooth = (s: number) => s * s * (3 - 2 * s)

// 빛 가운데에서 체비셰프 거리 d칸에 남는 어둠
export const lightVeil = (d: number, wide: boolean) => {
  const knots = KNOTS[wide ? 'wide' : 'normal']
  if (d <= 0.5) return 0.2
  const i = knots.findIndex(([at]) => d <= at)
  if (i < 0) return 1
  const [d0, v0] = knots[i - 1]
  const [d1, v1] = knots[i]
  return v0 + (v1 - v0) * smooth((d - d0) / (d1 - d0))
}

const veilAt = (lights: NightLight[], px: number, py: number) =>
  lights.reduce((veil, { x, y, wide, weight }) => {
    const d = Math.max(Math.abs(px - x), Math.abs(py - y))
    return Math.min(veil, 1 - weight * (1 - lightVeil(d, wide)))
  }, 1)

const REACH = 3
const quantize = (v: number) => Math.round(v * 50) / 50

// 칸 하나의 8x8 어둠, 행 먼저, 고르면 값 하나
// 판 끝 변에서 안쪽으로 빛이 사그라지는 칸 비율
const EDGE_FADE = 0.5

export interface VeilEdges {
  left: boolean // x가 작은 쪽 이웃 칸이 없거나 구덩이
  right: boolean
  back: boolean // y가 작은 쪽
  front: boolean
}

// 판 끝에 닿는 변 쪽으로 빛을 어둠 색까지 서서히 줄인 8x8 어둠
export const edgeFade = (values: number[], edges: VeilEdges): number[] => {
  const open = [edges.left, edges.right, edges.back, edges.front]
  if (!open.some(Boolean) || values.every((v) => v === 1)) return values
  const n = VEIL_STEPS
  const grid = values.length === 1 ? Array<number>(n * n).fill(values[0]) : values
  const faded = grid.map((value, k) => {
    const u = -0.5 + ((k % n) + 0.5) / n
    const v = -0.5 + (Math.floor(k / n) + 0.5) / n
    const fade = [u + 0.5, 0.5 - u, v + 0.5, 0.5 - v]
      .filter((_, i) => open[i])
      .map((d) => 1 - smooth(Math.min(1, d / EDGE_FADE)))
    return quantize(value + (1 - value) * Math.max(...fade))
  })
  return faded.every((v) => v === faded[0]) ? [faded[0]] : faded
}

export const cellVeil = (lights: NightLight[], x: number, y: number): number[] => {
  const near = lights.filter((l) => Math.max(Math.abs(l.x - x), Math.abs(l.y - y)) <= REACH)
  if (near.length === 0) return [1]
  const step = 1 / VEIL_STEPS
  const values = Array.from({ length: VEIL_STEPS * VEIL_STEPS }, (_, k) =>
    quantize(
      veilAt(
        near,
        x - 0.5 + ((k % VEIL_STEPS) + 0.5) * step,
        y - 0.5 + (Math.floor(k / VEIL_STEPS) + 0.5) * step,
      ),
    ),
  )
  return values.every((v) => v === values[0]) ? [values[0]] : values
}

const HW = TILE.width / 2
const HH = TILE.height / 2
// 옆 칸과 겹쳐 바닥 테두리를 덮는 칸 둘레 비율, 고른 칸은 px
const EDGE = 0.006
const SEAM_PX = 1.5
// 판 끝 변을 넘겨 덮는 칸 비율, 약 1.5px
const OPEN_EDGE = 0.06

// 칸 윗면 위 (u, v) 자리의 화면 좌표, u와 v는 -0.5~0.5
const onTop = (cx: number, cy: number, u: number, v: number) =>
  `${cx + (u - v) * HW},${cy + (u + v) * HH}`

export interface VeilShape {
  points: string
  opacity: number
}

export interface VeilOpen {
  left: boolean // 왼쪽 앞 칸이 낮거나 없음
  right: boolean // 오른쪽 앞 칸이 낮거나 없음
  backLeft: boolean // 왼쪽 뒤 칸이 없거나 구덩이
  backRight: boolean // 오른쪽 뒤 칸이 없거나 구덩이
}

export interface VeilBlock {
  x: number // 칸 윗면 가운데에서 블록 밑면 가운데까지 px
  y: number
  width: number
  height: number // 옆면 높이 px
}

// 블록 둘레 여섯 점, 칸 윗면 막과 같은 감김 방향
const blockPoints = (cx: number, cy: number, block: VeilBlock) => {
  const [hw, q] = [block.width / 2, block.width / 4]
  const [x, y] = [cx + block.x, cy + block.y]
  const top = y - block.height
  return [
    [x, top - q],
    [x + hw, top],
    [x + hw, y],
    [x, y + q],
    [x - hw, y],
    [x - hw, top],
  ]
}

// 물건 블록들의 합친 모양 경로, 겹친 곳도 한 번만 칠함
export const coverPath = (cx: number, cy: number, blocks: VeilBlock[]) =>
  blocks
    .map(
      (block) =>
        `M${blockPoints(cx, cy, block)
          .map(([x, y]) => `${x},${y}`)
          .join(' ')}Z`,
    )
    .join(' ')

// 물건 블록들을 감싸는 볼록 둘레, 바닥 막을 잘라 내는 구멍
export const coverOutline = (cx: number, cy: number, blocks: VeilBlock[]) => {
  const points = blocks.flatMap((block) => blockPoints(cx, cy, block))
  const sorted = [...points].sort(([ax, ay], [bx, by]) => ax - bx || ay - by)
  const cross = (o: number[], a: number[], b: number[]) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
  const half = (list: number[][]) =>
    list.reduce<number[][]>((hull, p) => {
      while (hull.length >= 2 && cross(hull[hull.length - 2], hull[hull.length - 1], p) <= 0)
        hull.pop()
      return [...hull, p]
    }, [])
  const lower = half(sorted)
  const upper = half([...sorted].reverse())
  return [...lower.slice(0, -1), ...upper.slice(0, -1)].map(([x, y]) => `${x},${y}`).join(' ')
}

// 물건 덮개 세기, 빛 지도 가운데 값
export const veilMiddle = (values: number[]) =>
  values.length === 1 ? values[0] : values[(VEIL_STEPS / 2) * (VEIL_STEPS + 1)]

// 판 테두리 받침 띠, 빛과 상관없이 까맣게
// 앞이 트인 변은 윗면으로 살짝 올려 테두리 틈을 덮음
const lipShape = (cx: number, cy: number, depth: number, open: VeilOpen): VeilShape => {
  const [s, d0] = [SEAM_PX, Math.max(0, depth - TILE.lip)]
  const up = (on: boolean) => (on && d0 === 0 ? s : 0)
  const points = [
    `${cx - HW - s},${cy + d0 - up(open.left)}`,
    `${cx},${cy + HH + d0 - up(open.left || open.right)}`,
    `${cx + HW + s},${cy + d0 - up(open.right)}`,
    `${cx + HW + s},${cy + depth}`,
    `${cx},${cy + HH + depth + s}`,
    `${cx - HW - s},${cy + depth}`,
  ].join(' ')
  return { points, opacity: 1 }
}

// 칸 윗면과 앞 두 옆면 어둠 조각, 옆면 맨 아래 받침 띠는 까맣게
export const veilShapes = (
  cx: number,
  cy: number,
  depth: number,
  values: number[],
  sideValues = values,
  open: VeilOpen = { left: false, right: false, backLeft: false, backRight: false },
): VeilShape[] => {
  const side = depth - TILE.lip
  const lip = lipShape(cx, cy, depth, open)
  if (values.length === 1 && sideValues === values) {
    const s = SEAM_PX
    const d = Math.max(0, side)
    const points = [
      `${cx},${cy - HH - s}`,
      `${cx + HW + s},${cy}`,
      `${cx + HW + s},${cy + d}`,
      `${cx},${cy + HH + d}`,
      `${cx - HW - s},${cy + d}`,
      `${cx - HW - s},${cy}`,
    ].join(' ')
    return [{ points, opacity: values[0] }, lip]
  }

  const n = VEIL_STEPS
  const at = (i: number) => -0.5 + i / n
  const s = SEAM_PX
  const flat =
    values.length === 1
      ? [
          {
            points: [
              `${cx},${cy - HH - s}`,
              `${cx + HW + s},${cy}`,
              `${cx},${cy + HH + s}`,
              `${cx - HW - s},${cy}`,
            ].join(' '),
            opacity: values[0],
          },
        ]
      : null
  const sideGrid = sideValues.length === 1 ? Array<number>(n * n).fill(sideValues[0]) : sideValues
  // 줄마다 같은 값끼리 묶은 조각, across면 세로 줄
  const runs = (across: boolean) =>
    Array.from({ length: n }, (_, j) => j).flatMap((j) => {
      const value = (i: number) => (across ? values[i * n + j] : values[j * n + i])
      const shapes: VeilShape[] = []
      let start = 0
      for (let i = 1; i <= n; i++) {
        if (i < n && value(i) === value(start)) continue
        // u 축은 왼쪽 뒤와 오른쪽 앞 변, v 축은 오른쪽 뒤와 왼쪽 앞 변
        const out = (k: number, alongU: boolean) => {
          const [back, front] = alongU ? [open.backLeft, open.right] : [open.backRight, open.left]
          if (k !== 0 && k !== n) return 0
          return (k === 0 ? back : front) ? OPEN_EDGE : EDGE
        }
        const [a0, a1, b0, b1] = [
          at(start) - out(start, !across),
          at(i) + out(i, !across),
          at(j) - out(j, across),
          at(j + 1) + out(j + 1, across),
        ]
        const corner = (a: number, b: number) =>
          across ? onTop(cx, cy, b, a) : onTop(cx, cy, a, b)
        const points = [corner(a0, b0), corner(a1, b0), corner(a1, b1), corner(a0, b1)].join(' ')
        shapes.push({ points, opacity: value(start) })
        start = i
      }
      return shapes
    })
  const [rows, columns] = flat ? [flat, flat] : [runs(false), runs(true)]
  const top = rows.length <= columns.length ? rows : columns
  // 앞 두 옆면, 같은 값끼리 묶은 띠
  const strips = (left: boolean) => {
    const value = (k: number) => (left ? sideGrid[(n - 1) * n + k] : sideGrid[k * n + n - 1])
    const edge = (k: number) => (left ? onTop(cx, cy, at(k), 0.5) : onTop(cx, cy, 0.5, at(k)))
    const lift = (left ? open.left : open.right) ? SEAM_PX : 0
    const down = (pt: string, by: number) => {
      const [x, y] = pt.split(',').map(Number)
      return `${x},${y + by}`
    }
    const shapes: VeilShape[] = []
    let start = 0
    for (let k = 1; k <= n; k++) {
      if (k < n && value(k) === value(start)) continue
      const [p, q] = [edge(start), edge(k)]
      const corners = [down(p, -lift), down(q, -lift), down(q, side), down(p, side)]
      shapes.push({ points: corners.join(' '), opacity: value(start) })
      start = k
    }
    return shapes
  }
  const sides = side > 0 ? [...strips(true), ...strips(false)] : []
  return [...top, ...sides, lip]
}
