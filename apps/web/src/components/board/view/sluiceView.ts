import { spotPoints } from './cellView'
import { TILE, blockFaces, isoDelta } from '@/game/iso'
import type { Point, Stage } from '@/game/types'

// 수위 장치 꼭지, 판은 칸 폭 배수와 두께 px, pool은 판이 뜬 얕은 물웅덩이의 칸 폭 배수와 바닥보다 낮은 px와 테 비율, at은 꼭지 밑동의 칸 안 자리, 기둥과 바퀴와 웅덩이는 칸 폭 배수, 높이와 물줄기와 흘러내리는 물방울은 px, dripCycle은 물방울 한 번 ms
export const TAP = {
  plate: 0.62,
  pool: 0.86,
  poolDrop: 3,
  poolRim: 0.1,
  depth: 3,
  pressed: 1,
  at: { u: 0.33, v: -0.33 },
  post: 0.11,
  height: 14,
  wheel: 0.26,
  wheelDepth: 2,
  spout: 6,
  stream: 2.6,
  streamCore: 0.8,
  streamTop: 5,
  puddle: 0.16,
  puddleInner: 0.1,
  slot: { long: 0.12, short: 0.025 },
  drip: 2,
  dripCycle: 420,
}

// 물길 홈 폭과 흐르는 물 가운데 띠 폭, 칸 폭 배수
export const CHANNEL = { width: 0.2, flow: 0.06 }

// 꼭지 밑동 화면 자리, x와 y는 칸 윗면 중심
export const tapBase = (x: number, y: number) => {
  const d = isoDelta(TAP.at.u, TAP.at.v)
  return { x: x + d.x, y: y + d.y }
}

// 바퀴 홈 네 모서리의 칸 안 자리, 닫히면 세로로 서고 turn만큼 돌아 열리면 가로로 누운 홈
export const slotPoints = (turn: number): [number, number][] => {
  const { long, short } = TAP.slot
  const angle = (turn * Math.PI) / 2
  const corners: [number, number][] = [
    [-short, -long],
    [short, -long],
    [short, long],
    [-short, long],
  ]
  return corners.map(([a, b]) => [
    a * Math.cos(angle) - b * Math.sin(angle),
    a * Math.sin(angle) + b * Math.cos(angle),
  ])
}

// 기둥 옆면에서 바깥으로 뻗은 주둥이, 밑동 기준 px
const SPOUT: [number, number][] = [
  [3, -13],
  [8, -10],
  [8, -6],
  [3, -9],
]

const rect = (cx: number, top: number, half: number, bottom: number) =>
  [
    [cx - half, top],
    [cx + half, top],
    [cx + half, bottom],
    [cx - half, bottom],
  ]
    .map(([x, y]) => `${x},${y}`)
    .join(' ')

// 꼭지 그림 자리, x와 y는 칸 윗면 중심, open은 열린 정도
export const tapParts = (x: number, y: number, open: number, turn = open) => {
  const base = tapBase(x, y)
  const mouth = { x: base.x + TAP.spout, y: base.y - 1 }
  const wheelY = base.y - TAP.height - TAP.wheelDepth
  return {
    post: { x: base.x, y: base.y - TAP.height, width: TILE.width * TAP.post, depth: TAP.height },
    spout: SPOUT.map(([dx, dy]) => `${base.x + dx},${base.y + dy}`).join(' '),
    wheel: { x: base.x, y: wheelY, width: TILE.width * TAP.wheel, depth: TAP.wheelDepth },
    slot: spotPoints(base.x, wheelY, slotPoints(turn)),
    stream: rect(mouth.x, mouth.y - TAP.streamTop, TAP.stream, mouth.y + 1),
    streamCore: rect(mouth.x, mouth.y - TAP.streamTop, TAP.streamCore, mouth.y),
    puddle: blockFaces(mouth.x, mouth.y, TILE.width * TAP.puddle * open, 0).top,
    puddleInner: blockFaces(mouth.x, mouth.y, TILE.width * TAP.puddleInner * open, 0).top,
    drip: rect(
      mouth.x,
      mouth.y - TAP.streamTop,
      TAP.streamCore,
      mouth.y - TAP.streamTop + TAP.drip,
    ),
    mouth,
  }
}

// 칸을 가로지르는 물길 홈과 흐르는 물 가운데 띠, x와 y는 칸 윗면 중심
export const channelPoints = (x: number, y: number, axis: 'x' | 'y') => {
  const band = (half: number) =>
    spotPoints(
      x,
      y,
      axis === 'x'
        ? [
            [-0.5, -half],
            [0.5, -half],
            [0.5, half],
            [-0.5, half],
          ]
        : [
            [-half, -0.5],
            [half, -0.5],
            [half, 0.5],
            [-half, 0.5],
          ],
    )
  return { groove: band(CHANNEL.width / 2), flow: band(CHANNEL.flow / 2) }
}

const OFFSETS: Record<'x' | 'y', Point[]> = {
  x: [
    { x: -1, y: 0 },
    { x: 1, y: 0 },
  ],
  y: [
    { x: 0, y: -1 },
    { x: 0, y: 1 },
  ],
}

// 갑문 판의 가 웅덩이 칸, 물 높이 이하 칸의 4방향 덩이
const firstPool = (stage: Stage, lock: Point) => {
  const water = stage.water ?? 0
  const isPool = (p: Point) => {
    const h = stage.heights[p.y]?.[p.x]
    return h !== undefined && h >= 0 && h <= water
  }
  const pool = new Set<string>([`${lock.x}-${lock.y}`])
  const queue = [lock]
  for (const p of queue) {
    for (const d of [...OFFSETS.x, ...OFFSETS.y]) {
      const q = { x: p.x + d.x, y: p.y + d.y }
      if (!isPool(q) || pool.has(`${q.x}-${q.y}`)) continue
      pool.add(`${q.x}-${q.y}`)
      queue.push(q)
    }
  }
  return { pool, isPool }
}

// 갑문 판의 물길 홈 칸과 방향, 장치에서 한 축으로 땅만 지나 양쪽 끝이 서로 다른 웅덩이에 닿는 길
export const channelCells = (stage: Stage) => {
  const cells = new Map<string, 'x' | 'y'>()
  const lock = stage.rules?.lock
  if (!lock) return cells

  const { pool, isPool } = firstPool(stage, lock)
  for (const sluice of stage.entities.filter((e) => e.type === 'sluice')) {
    for (const axis of ['x', 'y'] as const) {
      const path: Point[] = [{ x: sluice.x, y: sluice.y }]
      // 끝이 닿은 웅덩이가 가 웅덩이인지, 바닥 없는 칸이나 판 밖에서 끊기면 null
      const ends = OFFSETS[axis].map((d) => {
        let q = { x: sluice.x + d.x, y: sluice.y + d.y }
        while ((stage.heights[q.y]?.[q.x] ?? -1) >= 0 && !isPool(q)) {
          path.push(q)
          q = { x: q.x + d.x, y: q.y + d.y }
        }
        return isPool(q) ? pool.has(`${q.x}-${q.y}`) : null
      })
      if (ends[0] === null || ends[1] === null || ends[0] === ends[1]) continue
      path.sort((a, b) => a.x - b.x || a.y - b.y).forEach((p) => cells.set(`${p.x}-${p.y}`, axis))
      return cells
    }
  }
  return cells
}
