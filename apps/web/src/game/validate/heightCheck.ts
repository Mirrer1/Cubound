// 판 전체 높이 차와 옆 칸 높이 차의 알림 기준
const MAX_SPAN = 5
const MAX_STEP = 3

// 판을 막지 않는 높이 알림, 구덩이는 비교 제외
export const heightWarnings = (heights: number[][]): string[] => {
  const floors = heights.flat().filter((h) => h >= 0)
  if (floors.length === 0) return []

  const warnings: string[] = []
  const top = Math.max(...floors)
  const bottom = Math.min(...floors)
  if (top - bottom > MAX_SPAN) {
    warnings.push(`높이 차 ${top - bottom}층 (가장 높은 칸 ${top}, 가장 낮은 칸 ${bottom})`)
  }

  const steps = heights.flatMap((row, y) =>
    row.flatMap((h, x) =>
      [
        { x: x + 1, y },
        { x, y: y + 1 },
      ].flatMap((q) => {
        const g = heights[q.y]?.[q.x]
        return h >= 0 && g !== undefined && g >= 0 && Math.abs(h - g) > MAX_STEP
          ? [{ gap: Math.abs(h - g), text: `(${x},${y})-(${q.x},${q.y})` }]
          : []
      }),
    ),
  )
  if (steps.length > 0) {
    const worst = steps.reduce((a, b) => (b.gap > a.gap ? b : a))
    const rest = steps.length > 1 ? ` 외 ${steps.length - 1}곳` : ''
    warnings.push(`옆 칸 높이 차 ${worst.gap}층 ${worst.text}${rest}`)
  }

  return warnings
}
