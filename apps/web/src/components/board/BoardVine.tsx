import { VINE_SPROUT, VINE_TONGUE, type VineKind } from './frame'
import { blend, darken } from './view'
import { isoDelta } from '@/game/iso'
import type { Direction } from '@/game/types'

interface Shape {
  points: string
  fill: string
  key?: string
}

// 자라는 동안 돋고 사라지는 도형에 붙이는 이름. 순번 key가 밀려 다른 도형의 색을 다시 쓰지 않게 한다
const named = (name: string, shapes: Shape[]) =>
  shapes.map((shape, i) => ({ ...shape, key: `${name}${i}` }))

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
const LEAVES: Record<'enter' | 'leave', number[][]> = {
  enter: [
    [-0.38, 1],
    [-0.14, -1],
  ],
  leave: [
    [0.1, 1],
    [0.34, -1],
  ],
}
const NODES = { enter: -0.26, leave: 0.22 }
// 굳은 끝 칸의 봉오리. 줄기는 BUD_STEM에서 끝난다
const BUD = { along: 0.27, half: 0.15, across: 0.13, height: 8 }
const BUD_STEM = 0.14
// 자랄 때 잎과 마디는 줄기 끝이 이만큼 더 간 뒤에 다 돋는다. 칸 단위다
const VINE_LAG = { leaf: 0.16, node: 0.08 }
// 싹은 구덩이 바닥의 뒤쪽 모서리에 선다
const SPROUT_SPOT = -0.25

