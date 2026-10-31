import { floorTier, tierScale } from '@/components/board/view/tierView'
import type { Stage } from '@/game/types'

// 층 쌍으로 세는 높이 차와 그 이하로 보이는 단 색 차
const PAIR_RISE = 2
const PAIR_TIER = 0.5

const AXES = [
  [
    { x: -1, y: 0 },
    { x: 1, y: 0 },
  ],
  [
    { x: 0, y: -1 },
    { x: 0, y: 1 },
  ],
]

const at = (x: number, y: number) => `(${x},${y})`

// PRD 20월드 모양 조건으로 걸리는 칸, 높은 땅이 앞을 가린 층 쌍과 한 칸 기둥과 한 칸 홈과 레일 길이
export const shapeOf = (stage: Stage) => {
  const { heights } = stage
  const floor = (x: number, y: number) => heights[y]?.[x] ?? -1
  const scale = tierScale(stage)
  const tierPairs: string[] = []
  const pillars: string[] = []
  const grooves: string[] = []

  heights.forEach((row, y) =>
    row.forEach((h, x) => {
      if (h >= 0) {
        for (const d of [
          { x: 1, y: 0 },
          { x: 0, y: 1 },
          { x: 1, y: 1 },
        ]) {
          const g = floor(x + d.x, y + d.y)
          const flat = floorTier(g, scale) - floorTier(h, scale) <= PAIR_TIER
          if (g - h >= PAIR_RISE && flat) tierPairs.push(`${at(x, y)}-${at(x + d.x, y + d.y)}`)
        }
      }
      // 한 축으로 한 칸 폭이고 다른 축 이웃도 같은 꼴로 이어지는 칸
      const along = (thin: (px: number, py: number, axis: number) => boolean) =>
        [0, 1].some(
          (axis) =>
            thin(x, y, axis) &&
            AXES[1 - axis].some(
              (d) => floor(x + d.x, y + d.y) === h && thin(x + d.x, y + d.y, axis),
            ),
        )
      const sides = (px: number, py: number, axis: number) =>
        AXES[axis].map((d) => floor(px + d.x, py + d.y))
      const tall = (px: number, py: number, axis: number) =>
        sides(px, py, axis).every((g) => g >= 0 && floor(px, py) - g >= PAIR_RISE)
      const sunk = (px: number, py: number, axis: number) => {
        const [a, b] = sides(px, py, axis)
        return a >= 0 && a === b && floor(px, py) < a
      }
      if (h >= 0 && along(tall)) pillars.push(at(x, y))
      if (along(sunk)) grooves.push(at(x, y))
    }),
  )

  const rails = stage.entities.flatMap((e) => (e.type === 'tram' ? [e.cells.length] : []))
  return { tierPairs, pillars, grooves, rails }
}
