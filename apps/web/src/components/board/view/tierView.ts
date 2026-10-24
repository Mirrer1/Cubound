import type { Stage } from '@/game/types'

type TierStage = Pick<
  Stage,
  'heights' | 'entities' | 'goal' | 'water' | 'ice' | 'swamp' | 'cracks' | 'fire'
>

// 맨바닥으로 그리는 칸, 물에 잠긴 칸과 제 색으로 칠하는 칸은 제외
const bareFloor = (stage: TierStage, x: number, y: number, h: number) => {
  const mark = (layer?: string[]) => layer?.[y]?.[x] ?? '.'
  return (
    h >= 0 &&
    h >= (stage.water ?? 0) &&
    !(stage.goal.x === x && stage.goal.y === y) &&
    mark(stage.ice) !== '#' &&
    mark(stage.swamp) !== '#' &&
    mark(stage.cracks) === '.' &&
    !'#=@'.includes(mark(stage.fire)) &&
    !stage.entities.some((e) => (e.type === 'lift' || e.type === 'warp') && e.x === x && e.y === y)
  )
}

// 맨바닥 칸이 가장 많은 높이, 그만큼 넓은 높이가 여럿이면 그중 가장 낮은 쪽
export const baseOf = (stage: TierStage) => tierScale(stage).find(([, tier]) => tier === 1)![0]

// 0.1은 단으로 세는 높이의 최소 칸 비율, 0.8은 가장 많은 높이에 견줘 기준이 되는 칸 비율
const MAIN_SHARE = 0.1
const BASE_SHARE = 0.8

// 단으로 세는 높이와 그 단, 기준 높이가 1단이고 위로 한 단씩, 아래로 반 단씩 두 단까지
// 사이에 빈 층이 있어도 한 단, 칸이 적은 높이는 단으로 세지 않는 경우
export const tierScale = (stage: TierStage): [number, number][] => {
  const counts = new Map<number, number>()
  stage.heights.forEach((row, y) =>
    row.forEach((h, x) => {
      if (bareFloor(stage, x, y, h)) counts.set(h, (counts.get(h) ?? 0) + 1)
    }),
  )
  const total = [...counts.values()].reduce((sum, n) => sum + n, 0)
  const most = Math.max(...counts.values())
  const base = Math.min(...[...counts].filter(([, n]) => n >= most * BASE_SHARE).map(([h]) => h))
  const main = [...counts]
    .filter(([h, n]) => h === base || n >= total * MAIN_SHARE)
    .map(([h]) => h)
    .sort((p, q) => p - q)
  const at = main.indexOf(base)
  return main.map((h, i) => [h, i >= at ? Math.min(8, 1 + i - at) : Math.max(0, 1 - (at - i) / 2)])
}

// 단으로 세는 높이 사이는 그 사이를 고르게 나눈 소수 단, 맨 위와 맨 아래 밖은 한 층에 한 단과 반 단
export const floorTier = (h: number, scale: [number, number][]) => {
  const [lowH, lowT] = scale[0]
  const [topH, topT] = scale[scale.length - 1]
  if (h >= topH) return Math.min(8, topT + (h - topH))
  if (h <= lowH) return Math.max(0, lowT - (lowH - h) / 2)
  const i = scale.findIndex(([sh]) => sh > h)
  const [h0, t0] = scale[i - 1]
  const [h1, t1] = scale[i]
  return t0 + ((h - h0) / (h1 - h0)) * (t1 - t0)
}

// 소수 단은 위아래 단 색을 섞은 색, 시안 기준 oklab
export const floorFaces = (tier: number, parity: boolean) => {
  if (tier < 1) {
    const light = (name: string) =>
      `color-mix(in oklab, var(--color-floor-1-${name}), var(--color-surface) ${(1 - tier) * (name.startsWith('top') ? 30 : 12)}%)`
    return {
      top: light(parity ? 'top-alt' : 'top'),
      left: light('left'),
      right: light('right'),
    }
  }
  const low = Math.floor(tier)
  const mix = tier - low
  const face = (name: string) =>
    mix === 0
      ? `var(--color-floor-${low}-${name})`
      : `color-mix(in oklab, var(--color-floor-${low}-${name}), var(--color-floor-${low + 1}-${name}) ${mix * 100}%)`
  return { top: face(parity ? 'top-alt' : 'top'), left: face('left'), right: face('right') }
}
