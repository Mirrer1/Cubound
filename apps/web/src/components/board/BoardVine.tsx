import type { VineKind } from './frame'
import { darken } from './shade'
import { isoDelta } from '@/game/iso'
import type { Direction } from '@/game/types'

interface Shape {
  points: string
  fill: string
}

interface Faces {
  top: string
  left: string
  right: string
}

// 줄기 반폭과 높이. 길이는 칸 단위이고 높이는 px이다
const STEM_HALF = 0.045
const STEM_RISE = 2
const LEAF_RISE = 0.5
// 칸 반쪽마다 잎 둘이 줄기 양옆으로 번갈아 붙는다. 앞 값은 줄기를 따라 잰 자리다
const LEAVES = {
  enter: [
    [-0.38, 1],
    [-0.14, -1],
  ],
  leave: [
    [0.1, 1],
    [0.34, -1],
  ],
}
// 싹은 구덩이 바닥의 뒤쪽 모서리에 선다. 다음 자랄 칸의 싹이 더 크다
const SPROUT_SPOT = -0.25
const SPROUT = { next: 24, future: 14 }

const STEM: Faces = {
  top: 'var(--color-vine-stem-top)',
  left: 'var(--color-vine-stem-left)',
  right: 'var(--color-vine-stem-right)',
}
const NODE: Faces = { ...STEM, top: 'var(--color-vine-node)' }
const BUD: Faces = {
  top: 'var(--color-vine-bud)',
  left: 'var(--color-vine-bud-left)',
  right: 'var(--color-vine-bud-right)',
}
const SPROUT_BASE: Faces = {
  top: 'var(--color-vine-sprout)',
  left: darken('vine-sprout', 18),
  right: darken('vine-sprout', 8),
}

const horizontal = (d: Direction) => d === 'left' || d === 'right'

// 줄기를 따라 잰 길이와 가로지른 폭을 칸 좌표로 바꾼다. 오른쪽과 아래로 자라면 부호가 그대로다
const toCell = (d: Direction, along: number, across: number): [number, number] => {
  const a = d === 'right' || d === 'down' ? along : -along
  return horizontal(d) ? [a, across] : [across, a]
}

const at = (x: number, y: number, u: number, v: number, z: number) => {
  const p = isoDelta(u, v)
  return `${x + p.x},${y + p.y - z}`
}

// 줄기 좌표로 잰 직육면체. z는 윗면 높이이고 depth만큼 아래로 옆면이 내려온다
const box = (
  x: number,
  y: number,
  d: Direction,
  [a0, a1]: [number, number],
  [b0, b1]: [number, number],
  z: number,
  depth: number,
  faces: Faces,
): Shape[] => {
  const [p0, q0] = toCell(d, a0, b0)
  const [p1, q1] = toCell(d, a1, b1)
  const [u0, u1] = [Math.min(p0, p1), Math.max(p0, p1)]
  const [v0, v1] = [Math.min(q0, q1), Math.max(q0, q1)]
  const low = z - depth
  return [
    {
      points: [
        at(x, y, u1, v0, z),
        at(x, y, u1, v1, z),
        at(x, y, u1, v1, low),
        at(x, y, u1, v0, low),
      ].join(' '),
      fill: faces.right,
    },
    {
      points: [
        at(x, y, u0, v1, z),
        at(x, y, u1, v1, z),
        at(x, y, u1, v1, low),
        at(x, y, u0, v1, low),
      ].join(' '),
      fill: faces.left,
    },
    {
      points: [
        at(x, y, u0, v0, z),
        at(x, y, u1, v0, z),
        at(x, y, u1, v1, z),
        at(x, y, u0, v1, z),
      ].join(' '),
      fill: faces.top,
    },
  ]
}

// 윗면에 눕힌 연 모양 잎. (along, across)에서 (da, db) 쪽으로 뻗는다
const leaf = (
  x: number,
  y: number,
  d: Direction,
  [along, across]: [number, number],
  [da, db]: [number, number],
  z: number,
  width: number,
  fill: string,
): Shape => {
  const [u, v] = toCell(d, along, across)
  const [du, dv] = toCell(d, da, db)
  const length = Math.hypot(du, dv)
  const [nu, nv] = [(-dv / length) * width, (du / length) * width]
  const points = [
    [u, v],
    [u + du * 0.45 + nu, v + dv * 0.45 + nv],
    [u + du, v + dv],
    [u + du * 0.45 - nu, v + dv * 0.45 - nv],
  ]
  return { points: points.map(([pu, pv]) => at(x, y, pu, pv, z)).join(' '), fill }
}

const stem = (x: number, y: number, d: Direction, span: [number, number]) =>
  box(x, y, d, span, [-STEM_HALF, STEM_HALF], STEM_RISE, STEM_RISE, STEM)

