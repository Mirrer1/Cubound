import {
  BAR,
  BAR_HEIGHT,
  BRAZIER,
  CUBE,
  KEG_SHAPE,
  LADDER_TIP,
  PIT_FLOOR,
  PLATE,
  POST,
  STONE,
  TAP,
  WATER,
  channelCells,
  pileLumps,
  pileReach,
  stoneSteps,
  surfaceRise,
  waterLook,
} from '../view'
import { isBrazier } from './brazierFrame'
import { fireKindAt } from './fireFrame'
import { MUSHROOM_STAND, mushroomPose } from './mushroomFrame'
import { has, same } from './pathFrame'
import { TILE, toScreen } from '@/game/iso'
import {
  barCells,
  isDoorOpen,
  isLiftRaised,
  readMushrooms,
  warpExit,
  waterLevel,
} from '@/game/rules'
import type { GameState, Point, Stage } from '@/game/types'

const GUIDE_MARGIN = 12

// 블록 윗면 중심에서 맨 위 꼭짓점까지 높이
const halfTop = (width: number) => width / 4

// 땅 바닥에서 칸 윗면이나 수면까지 높이 px, 바닥이 없는 칸은 null
const surfaceOf = (game: GameState, p: Point) => {
  const h = game.heights[p.y]?.[p.x]
  if (h === undefined || h < 0) return null
  const { depth } = waterLook(game.stage, p, (q) => waterLevel(game, q))
  if (depth > 0) return h * TILE.layer + surfaceRise(depth)
  const lift = game.stage.entities.find((e) => e.type === 'lift' && same(e, p))
  const raised = lift?.type === 'lift' && isLiftRaised(game, lift.id) ? 1 : 0
  return (h + raised) * TILE.layer
}

// 윗면 중심 위로 그려지는 높이 px, 칸 윗면과 그 위에 선 것 중 가장 높은 곳
const reachOf = (game: GameState, p: Point, floating: boolean) => {
  const reaches = [halfTop(TILE.width)]
  const cube = halfTop(TILE.width * CUBE)
  const boxTop = floating ? WATER.lip : TILE.layer
  const boxed = has(game.boxes, p)
  const mushroom = has(readMushrooms(game.stage), p)
  const player = same(game.player, p)
  const entity = game.stage.entities.find((e) => same(e, p))
  const bowl = isBrazier(game.stage, p) ? BRAZIER.height : 0

  if (bowl) reaches.push(bowl + halfTop(TILE.width * BRAZIER.bowl))
  if (boxed) reaches.push(bowl + boxTop + cube)
  if (fireKindAt(game.stage, p) === 'wall' && !has(game.ashes, p)) reaches.push(pileReach())
  if (mushroom) {
    const pose = mushroomPose(player ? 2 : 0, has(game.mushrooms, p) ? 0 : 1)
    reaches.push(pose.stem + pose.thick + halfTop(TILE.width * pose.cap))
  }
  if (has(game.kegs, p)) {
    const body = KEG_SHAPE.bodyHeight + halfTop(TILE.width * KEG_SHAPE.body)
    const lid = KEG_SHAPE.bodyHeight + KEG_SHAPE.lidHeight + halfTop(TILE.width * KEG_SHAPE.lid)
    reaches.push(Math.max(body, lid))
  }
  if (game.bars.some((bar) => has(barCells(bar), p))) {
    reaches.push(BAR_HEIGHT + halfTop(TILE.width * BAR.base.width))
  }
  if (has(game.stones, p)) {
    const peak = stoneSteps(0, 0, floating ? STONE.floatCut : 0, 1)[2]
    reaches.push(-peak.y + halfTop(peak.width))
  }
  if (player) {
    reaches.push(bowl + (boxed ? boxTop : mushroom ? MUSHROOM_STAND : 0) + TILE.layer + cube)
  }
  if (entity?.type === 'sluice')
    reaches.push(TAP.height + TAP.wheelDepth + halfTop(TILE.width * TAP.wheel))
  if (entity?.type === 'door' && !isDoorOpen(game, entity.id)) {
    reaches.push(TILE.layer + PLATE.rise + halfTop(TILE.width * PLATE.scale))
  }
  // 뒤쪽 벽에 기댄 사다리 끝은 칸 중심보다 위, 앞쪽 벽이면 아래
  for (const ladder of game.leaningLadders.filter((l) => same(l, p))) {
    const back = ladder.direction === 'up' || ladder.direction === 'left'
    reaches.push(TILE.layer + LADDER_TIP + (back ? 1 : -1) * halfTop(TILE.height))
  }
  return Math.max(...reaches)
}

