import { darken } from './shade'
import { TILE, isoDelta } from '@/game/iso'

type Corner = [number, number]

interface Faces {
  top: string
  left: string
  right: string
}

interface Shape {
  points: string
  fill: string
}

const SEED: Faces = {
  top: 'var(--color-seed-top)',
  left: 'var(--color-seed-left)',
  right: 'var(--color-seed-right)',
}
const CROWN: Faces = { ...SEED, top: 'var(--color-seed-crown)' }
const SOIL: Faces = {
  top: 'var(--color-seed-soil-top)',
  left: 'var(--color-seed-soil-left)',
  right: 'var(--color-seed-soil-right)',
}
const STEM: Faces = {
  top: 'var(--color-seed-sapling-stem)',
  left: darken('seed-sapling-stem', 20),
  right: darken('seed-sapling-stem', 8),
}
const LEAF: Faces = {
  top: 'var(--color-seed-sapling-leaf)',
  left: 'var(--color-seed-sapling-leaf-left)',
  right: 'var(--color-seed-sapling-leaf-right)',
}
const BUD: Faces = {
  top: 'var(--color-seed-stalk-bud)',
  left: 'var(--color-seed-stalk-bud-left)',
  right: 'var(--color-seed-stalk-bud-right)',
}

// 나무는 칸 오른쪽 모서리의 흙 자리에서 자라고 흙 자리는 윗면에서 이만큼 솟는다
const SAPLING = { spot: 0.36, soil: 2 }
// 말뚝은 앞 모서리에 한 줄로 선다. 간격은 px이다
const STAKE = { spot: 0.34, gap: 8, size: 0.04, height: 6 }
// 기둥 줄기는 오른쪽 옆면에 붙고 잎은 층을 따라 번갈아 난다
const STALK = { half: 0.045, leafStart: 9, leafGap: 15, leafEnd: 5 }

const pointsOf = (list: Corner[]) => list.map(([a, b]) => `${a},${b}`).join(' ')

// 칸 윗면 중심 (x, y)에서 칸 단위 (u, v)만큼 가고 z px 올라간 화면 점
const at = (x: number, y: number, u: number, v: number, z: number): Corner => {
  const d = isoDelta(u, v)
  return [x + d.x, y + d.y - z]
}

// 칸 단위 범위의 직육면체. z는 윗면 높이이고 depth만큼 아래로 옆면이 내려온다
const cuboid = (
  x: number,
  y: number,
  [u0, u1, v0, v1]: [number, number, number, number],
  z: number,
  depth: number,
  faces: Faces,
): Shape[] => {
  const a = at(x, y, u0, v0, z)
  const b = at(x, y, u1, v0, z)
  const c = at(x, y, u1, v1, z)
  const d = at(x, y, u0, v1, z)
  const down = ([p, q]: Corner): Corner => [p, q + depth]
  return [
    { points: pointsOf([b, c, down(c), down(b)]), fill: faces.right },
    { points: pointsOf([d, c, down(c), down(d)]), fill: faces.left },
    { points: pointsOf([a, b, c, d]), fill: faces.top },
  ]
}

// 가운데에 선 정사각 블록. size는 칸 단위 폭이고 bottom은 밑면 높이다
const block = (x: number, y: number, size: number, bottom: number, height: number, faces: Faces) =>
  cuboid(x, y, [-size / 2, size / 2, -size / 2, size / 2], bottom + height, height, faces)

// 두 단으로 쌓은 도토리꼴
const seedShapes = (x: number, y: number) => [
  ...block(x, y, 0.24, 0, 7, SEED),
  ...block(x, y, 0.13, 7, 4, CROWN),
]