const node = (x: number, y: number, d: Direction, along: number) => {
  const half = STEM_HALF + 0.025
  const rise = STEM_RISE + 1
  return box(x, y, d, [along - 0.035, along + 0.035], [-half, half], rise, rise, NODE)
}

const leaves = (x: number, y: number, d: Direction, half: 'enter' | 'leave', fill: string) =>
  LEAVES[half].map(([along, side]) =>
    leaf(x, y, d, [along, side * STEM_HALF], [0.08, side * 0.17], LEAF_RISE, 0.075, fill),
  )

// 구덩이 바닥에 선 싹. 밑동 위에 대를 세우고 끝에 잎 둘을 단다
const sprout = (x: number, y: number, height: number): Shape[] => {
  const reach = height === SPROUT.next ? 0.24 : 0.22
  return [
    ...box(x, y, 'right', [-0.09, 0.09], [-0.09, 0.09], 2, 2, SPROUT_BASE),
    ...box(x, y, 'right', [-0.04, 0.04], [-0.04, 0.04], height, height - 2, STEM),
    leaf(x, y, 'right', [0, 0], [reach, -reach * 0.35], height, 0.11, 'var(--color-vine-sprout)'),
    leaf(x, y, 'right', [0, 0], [-reach * 0.35, reach], height, 0.11, 'var(--color-vine-sprout)'),
  ]
}

const grownShapes = (
  x: number,
  y: number,
  enter: Direction,
  leave: Direction,
  hard: boolean,
  knot: boolean,
) => {
  const fill = hard ? 'var(--color-vine-hard-leaf)' : 'var(--color-vine-leaf)'
  const out = leaves(x, y, leave, 'leave', fill)
  return [
    ...leaves(x, y, enter, 'enter', fill),
    ...(knot ? out.slice(0, 1) : out),
    ...stem(x, y, enter, [-0.5, STEM_HALF]),
    ...node(x, y, enter, -0.26),
    // 굳은 끝 칸은 줄기가 짧게 끝나고 봉오리로 닫힌다
    ...(knot
      ? [
          ...stem(x, y, leave, [-STEM_HALF, 0.14]),
          ...box(x, y, leave, [0.12, 0.42], [-0.13, 0.13], 8, 8, BUD),
        ]
      : [...stem(x, y, leave, [-STEM_HALF, 0.5]), ...node(x, y, leave, 0.22)]),
  ]
}

// 뿌리는 칸 가운데에서 자랄 쪽 가장자리로 나가는 밑동이다
const rootShapes = (x: number, y: number, leave: Direction) => [
  leaf(x, y, leave, [0.3, -STEM_HALF], [0.06, -0.18], LEAF_RISE, 0.1, 'var(--color-vine-leaf)'),
  ...stem(x, y, leave, [0.2, 0.5]),
  ...box(x, y, leave, [0.12, 0.3], [-0.12, 0.12], 6, 6, STEM),
]

// 다음 자랄 칸은 큰 싹이 서고 앞 칸 줄기 끝이 혀처럼 이 칸 가장자리로 넘어온다
const nextShapes = (x: number, y: number, floor: number, enter: Direction) => {
  const spot = isoDelta(SPROUT_SPOT, SPROUT_SPOT)
  return [
    ...sprout(x + spot.x, y + floor + spot.y, SPROUT.next),
    ...stem(x, y, enter, [-0.5, -0.3]),
    leaf(x, y, enter, [-0.42, STEM_HALF], [0.08, 0.16], LEAF_RISE, 0.1, 'var(--color-vine-sprout)'),
  ]
}

interface BoardVineProps {
  x: number
  y: number
  floor: number // 구덩이 바닥이 칸 윗면보다 아래인 거리
  kind: VineKind
  enter: Direction | null
  leave: Direction | null
  hard: boolean
  knot: boolean
}

const BoardVine = ({ x, y, floor, kind, enter, leave, hard, knot }: BoardVineProps) => {
  const spot = isoDelta(SPROUT_SPOT, SPROUT_SPOT)
  const shapes =
    kind === 'grown' && enter && leave
      ? grownShapes(x, y, enter, leave, hard, knot)
      : kind === 'root' && leave
        ? rootShapes(x, y, leave)
        : kind === 'next' && enter
          ? nextShapes(x, y, floor, enter)
          : kind === 'future'
            ? sprout(x + spot.x, y + floor + spot.y, SPROUT.future)
            : []

  return (
    <g>
      {shapes.map((shape, i) => (
        <polygon key={i} points={shape.points} style={{ fill: shape.fill }} />
      ))}
    </g>
  )
}

export default BoardVine