// 윗면 아래로 드러난 옆면 px, 앞 두 칸과 대각선 앞 칸이 가리는 곳은 제외, pit은 앞이 빈 쪽 옆면
const dropOf = (game: GameState, p: Point, surface: number, depth: number, pit = Infinity) => {
  const below = (q: Point) => {
    const other = surfaceOf(game, q)
    return other === null ? pit : surface - other
  }
  const corner = below({ x: p.x + 1, y: p.y + 1 })
  // 옆면 아래 모서리와 대각선 앞 칸 윗면 모서리가 만나는 곳까지
  const face = (side: Point) => {
    const edge = Math.max(0, Math.min(depth, below(side)))
    return corner >= edge ? edge : Math.min((corner + edge) / 2, TILE.height / 2 + corner)
  }
  return Math.max(0, face({ x: p.x, y: p.y + 1 }), face({ x: p.x + 1, y: p.y }))
}

// 칸 대신 그 둘레만 감쌀 작은 물건, 밑면과 윗면 폭은 칸 단위, 높이 px, 여백 배수
// 씨앗은 밑동 폭 0.24, 머리 폭 0.13, 높이 11px, 바닥 사다리는 가로 폭 0.68, 뜬 높이 2px, 불씨는 화덕 폭 0.6
const smallShape = (game: GameState, p: Point) => {
  if (same(game.player, p) || has(game.boxes, p)) return null
  if (game.stage.entities.some((e) => e.type === 'post' && same(e, p)))
    return { foot: POST.width, head: POST.width, height: POST.height, margin: 2 }
  if (has(game.seeds, p)) return { foot: 0.24, head: 0.13, height: 11, margin: 2 }
  if (has(readMushrooms(game.stage), p)) {
    const pose = mushroomPose(0, has(game.mushrooms, p) ? 0 : 1)
    return { foot: pose.cap, head: pose.cap, height: pose.stem + pose.thick, margin: 2 }
  }
  if (has(game.ladders, p)) return { foot: 0.68, head: 0.68, height: 2, margin: 1 }
  if (has(game.kegs, p)) {
    const height = KEG_SHAPE.bodyHeight + KEG_SHAPE.lidHeight
    return { foot: KEG_SHAPE.body, head: KEG_SHAPE.lid, height, margin: 2 }
  }
  const fire = fireKindAt(game.stage, p)
  if (fire === 'wall' && !has(game.ashes, p))
    return { foot: pileLumps(false)[0].scale, head: 0, height: pileReach(), margin: 1 }
  if (fire === 'spark') return { foot: 0.6, head: 0.6, height: 0, margin: 1 }
  return null
}

// 가이드가 비추는 칸의 사각형, 윗면이나 수면과 그 위에 선 것, 드러난 옆면에 같은 여백
const cellRect = (game: GameState, p: Point) => {
  // 바닥 없는 칸은 덩굴 길이나 발판 길의 팬 구덩이
  const surface = surfaceOf(game, p)
  const floating = waterLook(game.stage, p, (q) => waterLevel(game, q)).depth > 0
  const center = toScreen(p, 0)
  const y = center.y - (surface ?? 0)
  const reach = reachOf(game, p, floating)
  const x = center.x - TILE.width / 2 - GUIDE_MARGIN
  const width = TILE.width + GUIDE_MARGIN * 2

  const small = smallShape(game, p)
  if (small) {
    const foot = TILE.width * small.foot
    const head = TILE.width * small.head
    const margin = GUIDE_MARGIN * small.margin
    const top = y - small.height - halfTop(head) - margin
    const bottom = y + halfTop(foot) + margin
    return {
      x: center.x - foot / 2 - margin,
      y: top,
      width: foot + margin * 2,
      height: bottom - top,
    }
  }

  // 얼음 돌은 돌을 가운데에 두고 윗면까지만, 옆면 제외
  if (has(game.stones, p)) {
    const foot = STONE.steps[0].width
    const mid = y + (halfTop(TILE.width * foot) - reach) / 2
    const half = Math.max(mid - (y - reach), y + TILE.height / 2 - mid) + GUIDE_MARGIN
    return { x, y: mid - half, width, height: half * 2 }
  }

  const top = y - reach - GUIDE_MARGIN
  const bridge = fireKindAt(game.stage, p) === 'bridge'
  const drop =
    surface === null
      ? dropOf(game, p, 0, PIT_FLOOR)
      : bridge
        ? dropOf(game, p, surface, TILE.lip)
        : dropOf(game, p, surface, surface + TILE.lip, 0)
  const bottom = y + TILE.height / 2 + drop + GUIDE_MARGIN

  return { x, y: top, width, height: bottom - top }
}

