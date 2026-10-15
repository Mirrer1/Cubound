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

export const lowestOf = (stage: TierStage) =>
  Math.min(...stage.heights.flatMap((row, y) => row.filter((h, x) => bareFloor(stage, x, y, h))))

export const floorTier = (h: number, lowest: number) => Math.min(8, Math.max(1, h - lowest + 1))

// 소수 단은 위아래 단 색을 섞은 색, 시안 기준 oklab
export const floorFaces = (tier: number, parity: boolean) => {
  const low = Math.floor(tier)
  const mix = tier - low
  const face = (name: string) =>
    mix === 0
      ? `var(--color-floor-${low}-${name})`
      : `color-mix(in oklab, var(--color-floor-${low}-${name}), var(--color-floor-${low + 1}-${name}) ${mix * 100}%)`
  return { top: face(parity ? 'top-alt' : 'top'), left: face('left'), right: face('right') }
}
