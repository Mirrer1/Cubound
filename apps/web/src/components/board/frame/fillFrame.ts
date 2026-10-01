import { has } from './timeFrame'
import type { VineFrame, VineLook } from './vineFrame'
import type { Entity, GameEvent, GameState, Point, VineSpot } from '@/game/types'

// 상자가 구덩이를 메워 생긴 바닥. 길을 다시 짜는 데 쓰는 자리라 가려지면 안 된다.
// 덩굴이 메운 칸은 판을 짤 때 보이게 두어서 빼고, 넣으면 긴 덩굴 앞의 칸이 줄줄이 흐려진다
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

// 상자가 메우는 구덩이는 상자가 한 칸 안으로 들어올 때까지 구덩이로 두고 그 뒤로는 바닥이 먼저 깔린다.
// 덩굴이 올 칸은 먼저 깔린 바닥이 빈칸으로 보여서 상자가 다 가라앉을 때까지 싹 달린 구덩이로 둔다
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

// 옆 칸이 바닥이면 구덩이 벽을 세운다. 옆 칸이 발판 길이나 판이 덜 차오른 덩굴 길이면 구덩이가 이어져 벽이 없다
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
