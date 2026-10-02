import { type TopTilt, tiltOnTop } from '../view'
import type { CubeFrame } from './cubeFrame'
import { clamp01, lerp } from './curveFrame'
import { NO_SWAMP, type SwampTime, riseProgress, same, stepProgress } from './timeFrame'
import { ownProgress } from './windFrame'
import { TILE, isoDelta } from '@/game/iso'
import type { GameEvent, GameState, Lifted, Point, Stage } from '@/game/types'

// 심는 수의 구간, bump 동안 턱 쪽으로 기우는 큐브, pop에 튀어 travel 동안 흙 자리로 가는 씨앗
// hop은 떨어지며 솟는 높이 px, fadeFrom은 묻히며 흐려지기 시작하는 자리
export const PLANT_SEED = {
  bump: 0.45,
  pop: 0.225,
  travel: 0.4,
  hop: 8,
  fadeFrom: 0.65,
  fade: 0.35,
  small: 0.5,
}

// at 칸이 솟으며 그 위의 큐브나 상자를 올리는 층 수
export const seedLift = (events: GameEvent[], at: Point, what: Lifted) =>
  events.some((e) => e.type === 'rose' && same(e.at, at) && e.lifted.includes(what)) ? 1 : 0

// 씨앗으로 솟은 칸과 층 수, 무너지는 칸이 아닌 바닥 칸이 원본보다 높아진 만큼
export const seedLayers = (stage: Stage, heights: number[][]): Map<string, number> => {
  const layers = new Map<string, number>()
  heights.forEach((row, y) =>
    row.forEach((h, x) => {
      const origin = stage.heights[y][x]
      const crack = (stage.cracks?.[y]?.[x] ?? '.') !== '.'
      if (origin >= 0 && !crack && h > origin) layers.set(`${x}-${y}`, h - origin)
    }),
  )
  return layers
}

export interface SeedFrame {
  level: number // 그 순간 칸 윗면 높이
  land: number // 볏짚빛 층 수
  tree: number // 사라지는 나무 단계, 남은 수, 0이면 나무 없는 칸
  treeNext: number // 들어서는 나무 단계
  treeP: number // tree에서 treeNext로 바뀐 정도 0~1
  stakes: number
  stakesNext: number
  stakeP: number
  leaves: number // 솟은 땅에 남은 잎이 드러난 정도 0~1
  stalk: number // 보스 기둥 줄기 층 수
  bud: number // 봉오리가 돋은 정도 0~1
}

interface SeedLook {
  level: number
  land: number
  left: number
  leaves: number
  stalk: number
  bud: number
}

const seedLook = (state: GameState, key: string, layers: Map<string, number>): SeedLook => {
  const [x, y] = key.split('-').map(Number)
  const land = layers.get(key) ?? 0
  const left = state.planted.find((seed) => seed.x === x && seed.y === y)?.left ?? 0
  const boss = Boolean(state.stage.rules?.seedGrow)
  return {
    level: state.heights[y][x],
    land,
    left,
    leaves: land > 0 && !boss && left === 0 ? 1 : 0,
    stalk: boss ? land : 0,
    bud: boss && land > 0 && left === 0 ? 1 : 0,
  }
}

const blendSeed = (was: SeedLook, now: SeedLook, p: number): SeedFrame => ({
  level: lerp(was.level, now.level, p),
  land: lerp(was.land, now.land, p),
  tree: was.left,
  treeNext: now.left,
  treeP: p,
  stakes: was.left,
  stakesNext: now.left,
  stakeP: p,
  leaves: lerp(was.leaves, now.leaves, p),
  stalk: lerp(was.stalk, now.stalk, p),
  bud: lerp(was.bud, now.bud, p),
})

// 나무가 자라는 칸 오른쪽 모서리의 흙 자리, soil은 흙 자리가 윗면에서 솟는 높이
export const SAPLING = { spot: 0.36, soil: 2 }

// 심는 수에서 싹과 말뚝이 드러나기 시작하는 때, 씨앗이 흙 자리에 닿을 즈음
const PLANT_FROM = 0.6

