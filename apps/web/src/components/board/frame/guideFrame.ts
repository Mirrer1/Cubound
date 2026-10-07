import {
  CUBE,
  LADDER_TIP,
  PIT_FLOOR,
  PLATE,
  STONE,
  TAP,
  WATER,
  channelCells,
  stoneSteps,
  surfaceRise,
  waterLook,
} from '../view'
import { MUSHROOM_STAND, mushroomPose } from './mushroomFrame'
import { has, same } from './pathFrame'
import { TILE, toScreen } from '@/game/iso'
import { isDoorOpen, isLiftRaised, readMushrooms, waterLevel } from '@/game/rules'
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

  if (boxed) reaches.push(boxTop + cube)
  if (mushroom) {
    const pose = mushroomPose(player ? 2 : 0, has(game.mushrooms, p) ? 0 : 1)
    reaches.push(pose.stem + pose.thick + halfTop(TILE.width * pose.cap))
  }
  if (has(game.stones, p)) {
    const peak = stoneSteps(0, 0, floating ? STONE.floatCut : 0, 1)[2]
    reaches.push(-peak.y + halfTop(peak.width))
  }
  if (player) reaches.push((boxed ? boxTop : mushroom ? MUSHROOM_STAND : 0) + TILE.layer + cube)
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

// 윗면 아래로 드러난 옆면 px, 앞 두 칸과 대각선 앞 칸이 가리는 곳은 제외
const dropOf = (game: GameState, p: Point, surface: number, depth: number) => {
  const below = (q: Point) => {
    const other = surfaceOf(game, q)
    return other === null ? Infinity : surface - other
  }
  const corner = below({ x: p.x + 1, y: p.y + 1 })
  // 옆면 아래 모서리와 대각선 앞 칸 윗면 모서리가 만나는 곳까지
  const face = (side: Point) => {
    const edge = Math.max(0, Math.min(depth, below(side)))
    return corner >= edge ? edge : Math.min((corner + edge) / 2, TILE.height / 2 + corner)
  }
  return Math.max(0, face({ x: p.x, y: p.y + 1 }), face({ x: p.x + 1, y: p.y }))
}

// 가이드가 비추는 칸의 사각형, 윗면이나 수면과 그 위에 선 것, 드러난 옆면에 같은 여백
export const guideRect = (game: GameState, p: Point) => {
  // 바닥 없는 칸은 덩굴 길이나 발판 길의 팬 구덩이
  const surface = surfaceOf(game, p)
  const floating = waterLook(game.stage, p, (q) => waterLevel(game, q)).depth > 0
  const center = toScreen(p, 0)
  const y = center.y - (surface ?? 0)
  const reach = reachOf(game, p, floating)
  const x = center.x - TILE.width / 2 - GUIDE_MARGIN
  const width = TILE.width + GUIDE_MARGIN * 2

  // 얼음 돌 칸은 돌을 가운데에 두고 윗면까지만, 옆면 제외
  if (has(game.stones, p)) {
    const mid = y + (halfTop(TILE.width * STONE.steps[0].width) - reach) / 2
    const half = Math.max(mid - (y - reach), y + TILE.height / 2 - mid) + GUIDE_MARGIN
    return { x, y: mid - half, width, height: half * 2 }
  }

  const top = y - reach - GUIDE_MARGIN
  const drop =
    surface === null ? dropOf(game, p, 0, PIT_FLOOR) : dropOf(game, p, surface, surface + TILE.lip)
  const bottom = y + TILE.height / 2 + drop + GUIDE_MARGIN

  return { x, y: top, width, height: bottom - top }
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