const STEM: Faces = {
  top: 'var(--color-vine-stem-top)',
  left: 'var(--color-vine-stem-left)',
  right: 'var(--color-vine-stem-right)',
}
const NODE: Faces = { ...STEM, top: 'var(--color-vine-node)' }
const BUD_FACES: Faces = {
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

const stem = (x: number, y: number, d: Direction, [a0, a1]: [number, number]) =>
  a1 > a0 ? box(x, y, d, [a0, a1], [-STEM_HALF, STEM_HALF], STEM_RISE, STEM_RISE, STEM) : []

// 마디는 줄기 끝이 지나간 뒤 scale만큼 돋는다
const node = (x: number, y: number, d: Direction, along: number, scale: number) => {
  if (scale <= 0) return []
  const half = (STEM_HALF + 0.025) * scale
  const long = 0.035 * scale
  const rise = STEM_RISE + 1
  return box(x, y, d, [along - long, along + long], [-half, half], rise, rise, NODE)
}

// 잎은 붙는 자리를 두고 scale만큼 뻗는다
const leafAt = (
  x: number,
  y: number,
  d: Direction,
  [along, side]: number[],
  scale: number,
  fill: string,
) =>
  scale <= 0
    ? []
    : [
        leaf(
          x,
          y,
          d,
          [along, side * STEM_HALF],
          [0.08 * scale, side * 0.17 * scale],
          LEAF_RISE,
          0.075 * scale,
          fill,
        ),
      ]

// 줄기 끝이 칸 입구에서 잰 거리를 지나간 뒤 돋는 정도. 자랄 때만 1보다 작다
const sprung = (tip: number, distance: number, span: number) => clamp01((tip - distance) / span)

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

// 칸 입구에서 가운데를 지나 출구까지 잰 거리. 줄기를 따라 잰 자리 along을 이 거리로 바꾼다
const enterDistance = (along: number) => 0.5 + along
const leaveDistance = (along: number) => 0.5 + along

const grownShapes = (
  x: number,
  y: number,
  enter: Direction,
  leave: Direction,
  growth: number,
  hard: number,
  knot: number,
) => {
  const fill =
    hard <= 0
      ? 'var(--color-vine-leaf)'
      : hard >= 1
        ? 'var(--color-vine-hard-leaf)'
        : blend('var(--color-vine-leaf)', 'var(--color-vine-hard-leaf)', hard)
  // 줄기 끝은 혀 끝에서 출발해 칸 출구까지 간다
  const tip = VINE_TONGUE + (1 - VINE_TONGUE) * growth
  const grownAt = (distance: number) => (growth >= 1 ? 1 : sprung(tip, distance, VINE_LAG.leaf))
  const nodeAt = (distance: number) => (growth >= 1 ? 1 : sprung(tip, distance, VINE_LAG.node))
  const end = lerp(0.5, BUD_STEM, knot)
  return [
    ...LEAVES.enter.flatMap((spot, i) =>
      named(`in-leaf${i}-`, leafAt(x, y, enter, spot, grownAt(enterDistance(spot[0])), fill)),
    ),
    ...LEAVES.leave.flatMap((spot, i) =>
      named(
        `out-leaf${i}-`,
        leafAt(x, y, leave, spot, grownAt(leaveDistance(spot[0])) * (i === 0 ? 1 : 1 - knot), fill),
      ),
    ),
    ...named('in-stem', stem(x, y, enter, [-0.5, Math.min(tip, 0.5 + STEM_HALF) - 0.5])),
    ...named('in-node', node(x, y, enter, NODES.enter, nodeAt(enterDistance(NODES.enter)))),
    ...named(
      'out-stem',
      tip > 0.5 - STEM_HALF ? stem(x, y, leave, [-STEM_HALF, Math.min(tip - 0.5, end)]) : [],
    ),
    ...named(
      'out-node',
      node(x, y, leave, NODES.leave, nodeAt(leaveDistance(NODES.leave)) * (1 - knot)),
    ),
    // 굳은 끝 칸은 줄기가 짧아지고 봉오리로 닫힌다
    ...named(
      'bud',
      knot > 0
        ? box(
            x,
            y,
            leave,
            [BUD.along - BUD.half * knot, BUD.along + BUD.half * knot],
            [-BUD.across * knot, BUD.across * knot],
            BUD.height * knot,
            BUD.height * knot,
            BUD_FACES,
          )
        : [],
    ),
  ]
}

// 뿌리는 칸 가운데에서 자랄 쪽 가장자리로 나가는 밑동이다
const rootShapes = (x: number, y: number, leave: Direction) => [
  leaf(x, y, leave, [0.3, -STEM_HALF], [0.06, -0.18], LEAF_RISE, 0.1, 'var(--color-vine-leaf)'),
  ...stem(x, y, leave, [0.2, 0.5]),
  ...box(x, y, leave, [0.12, 0.3], [-0.12, 0.12], 6, 6, STEM),
]

// 앞 칸 줄기 끝이 혀처럼 이 칸 가장자리로 넘어와 다음 자랄 칸을 가리킨다
const tongueShapes = (x: number, y: number, enter: Direction, tongue: number) =>
  tongue <= 0
    ? []
    : named('tongue', [
        ...stem(x, y, enter, [-0.5, -0.5 + VINE_TONGUE * tongue]),
        leaf(
          x,
          y,
          enter,
          [-0.42, STEM_HALF],
          [0.08 * tongue, 0.16 * tongue],
          LEAF_RISE,
          0.1 * tongue,
          'var(--color-vine-sprout)',
        ),
      ])

// 구덩이 바닥에 선 싹. 밑동 위에 대를 세우고 끝에 잎 둘을 단다
const sproutShapes = (x: number, y: number, height: number): Shape[] => {
  const reach = lerp(
    0.22,
    0.24,
    clamp01((height - VINE_SPROUT.future) / (VINE_SPROUT.next - VINE_SPROUT.future)),
  )
  return [
    ...box(x, y, 'right', [-0.09, 0.09], [-0.09, 0.09], 2, 2, SPROUT_BASE),
    ...box(x, y, 'right', [-0.04, 0.04], [-0.04, 0.04], height, height - 2, STEM),
    leaf(x, y, 'right', [0, 0], [reach, -reach * 0.35], height, 0.11, 'var(--color-vine-sprout)'),
    leaf(x, y, 'right', [0, 0], [-reach * 0.35, reach], height, 0.11, 'var(--color-vine-sprout)'),
  ]
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t

interface BoardVineProps {
  x: number
  y: number
  floor: number // 구덩이 바닥이 칸 윗면보다 아래인 거리
  layer: 'pit' | 'top' // 구덩이 바닥의 싹과 윗면의 줄기. 둘 사이에 판이 차오른다
  kind: VineKind
  enter: Direction | null
  leave: Direction | null
  growth: number
  tongue: number
  sprout: number
  sproutOpacity: number
  hard: number
  knot: number
  opacity: number
}

const BoardVine = ({
  x,
  y,
  floor,
  layer,
  kind,
  enter,
  leave,
  growth,
  tongue,
  sprout,
  sproutOpacity,
  hard,
  knot,
  opacity,
}: BoardVineProps) => {
  const spot = isoDelta(SPROUT_SPOT, SPROUT_SPOT)
  const top =
    kind === 'grown' && enter && leave
      ? grownShapes(x, y, enter, leave, growth, hard, knot)
      : kind === 'root' && leave
        ? rootShapes(x, y, leave)
        : enter
          ? tongueShapes(x, y, enter, tongue)
          : []
  const shapes =
    layer === 'pit'
      ? sprout > 0 && sproutOpacity > 0
        ? sproutShapes(x + spot.x, y + floor + spot.y, sprout)
        : []
      : top

  return (
    <g opacity={layer === 'pit' ? sproutOpacity : opacity}>
      {shapes.map((shape, i) => (
        <polygon key={shape.key ?? i} points={shape.points} style={{ fill: shape.fill }} />
      ))}
    </g>
  )
}

export default BoardVine