export interface PlantingFrame {
  go: number // 큐브 윗면에서 흙 자리까지 간 정도 0~1
  hop: number // 떨어지는 길에서 솟은 높이 px
  scale: number
  opacity: number
}

// 심는 수에 들고 있던 씨앗이 흙 자리로 내려가 묻히는 모습, 심지 않는 수는 null
export const plantingSeed = (
  events: GameEvent[],
  t: number,
  swamp: SwampTime = NO_SWAMP,
): PlantingFrame | null => {
  if (!events.some((e) => e.type === 'planted')) return null

  const p = ownProgress(events, t, swamp)
  const q = clamp01((p - PLANT_SEED.pop) / PLANT_SEED.travel)
  const go = q * q * (3 - 2 * q)
  return {
    go,
    hop: Math.sin(Math.PI * q) * PLANT_SEED.hop,
    scale: lerp(1, PLANT_SEED.small, go),
    opacity: 1 - clamp01((p - PLANT_SEED.fadeFrom) / PLANT_SEED.fade),
  }
}

interface PlantView {
  planting: PlantingFrame | null
  cubeScreen: Point
  cubeSink: number
  cube: Pick<CubeFrame, 'lift'>
}

// 심는 수에 들고 있던 씨앗이 큐브 윗면에서 흙 자리로 내려가는 화면 자리
export const plantedSeedAt = ({ planting, cubeScreen, cubeSink, cube }: PlantView) => {
  const soilSpot = isoDelta(SAPLING.spot, -SAPLING.spot)
  return (
    planting && {
      x: cubeScreen.x + soilSpot.x * planting.go,
      y:
        lerp(
          cubeScreen.y - TILE.layer + cubeSink - cube.lift,
          cubeScreen.y + soilSpot.y - SAPLING.soil + cubeSink,
          planting.go,
        ) - planting.hop,
      scale: planting.scale,
      opacity: planting.opacity,
    }
  )
}

// 튀어 오르기 전까지는 기운 큐브 윗면에 얹힌 씨앗, 떨어지는 동안 풀리는 기울기
export const plantTiltOf = (
  planting: PlantingFrame | null,
  cube: Pick<CubeFrame, 'angle' | 'direction'>,
): TopTilt | undefined =>
  planting
    ? (u, v, z) => {
        const d = tiltOnTop(cube.direction, cube.angle)(u, v, z)
        return { x: d.x * (1 - planting.go), y: d.y * (1 - planting.go) }
      }
    : undefined

const seedKeys = (state: GameState, layers: Map<string, number>) => [
  ...layers.keys(),
  ...state.planted.map(({ x, y }) => `${x}-${y}`),
]

// 씨앗이 있거나 솟은 칸마다 이 순간의 모습, 심기와 자람은 한 수 전체, 솟기는 이동 뒤
export const seedFrames = (
  prev: GameState | null,
  game: GameState,
  events: GameEvent[],
  t: number,
  swamp: SwampTime = NO_SWAMP,
  restarting = false,
): Map<string, SeedFrame> => {
  const after = seedLayers(game.stage, game.heights)
  if (!prev || t >= 1) {
    return new Map(
      seedKeys(game, after).map((key) => {
        const look = seedLook(game, key, after)
        return [key, blendSeed(look, look, 1)]
      }),
    )
  }

  const before = seedLayers(prev.stage, prev.heights)
  const keys = new Set([...seedKeys(game, after), ...seedKeys(prev, before)])
  const step = stepProgress(events, t, swamp)
  const rise = riseProgress(events, t, swamp)
  const eventAt = (type: 'planted' | 'rose', key: string) =>
    events.some((e) => e.type === type && `${e.at.x}-${e.at.y}` === key)

  return new Map(
    [...keys].map((key) => {
      const p = restarting
        ? t * t * (3 - 2 * t)
        : eventAt('rose', key)
          ? rise
          : eventAt('planted', key)
            ? clamp01((step - PLANT_FROM) / (1 - PLANT_FROM))
            : step
      return [key, blendSeed(seedLook(prev, key, before), seedLook(game, key, after), p)]
    }),
  )
}
