import { TILE } from './iso'
import type { GameState, Point, Stage } from './types'

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

      // 높은 칸에 얹힌 상자는 한 층 높인 높이, 같은 높이 상자는 옆면만 가려 제외
      const raised = floor > standHeight && boxes.some((b) => b.x === x && b.y === y)
      const h = raised ? floor + 1 : floor
      if (h >= standHeight + dx + dy) cells.push({ x, y })
    }
  }

  return cells
}

const same = (a: Point, b: Point) => a.x === b.x && a.y === b.y

export const fadedCells = (
  shown: number[][],
  cubeCell: Point,
  cubeLevel: number,
  game: GameState,
  filled: Point[],
) => {
  const { boxes, leaningLadders, player } = game
  return [
    ...occludingCells(shown, cubeCell, cubeLevel, boxes),
    // 큐브에서 멀리 떨어져 저 혼자 벽에 묻히는 상자와 메운 바닥
    ...boxes.flatMap((b, i) =>
      occludingCells(
        shown,
        b,
        shown[b.y][b.x] + 1,
        boxes.filter((_, j) => j !== i),
      ),
    ),
    ...filled.flatMap((p) => occludingCells(shown, p, shown[p.y][p.x], boxes)),
    // 큐브에서 멀면 저 혼자 벽에 묻히는 씨앗과 심은 칸의 나무와 말뚝
    ...[...game.seeds, ...game.planted].flatMap((p) =>
      occludingCells(shown, p, shown[p.y][p.x], boxes),
    ),
    ...leaningLadders
      .filter((l) => (l.direction === 'right' || l.direction === 'down') && same(l, player))
      .flatMap((l) => occludingCells(shown, l, shown[l.y][l.x], boxes)),
  ]
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

// 스테이지 처음 모습에서 앞쪽 높은 칸에 가리는 물체, 겹침이 큰 순서
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