// 남은 수가 줄수록 싹이 떡잎, 줄기, 어린 나무로 자란다
const saplingShapes = (x: number, y: number, left: number) => {
  const [sx, sy] = at(x, y, SAPLING.spot, -SAPLING.spot, 0)
  const g = SAPLING.soil
  const stem = (from: number, to: number) =>
    cuboid(sx, sy, [-0.022, 0.022, -0.022, 0.022], to + g, to - from, STEM)
  const leaf = (range: [number, number, number, number], z: number, th: number) =>
    cuboid(sx, sy, range, z + g, th, LEAF)
  const branch = (u0: number, u1: number, z: number) =>
    cuboid(sx, sy, [u0, u1, -0.015, 0.015], z + g, 2, STEM)
  const tree =
    left >= 4
      ? [...stem(1, 5), ...leaf([-0.025, 0.025, -0.025, 0.025], 5, 2)]
      : left === 3
        ? [
            ...stem(1, 8),
            ...leaf([0.02, 0.13, -0.04, 0.04], 10, 2),
            ...leaf([-0.04, 0.04, -0.13, -0.02], 10, 2),
          ]
        : left === 2
          ? [
              ...stem(1, 17),
              ...leaf([-0.035, 0.035, -0.12, -0.02], 13, 2),
              ...leaf([0.02, 0.12, -0.035, 0.035], 10, 2),
              ...leaf([-0.07, 0.07, -0.07, 0.07], 19, 4),
            ]
          : [
              ...stem(1, 22),
              ...branch(-0.1, -0.02, 20),
              ...branch(0.02, 0.1, 17),
              ...leaf([-0.17, -0.03, -0.07, 0.07], 24, 5),
              ...leaf([-0.07, 0.07, -0.07, 0.07], 26, 5),
              ...leaf([0.03, 0.17, -0.07, 0.07], 21, 5),
            ]

  return [
    ...block(sx, sy, 0.24, 0, g, SOIL),
    ...cuboid(sx, sy, [-0.05, 0.05, -0.05, 0.05], 2 + g, 2, SEED),
    ...tree,
  ]
}

const stakeShapes = (x: number, y: number, left: number) => {
  const [bx, by] = at(x, y, STAKE.spot, STAKE.spot, 0)
  return Array.from({ length: left }, (_, i) =>
    block(bx + (i - (left - 1) / 2) * STAKE.gap, by, STAKE.size, 0, STAKE.height, SEED),
  ).flat()
}

// 솟은 땅에 나무가 서 있던 자리에 남는 낮은 잎 두 장
const leafShapes = (x: number, y: number) => {
  const [sx, sy] = at(x, y, SAPLING.spot, -SAPLING.spot, 0)
  return [
    ...cuboid(sx, sy, [-0.035, 0.035, -0.13, 0], 3, 3, LEAF),
    ...cuboid(sx, sy, [0, 0.13, -0.035, 0.035], 3, 3, LEAF),
  ]
}

// 보스 기둥의 오른쪽 옆면을 오르는 줄기와 잎. 멈추면 꼭대기 모서리가 봉오리로 닫힌다
const stalkShapes = (x: number, y: number, level: number, done: boolean) => {
  const height = level * TILE.layer
  const a = at(x, y, 0.5, -SAPLING.spot + STALK.half, 0)
  const b = at(x, y, 0.5, -SAPLING.spot - STALK.half, 0)
  const stem: Shape = {
    points: pointsOf([a, b, [b[0], b[1] + height], [a[0], a[1] + height]]),
    fill: 'var(--color-seed-stalk)',
  }
  const leaves: Shape[] = []
  for (let i = 0; STALK.leafStart + i * STALK.leafGap <= height - STALK.leafEnd; i++) {
    const side = i % 2 ? 1 : -1
    const [bx, base] = side > 0 ? b : a
    const by = base + STALK.leafStart + i * STALK.leafGap
    const dx = side * 10
    const dy = -side * 5
    leaves.push({
      points: pointsOf([
        [bx, by],
        [bx + dx * 0.5, by + dy * 0.5 - 3.5],
        [bx + dx, by + dy - 1],
        [bx + dx * 0.5, by + dy * 0.5 + 1.5],
      ]),
      fill: 'var(--color-seed-stalk-leaf)',
    })
  }
  const bud = done
    ? cuboid(x, y, [0.3, 0.48, -SAPLING.spot - 0.1, -SAPLING.spot + 0.1], 7, 7, BUD)
    : []
  return [stem, ...leaves, ...bud]
}

interface BoardSeedProps {
  x: number
  y: number // 칸 윗면 중심. 들고 있는 씨앗은 큐브 윗면 중심
  part: 'seed' | 'sapling' | 'stakes' | 'leaves' | 'stalk'
  left?: number // 솟기까지 남은 수
  level?: number // 기둥 층 수
  done?: boolean // 기둥이 다 자람
}

const BoardSeed = ({ x, y, part, left = 0, level = 0, done = false }: BoardSeedProps) => {
  const shapes =
    part === 'seed'
      ? seedShapes(x, y)
      : part === 'sapling'
        ? saplingShapes(x, y, left)
        : part === 'stakes'
          ? stakeShapes(x, y, left)
          : part === 'leaves'
            ? leafShapes(x, y)
            : stalkShapes(x, y, level, done)

  return (
    <g>
      {shapes.map((shape, i) => (
        <polygon key={i} points={shape.points} style={{ fill: shape.fill }} />
      ))}
    </g>
  )
}

export default BoardSeed
