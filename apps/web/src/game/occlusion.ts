import { TILE } from './iso'
import type { Point, Stage } from './types'

// 서 있는 높이 standHeight의 한 층짜리 물체를 화면에서 가리는 앞쪽 칸들
export const occludingCells = (
  heights: number[][],
  target: Point,
  standHeight: number,
  boxes: Point[] = [],
) => {
  const cells: Point[] = []

  for (let dy = 0; dy <= 2; dy++) {
    for (let dx = 0; dx <= 2; dx++) {
      if (dx + dy === 0 || Math.abs(dx - dy) > 1) continue

      const x = target.x + dx
      const y = target.y + dy
      const floor = heights[y]?.[x]
      if (floor === undefined) continue

      // 상자는 얹힌 칸을 한 층 높인 만큼 화면을 가린다
      const h = boxes.some((b) => b.x === x && b.y === y) ? floor + 1 : floor
      if (h >= standHeight + dx + dy) cells.push({ x, y })
    }
  }

  return cells
}

export type HiddenKind = 'mushroom' | 'swamp' | 'goal' | 'box' | 'ladder'

export interface Hidden {
  kind: HiddenKind
  target: Point & { h: number }
  cover: Point & { h: number }
  px: number // 앞 칸 윗면이 대상 칸 윗면을 넘어 덮는 화면 높이
}

const marked = (grid: string[] | undefined) =>
  (grid ?? []).flatMap((row, y) => [...row].flatMap((c, x) => (c === '#' ? [{ x, y }] : [])))

// 스테이지 처음 모습에서 앞쪽 높은 칸에 가리는 물체를 겹침이 큰 순서로 모은다
export const hiddenObjects = (stage: Stage): Hidden[] => {
  const { heights } = stage
  const targets: [HiddenKind, Point][] = [
    ...marked(stage.mushroom).map((p): [HiddenKind, Point] => ['mushroom', p]),
    ...marked(stage.swamp).map((p): [HiddenKind, Point] => ['swamp', p]),
    ['goal', stage.goal],
    ...stage.entities
      .filter((e) => e.type === 'box' || e.type === 'ladder')
      .map((e): [HiddenKind, Point] => [e.type as HiddenKind, { x: e.x, y: e.y }]),
  ]

  return targets
    .flatMap(([kind, o]) => {
      const oh = heights[o.y][o.x]
      return heights.flatMap((row, y) =>
        row.flatMap((ch, x) => {
          if (ch < 0 || x < o.x || y < o.y || (x === o.x && y === o.y)) return []
          const px = (ch - oh) * TILE.layer - (x + y - o.x - o.y) * (TILE.height / 2)
          return px > 0 ? [{ kind, target: { ...o, h: oh }, cover: { x, y, h: ch }, px }] : []
        }),
      )
    })
    .sort((a, b) => b.px - a.px)
}