// 막대 칸은 막대가 차지한 칸 전부를 감싸고 좌우는 받침 네 모서리까지인 사각형
export const guideRect = (game: GameState, p: Point) => {
  const bar = game.bars.find((b) => has(barCells(b), p))
  if (!bar) return cellRect(game, p)
  const cells = barCells(bar)
  const rects = cells.map((c) => cellRect(game, c))
  const ends = [cells[0], cells[cells.length - 1]]
  const d = { x: Math.sign(ends[1].x - ends[0].x), y: Math.sign(ends[1].y - ends[0].y) }
  const half = BAR.base.width / 2
  const corners = [-1, 1].flatMap((end) =>
    [-1, 1].map((side) => {
      const c = ends[end < 0 ? 0 : 1]
      return toScreen(
        {
          x: c.x + d.x * BAR.reach * end + d.y * half * side,
          y: c.y + d.y * BAR.reach * end + d.x * half * side,
        },
        0,
      ).x
    }),
  )
  const x = Math.min(...corners) - GUIDE_MARGIN
  const y = Math.min(...rects.map((r) => r.y))
  const right = Math.max(...corners) + GUIDE_MARGIN
  const bottom = Math.max(...rects.map((r) => r.y + r.height))
  return { x, y, width: right - x, height: bottom - y }
}

// 짝 칸 가이드가 함께 비추는 나올 칸
export const pairRect = (game: GameState, p: Point) => {
  const exit = warpExit(game.stage, p)
  return exit ? guideRect(game, exit) : null
}

// 타는 짐 가이드가 비추는 상자와 맞닿은 화로, 두 칸 모두 윗면까지만
export const burnRect = (game: GameState, p: Point) => {
  const near = [
    { x: p.x + 1, y: p.y },
    { x: p.x - 1, y: p.y },
    { x: p.x, y: p.y + 1 },
    { x: p.x, y: p.y - 1 },
  ].filter((q) => isBrazier(game.stage, q))
  const rects = [p, ...near].map((q) => {
    const rect = guideRect(game, q)
    const bottom = toScreen(q, 0).y - (surfaceOf(game, q) ?? 0) + TILE.height / 2 + GUIDE_MARGIN
    return { ...rect, height: bottom - rect.y }
  })
  const left = Math.min(...rects.map((r) => r.x))
  const top = Math.min(...rects.map((r) => r.y))
  const right = Math.max(...rects.map((r) => r.x + r.width))
  const bottom = Math.max(...rects.map((r) => r.y + r.height))
  return { x: left, y: top, width: right - left, height: bottom - top }
}

// 갑문 가이드가 비추는 칸, 장치와 물길과 물길이 닿는 두 웅덩이 칸, 물길이 없으면 두 웅덩이 전체
const lockCells = (stage: Stage): Point[] => {
  const path = [...channelCells(stage)].map(([key, axis]) => {
    const [x, y] = key.split('-').map(Number)
    return { x, y, axis }
  })
  const water = stage.water ?? 0
  if (path.length === 0)
    return stage.heights.flatMap((row, y) =>
      row.flatMap((h, x) => (h >= 0 && h <= water ? [{ x, y }] : [])),
    )
  const dx = path[0].axis === 'x' ? 1 : 0
  const first = path[0]
  const last = path[path.length - 1]
  return [
    { x: first.x - dx, y: first.y - (1 - dx) },
    ...path,
    { x: last.x + dx, y: last.y + (1 - dx) },
  ]
}

export const lockRect = (game: GameState) => {
  const rects = lockCells(game.stage).map((p) => guideRect(game, p))
  const left = Math.min(...rects.map((r) => r.x))
  const top = Math.min(...rects.map((r) => r.y))
  const right = Math.max(...rects.map((r) => r.x + r.width))
  const bottom = Math.max(...rects.map((r) => r.y + r.height))
  return { x: left, y: top, width: right - left, height: bottom - top }
}

// 갑문 가이드에서 카메라가 맞추는 칸, 두 웅덩이 사이의 장치
export const lockFocus = (stage: Stage): Point | null => {
  const sluice = stage.rules?.lock ? stage.entities.find((e) => e.type === 'sluice') : undefined
  return sluice ? { x: sluice.x, y: sluice.y } : null
}
