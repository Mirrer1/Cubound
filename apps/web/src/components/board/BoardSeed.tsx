import type { TopTilt } from './cube'
import { SAPLING } from './frame'
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

// 한 번에 같이 흐려지고 같이 커지는 도형 묶음. scale은 origin을 중심으로 한다
interface Layer {
  key: string
  shapes: Shape[]
  opacity: number
  scale: number
  origin: Corner
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

// 남은 수마다의 나무 키 px
const TREE_HEIGHT: Record<number, number> = { 4: 7, 3: 12, 2: 21, 1: 28 }
// 말뚝은 앞 모서리에 한 줄로 선다. 간격은 px이다
const STAKE = { spot: 0.34, gap: 8, size: 0.04, height: 6 }
// 기둥 줄기는 오른쪽 옆면에 붙고 잎은 층을 따라 번갈아 난다. 새 잎은 줄기가 grow px 더 내려오는 동안 드러난다
const STALK = { half: 0.045, leafStart: 9, leafGap: 15, leafEnd: 5, grow: 6 }
// 나타나는 것은 이 크기에서 커지고 사라지는 것은 이 크기로 줄어든다
const SMALL = 0.6
// 나타남과 사라짐이 겹치는 몫. 들어서는 쪽이 먼저 짙어지고 떠나는 쪽이 뒤에 옅어진다
const FADE = 0.6

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const fadeIn = (p: number) => clamp01(p / FADE)
const fadeOut = (p: number) => 1 - clamp01((p - (1 - FADE)) / FADE)

const pointsOf = (list: Corner[]) => list.map(([a, b]) => `${a},${b}`).join(' ')

// 칸 윗면 중심 (x, y)에서 칸 단위 (u, v)만큼 가고 z px 올라간 화면 점. tilt가 있으면 기운 큐브 윗면을 따라 옮긴다
const at = (x: number, y: number, u: number, v: number, z: number, tilt?: TopTilt): Corner => {
  const d = isoDelta(u, v)
  const t = tilt ? tilt(u, v, z) : { x: 0, y: 0 }
  return [x + d.x + t.x, y + d.y - z + t.y]
}

// 칸 단위 범위의 직육면체. z는 윗면 높이이고 depth만큼 아래로 옆면이 내려온다
const cuboid = (
  x: number,
  y: number,
  [u0, u1, v0, v1]: [number, number, number, number],
  z: number,
  depth: number,
  faces: Faces,
  tilt?: TopTilt,
): Shape[] => {
  const a = at(x, y, u0, v0, z, tilt)
  const b = at(x, y, u1, v0, z, tilt)
  const c = at(x, y, u1, v1, z, tilt)
  const d = at(x, y, u0, v1, z, tilt)
  const bc = at(x, y, u1, v0, z - depth, tilt)
  const cc = at(x, y, u1, v1, z - depth, tilt)
  const dc = at(x, y, u0, v1, z - depth, tilt)
  return [
    { points: pointsOf([b, c, cc, bc]), fill: faces.right },
    { points: pointsOf([d, c, cc, dc]), fill: faces.left },
    { points: pointsOf([a, b, c, d]), fill: faces.top },
  ]
}

// 가운데에 선 정사각 블록. size는 칸 단위 폭이고 bottom은 밑면 높이다
const block = (
  x: number,
  y: number,
  size: number,
  bottom: number,
  height: number,
  faces: Faces,
  tilt?: TopTilt,
) => cuboid(x, y, [-size / 2, size / 2, -size / 2, size / 2], bottom + height, height, faces, tilt)

// 두 단으로 쌓은 도토리꼴
const seedShapes = (x: number, y: number, tilt?: TopTilt) => [
  ...block(x, y, 0.24, 0, 7, SEED, tilt),
  ...block(x, y, 0.13, 7, 4, CROWN, tilt),
]

const soilSpot = (x: number, y: number) => at(x, y, SAPLING.spot, -SAPLING.spot, 0)

// 흙 자리와 반쯤 묻힌 씨앗 껍질
const soilShapes = (sx: number, sy: number) => [
  ...block(sx, sy, 0.24, 0, SAPLING.soil, SOIL),
  ...cuboid(sx, sy, [-0.05, 0.05, -0.05, 0.05], 2 + SAPLING.soil, 2, SEED),
]

// 남은 수가 줄수록 싹이 떡잎, 줄기, 어린 나무로 자란다
const treeShapes = (sx: number, sy: number, left: number) => {
  const g = SAPLING.soil
  const stem = (from: number, to: number) =>
    cuboid(sx, sy, [-0.022, 0.022, -0.022, 0.022], to + g, to - from, STEM)
  const leaf = (range: [number, number, number, number], z: number, th: number) =>
    cuboid(sx, sy, range, z + g, th, LEAF)
  const branch = (u0: number, u1: number, z: number) =>
    cuboid(sx, sy, [u0, u1, -0.015, 0.015], z + g, 2, STEM)

  return left >= 4
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
}

// 한 단계 자라는 나무는 떠나는 모습이 들어서는 키로 늘고 들어서는 모습이 떠나던 키에서 커져 한 그루로 보인다.
// 심거나 솟아 사라지거나 보스 기둥에 새 싹이 설 때는 작은 크기에서 나타나고 작아지며 사라진다
const treeLayers = (x: number, y: number, tree: number, next: number, p: number): Layer[] => {
  const spot = soilSpot(x, y)
  const [sx, sy] = spot
  const layer = (key: string, shapes: Shape[], opacity: number, scale: number): Layer => ({
    key,
    shapes,
    opacity,
    scale,
    origin: spot,
  })
  if (tree === next)
    return [
      layer('soil', soilShapes(sx, sy), 1, 1),
      layer(`tree${tree}`, treeShapes(sx, sy, tree), 1, 1),
    ]

  const grows = tree > 0 && next === tree - 1
  const soil =
    tree === 0
      ? layer('soil', soilShapes(sx, sy), fadeIn(p), lerp(SMALL, 1, p))
      : next === 0
        ? layer('soil', soilShapes(sx, sy), fadeOut(p), lerp(1, SMALL, p))
        : layer('soil', soilShapes(sx, sy), 1, 1)
  const leaving =
    tree > 0
      ? [
          layer(
            `tree${tree}`,
            treeShapes(sx, sy, tree),
            fadeOut(p),
            grows ? lerp(1, TREE_HEIGHT[next] / TREE_HEIGHT[tree], p) : lerp(1, SMALL, p),
          ),
        ]
      : []
  const coming =
    next > 0
      ? [
          layer(
            `tree${next}`,
            treeShapes(sx, sy, next),
            fadeIn(p),
            grows ? lerp(TREE_HEIGHT[tree] / TREE_HEIGHT[next], 1, p) : lerp(SMALL, 1, p),
          ),
        ]
      : []

  return [soil, ...leaving, ...coming]
}

// count개 말뚝을 가운데 맞춰 세운다. shift는 가운데 맞춤을 옮긴 칸 수, grow는 키 비율이다
const stakeRow = (
  x: number,
  y: number,
  count: number,
  from: number,
  shift: number,
  grow: number,
) => {
  const [bx, by] = at(x, y, STAKE.spot, STAKE.spot, 0)
  return Array.from({ length: count - from }, (_, k) => {
    const i = from + k
    const dx = (i - (count - 1) / 2 + shift) * STAKE.gap
    return block(bx + dx, by, STAKE.size, 0, STAKE.height * grow, SEED)
  }).flat()
}

// 하나 줄 때는 남는 말뚝이 가운데로 모이고 끝의 하나가 낮아지며 사라진다. 그 밖에는 앞 줄이 낮아지고 새 줄이 차오른다
const stakeLayers = (x: number, y: number, stakes: number, next: number, p: number): Layer[] => {
  const origin = at(x, y, STAKE.spot, STAKE.spot, 0)
  const layer = (key: string, shapes: Shape[], opacity: number): Layer => ({
    key,
    shapes,
    opacity,
    scale: 1,
    origin,
  })
  if (stakes === next) return [layer('stakes', stakeRow(x, y, stakes, 0, 0, 1), 1)]

  if (next === stakes - 1) {
    const shift = p / 2
    return [
      layer('stakes', stakeRow(x, y, next + 1, 0, shift, 1).slice(0, next * 3), 1),
      layer('leaving', stakeRow(x, y, stakes, stakes - 1, shift, lerp(1, SMALL, p)), fadeOut(p)),
    ]
  }

  return [
    layer('leaving', stakeRow(x, y, stakes, 0, 0, lerp(1, SMALL, p)), fadeOut(p)),
    layer('stakes', stakeRow(x, y, next, 0, 0, lerp(SMALL, 1, p)), fadeIn(p)),
  ]
}

// 솟은 땅에 나무가 서 있던 자리에 남는 낮은 잎 두 장
const leafLayers = (x: number, y: number, shown: number): Layer[] => {
  const spot = soilSpot(x, y)
  const [sx, sy] = spot
  return [
    {
      key: 'leaves',
      shapes: [
        ...cuboid(sx, sy, [-0.035, 0.035, -0.13, 0], 3, 3, LEAF),
        ...cuboid(sx, sy, [0, 0.13, -0.035, 0.035], 3, 3, LEAF),
      ],
      opacity: fadeIn(shown),
      scale: lerp(SMALL, 1, shown),
      origin: spot,
    },
  ]
}

// 보스 기둥의 오른쪽 옆면을 오르는 줄기와 잎. 멈추면 꼭대기 모서리가 봉오리로 닫힌다
const stalkLayers = (x: number, y: number, level: number, bud: number): Layer[] => {
  const height = level * TILE.layer
  const a = at(x, y, 0.5, -SAPLING.spot + STALK.half, 0)
  const b = at(x, y, 0.5, -SAPLING.spot - STALK.half, 0)
  const stem: Layer = {
    key: 'stem',
    shapes: [
      {
        points: pointsOf([a, b, [b[0], b[1] + height], [a[0], a[1] + height]]),
        fill: 'var(--color-seed-stalk)',
      },
    ],
    opacity: 1,
    scale: 1,
    origin: a,
  }
  const leaves: Layer[] = []
  for (let i = 0; STALK.leafStart + i * STALK.leafGap <= height - STALK.leafEnd + STALK.grow; i++) {
    const top = STALK.leafStart + i * STALK.leafGap
    const side = i % 2 ? 1 : -1
    const [bx, base] = side > 0 ? b : a
    const by = base + top
    const dx = side * 10
    const dy = -side * 5
    leaves.push({
      key: `leaf${i}`,
      shapes: [
        {
          points: pointsOf([
            [bx, by],
            [bx + dx * 0.5, by + dy * 0.5 - 3.5],
            [bx + dx, by + dy - 1],
            [bx + dx * 0.5, by + dy * 0.5 + 1.5],
          ]),
          fill: 'var(--color-seed-stalk-leaf)',
        },
      ],
      opacity: clamp01((height - STALK.leafEnd - top) / STALK.grow + 1),
      scale: 1,
      origin: [bx, by],
    })
  }
  const budOrigin = at(x, y, 0.39, -SAPLING.spot, 0)
  const buds: Layer[] =
    bud > 0
      ? [
          {
            key: 'bud',
            shapes: cuboid(x, y, [0.3, 0.48, -SAPLING.spot - 0.1, -SAPLING.spot + 0.1], 7, 7, BUD),
            opacity: fadeIn(bud),
            scale: lerp(SMALL, 1, bud),
            origin: budOrigin,
          },
        ]
      : []
  return [stem, ...leaves, ...buds]
}

interface BoardSeedProps {
  x: number
  y: number // 칸 윗면 중심. 들고 있는 씨앗은 큐브 윗면 중심
  part: 'seed' | 'tree' | 'stakes' | 'leaves' | 'stalk'
  from?: number // 사라지는 나무 단계나 말뚝 수
  to?: number // 들어서는 나무 단계나 말뚝 수
  p?: number // from에서 to로 바뀐 정도. 잎과 봉오리는 드러난 정도
  level?: number // 기둥 층 수
  tilt?: TopTilt // 들고 있는 씨앗이 기운 큐브를 따라 기울 때
}

const BoardSeed = ({ x, y, part, from = 0, to = 0, p = 1, level = 0, tilt }: BoardSeedProps) => {
  const layers: Layer[] =
    part === 'seed'
      ? [{ key: 'seed', shapes: seedShapes(x, y, tilt), opacity: 1, scale: 1, origin: [x, y] }]
      : part === 'tree'
        ? treeLayers(x, y, from, to, p)
        : part === 'stakes'
          ? stakeLayers(x, y, from, to, p)
          : part === 'leaves'
            ? leafLayers(x, y, p)
            : stalkLayers(x, y, level, p)

  return (
    <g>
      {layers.map(({ key, shapes, opacity, scale, origin: [ox, oy] }) => (
        <g
          key={key}
          opacity={opacity}
          transform={
            scale === 1
              ? undefined
              : `translate(${ox} ${oy}) scale(${scale}) translate(${-ox} ${-oy})`
          }
        >
          {shapes.map((shape, i) => (
            <polygon key={i} points={shape.points} style={{ fill: shape.fill }} />
          ))}
        </g>
      ))}
    </g>
  )
}

export default BoardSeed
