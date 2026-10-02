import { has } from './timeFrame'
import type { VineFrame, VineLook } from './vineFrame'
import type { Entity, GameEvent, GameState, Point, VineSpot } from '@/game/types'

// 가려지면 안 되는 상자가 메운 바닥, 길을 다시 짜는 데 쓰는 자리
// 덩굴이 메운 칸은 제외, 넣으면 긴 덩굴 앞의 칸이 줄줄이 흐려지는 탓
export const filledCells = (
  heights: number[][],
  stageHeights: number[][],
  entities: Entity[],
  vines: VineSpot[],
) => {
  const grown = entities.flatMap((e) =>
    e.type === 'vine' ? e.cells.slice(0, vines.find((v) => v.id === e.id)?.grown ?? 0) : [],
  )
  return heights.flatMap((row, y) =>
    row.flatMap((h, x) =>
      h >= 0 && stageHeights[y][x] < 0 && !has(grown, { x, y }) ? [{ x, y }] : [],
    ),
  )
}

// 상자가 한 칸 안으로 들어올 때까지 구덩이로 두는 메우는 칸, 그 뒤로는 먼저 깔리는 바닥
// 덩굴이 올 칸은 상자가 다 가라앉을 때까지 싹 달린 구덩이, 먼저 깔린 바닥이 빈칸으로 보이는 탓
export const fillingCellKey = (
  box: Point | null,
  events: GameEvent[],
  vines: Map<string, VineLook>,
) => {
  const filling = box ? events.find((e) => e.type === 'pushed' && e.result === 'filled') : undefined
  const fillingAt = filling?.type === 'pushed' ? `${filling.to.x}-${filling.to.y}` : null
  return box &&
    filling?.type === 'pushed' &&
    fillingAt &&
    (vines.has(fillingAt) || Math.hypot(box.x - filling.to.x, box.y - filling.to.y) > 1)
    ? fillingAt
    : null
}

export interface FillView {
  heights: number[][]
  before: Pick<GameState, 'heights'>
  fillingKey: string | null // 아직 구덩이로 그리는 메우는 칸
}

export const heightNow = ({ heights, before, fillingKey }: FillView, x: number, y: number) =>
  `${x}-${y}` === fillingKey ? before.heights[y][x] : heights[y]?.[x]

// 옆 칸이 바닥일 때의 구덩이 벽, 발판 길이나 판이 덜 차오른 덩굴 길 옆은 이어진 구덩이
export const wallHeight = (
  view: FillView & { vineFrame: Map<string, VineFrame>; railDirs: Map<string, string> },
  x: number,
  y: number,
) => {
  const { before, vineFrame, railDirs } = view
  const key = `${x}-${y}`
  const vine = vineFrame.get(key)
  const vinePit =
    vine !== undefined &&
    vine.kind !== 'root' &&
    ((heightNow(view, x, y) ?? -1) < 0 || (vine.kind === 'grown' && vine.rise < 1))
  return railDirs.has(key) || vinePit
    ? -1
    : Math.max(heightNow(view, x, y) ?? -1, before.heights[y]?.[x] ?? -1)
}
