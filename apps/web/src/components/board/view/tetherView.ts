import { clamp01 } from './cellView'
import { CUBE } from './cubeView'
import { waterDepth } from './waterView'
import { TILE, toScreen } from '@/game/iso'
import type { Entity, Point, Stage } from '@/game/types'

type Post = Extract<Entity, { type: 'post' }>

// 말뚝 기둥과 띠, 폭은 칸 폭 배수, 띠 자리는 바닥에서 위로 px
export const POST = { width: 0.16, height: 18, band: { width: 0.165, from: 8, gap: 5, depth: 2 } }

// 줄 두께와 처짐 px, tie는 말뚝에 매는 바닥 위 높이, drop은 배 옆 테두리로 내린 깊이, fade는 옆에서 앞으로 drop이 다 내려가는 기울기
export const ROPE = { width: 2.2, sag: 7, tie: 12, drop: 3, fade: 0.3 }

const ROPE_STEPS = 10

export const postsOf = (stage: Stage) => stage.entities.filter((e): e is Post => e.type === 'post')

// 말뚝 띠 수, 판의 말뚝 순서대로 하나와 둘을 번갈아, 말뚝이 아니면 0
export const postBands = (stage: Stage, p: Point) => {
  const n = postsOf(stage).findIndex((post) => post.x === p.x && post.y === p.y)
  return n < 0 ? 0 : (n % 2) + 1
}

// 칸마다 그 칸을 범위로 갖는 말뚝 순서
export const moorCells = (stage: Stage) => {
  const cells = new Map<string, number[]>()
  postsOf(stage).forEach((post, i) =>
    stage.heights.forEach((row, y) =>
      row.forEach((_, x) => {
        const d = Math.abs(x - post.x) + Math.abs(y - post.y)
        if (d > post.length || waterDepth(stage, { x, y }) === 0) return
        const key = `${x}-${y}`
        cells.set(key, [...(cells.get(key) ?? []), i])
      }),
    ),
  )
  return cells
}

// y는 말뚝 칸 윗면 중심
export const postBlocks = (y: number, bands: number) => ({
  pillar: { y: y - POST.height, width: TILE.width * POST.width, depth: POST.height },
  bands: Array.from({ length: bands }, (_, i) => ({
    y: y - POST.band.from - i * POST.band.gap - POST.band.depth,
    width: TILE.width * POST.band.width,
    depth: POST.band.depth,
  })),
})

// 가운데에서 (dx, dy) 쪽으로 나간 반폭 hw 마름모의 테두리 점
const rim = (c: Point, dx: number, dy: number, hw: number) => {
  const t = 1 / (Math.abs(dx) / hw + Math.abs(dy) / (hw / 2) || 1)
  return { x: c.x + dx * t, y: c.y + dy * t }
}

// boat는 칸 단위 배 자리, top은 배 윗면 층
// 두 끝은 서로를 향한 테두리 점, 배 쪽은 앞 테두리로 갈수록 옆 테두리까지 내려간 자리
export const ropeEnds = (post: Point, postHeight: number, boat: Point, top: number) => {
  const foot = toScreen(post, postHeight)
  const tie = { x: foot.x, y: foot.y - ROPE.tie }
  const center = toScreen(boat, top)
  const dx = center.x - tie.x
  const dy = center.y - tie.y
  const from = rim(tie, dx, dy, (TILE.width * POST.width) / 2)
  const edge = rim(center, -dx, -dy, (TILE.width * CUBE) / 2)
  const front = clamp01(-dy / (Math.hypot(dx, dy) || 1) / ROPE.fade)
  return { from, to: { x: edge.x, y: edge.y + ROPE.drop * front } }
}

const round = (v: number) => Math.round(v * 10) / 10

// slack은 처진 정도 0~1, 위 가장자리를 따라 갔다 아래 가장자리로 돌아오는 띠
export const ropePoints = (from: Point, to: Point, slack: number) => {
  const line = Array.from({ length: ROPE_STEPS + 1 }, (_, i) => {
    const t = i / ROPE_STEPS
    return {
      x: from.x + (to.x - from.x) * t,
      y: from.y + (to.y - from.y) * t + ROPE.sag * slack * Math.sin(Math.PI * t),
    }
  })
  const half = ROPE.width / 2
  const side = line.map((p, i) => {
    const a = line[Math.max(0, i - 1)]
    const b = line[Math.min(line.length - 1, i + 1)]
    const length = Math.hypot(b.x - a.x, b.y - a.y) || 1
    return { p, nx: (-(b.y - a.y) / length) * half, ny: ((b.x - a.x) / length) * half }
  })
  return [
    ...side.map(({ p, nx, ny }) => `${round(p.x - nx)},${round(p.y - ny)}`),
    ...side.reverse().map(({ p, nx, ny }) => `${round(p.x + nx)},${round(p.y + ny)}`),
  ].join(' ')
}
