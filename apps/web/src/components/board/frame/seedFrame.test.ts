import { describe, expect, it } from 'vitest'

import { tiltOnTop } from '../cube'
import {
  type PlantingFrame,
  SAPLING,
  plantTiltOf,
  plantedSeedAt,
  plantingSeed,
  seedFrames,
  seedLayers,
} from './seedFrame'
import { PLANT, RIDE, SEED_AT, SEED_STAGE, lastMove } from './testStages'
import { TILE, isoDelta } from '@/game/iso'
import { createState } from '@/game/rules'
import type { GameState, Stage } from '@/game/types'

describe('seedLayers', () => {
  // (1, 0)은 기본 바닥, (2, 0)은 구덩이, (3, 0)은 무너지는 칸
  const SEED_FIELD: Stage = {
    version: 1,
    id: 'test-seed-layers',
    heights: [[0, 0, -1, 0, 1]],
    cracks: ['...2.'],
    start: { x: 0, y: 0 },
    goal: { x: 4, y: 0 },
    entities: [],
  }

  it('스테이지 원본보다 높아진 기본 바닥 칸을 솟은 층 수로 모은다', () => {
    const layers = seedLayers(SEED_FIELD, [[0, 2, -1, 0, 1]])

    expect([...layers]).toEqual([['1-0', 2]])
  })

  it('원래 높은 칸 위에 솟은 것도 원본과의 차이만 센다', () => {
    const layers = seedLayers(SEED_FIELD, [[0, 0, -1, 0, 3]])

    expect(layers.get('4-0')).toBe(2)
  })

  it('상자나 덩굴이 메운 구덩이는 세지 않는다', () => {
    expect(seedLayers(SEED_FIELD, [[0, 0, 0, 0, 1]]).size).toBe(0)
    expect(seedLayers(SEED_FIELD, [[0, 0, 1, 0, 1]]).size).toBe(0)
  })

  it('무너지는 칸은 무너졌다가 원본보다 높게 메워져도 세지 않는다', () => {
    expect(seedLayers(SEED_FIELD, [[0, 0, -1, -1, 1]]).size).toBe(0)
    expect(seedLayers(SEED_FIELD, [[0, 0, -1, 1, 1]]).size).toBe(0)
  })

  it('높이가 그대로면 빈 목록이다', () => {
    expect(seedLayers(SEED_FIELD, SEED_FIELD.heights).size).toBe(0)
  })
})

const SEED_KEY = '2-1'

describe('seedFrames', () => {
  const frameAt = (moves: ReturnType<typeof lastMove>, t: number, restarting = false) =>
    seedFrames(moves.prev, moves.game, moves.events, t, undefined, restarting).get(SEED_KEY)

  it('심는 수에 나무와 말뚝 넷이 떨어진 씨앗이 흙 자리에 닿을 즈음부터 나타난다', () => {
    const moves = lastMove(SEED_STAGE, PLANT)

    expect(frameAt(moves, 0)).toMatchObject({ tree: 0, treeNext: 4, treeP: 0, stakesNext: 4 })
    expect(frameAt(moves, 0.5)?.treeP).toBe(0)
    expect(frameAt(moves, 0.8)?.treeP).toBeGreaterThan(0)
    expect(frameAt(moves, 0.8)?.treeP).toBeLessThan(1)
    expect(frameAt(moves, 1)).toMatchObject({ tree: 4, treeNext: 4, treeP: 1, stakes: 4 })
  })

  it('한 수가 지나면 나무가 다음 단계로 자라고 말뚝이 하나 준다', () => {
    const moves = lastMove(SEED_STAGE, [...PLANT, 'left'])
    const mid = frameAt(moves, 0.5)

    expect(mid).toMatchObject({ tree: 4, treeNext: 3, stakes: 4, stakesNext: 3 })
    expect(mid?.treeP).toBeCloseTo(0.5)
    expect(mid?.stakeP).toBeCloseTo(0.5)
  })

  it('솟는 칸은 이동이 끝날 때까지 제 높이에 있다가 솟으며 잎이 남는다', () => {
    const moves = lastMove(SEED_STAGE, RIDE)

    expect(frameAt(moves, 0.4)).toMatchObject({ level: 0, land: 0, leaves: 0, tree: 1, stakes: 1 })
    expect(frameAt(moves, 0.4)?.treeP).toBe(0)
    expect(frameAt(moves, 0.7)?.level).toBeGreaterThan(0)
    expect(frameAt(moves, 0.7)?.level).toBeLessThan(1)
    expect(frameAt(moves, 1)).toMatchObject({ level: 1, land: 1, leaves: 1, tree: 0, stakes: 0 })
  })

  it('콩나무는 솟으며 줄기가 한 층 늘고 새 싹과 말뚝 넷이 선다', () => {
    const moves = lastMove({ ...SEED_STAGE, rules: { seedGrow: true } }, RIDE)

    expect(frameAt(moves, 0.4)).toMatchObject({ stalk: 0, tree: 1, treeNext: 4, treeP: 0 })
    expect(frameAt(moves, 1)).toMatchObject({
      stalk: 1,
      tree: 4,
      stakes: 4,
      leaves: 0,
      bud: 0,
    })
  })

  it('콩나무가 세 층에서 멈추면 봉오리가 돋고 말뚝이 안 선다', () => {
    const stage: Stage = { ...SEED_STAGE, rules: { seedGrow: true } }
    const from: GameState = {
      ...createState(stage),
      heights: [stage.heights[0], [0, 0, 2, 1, 0, 0], stage.heights[2]],
      player: SEED_AT,
      seeds: [],
      planted: [{ ...SEED_AT, left: 1, rises: 2 }],
    }
    const moves = lastMove(stage, ['right'], from)

    expect(moves.events).toContainEqual(expect.objectContaining({ type: 'rose', growing: false }))
    expect(frameAt(moves, 1)).toMatchObject({ level: 3, stalk: 3, bud: 1, tree: 0, stakes: 0 })
  })

  it('재시작하면 솟은 칸이 제 높이로 내려가고 나무와 말뚝이 사라진다', () => {
    const risen = lastMove(SEED_STAGE, [...PLANT, 'left', 'right', 'left', 'right', 'left'])
    const moves = { prev: risen.game, game: createState(SEED_STAGE), events: [] }

    expect(frameAt(moves, 0, true)).toMatchObject({ level: 1, land: 1 })
    expect(frameAt(moves, 0.99, true)?.level).toBeCloseTo(0, 2)
    expect(frameAt(moves, 0.99, true)?.leaves).toBeCloseTo(0, 2)
    expect(frameAt(moves, 1, true)).toBeUndefined()
  })

  it('움직이지 않으면 지금 상태를 그대로 그린다', () => {
    const { game } = lastMove(SEED_STAGE, [...PLANT, 'left'])

    expect(seedFrames(null, game, [], 1).get(SEED_KEY)).toMatchObject({
      level: 0,
      tree: 3,
      treeNext: 3,
      stakes: 3,
      stakesNext: 3,
    })
  })
})

describe('plantingSeed', () => {
  it('심는 수에만 씨앗이 흙 자리로 내려가 흐려지며 묻힌다', () => {
    const { events } = lastMove(SEED_STAGE, PLANT)

    expect(plantingSeed(events, 0)).toMatchObject({ go: 0, scale: 1, opacity: 1 })
    expect(plantingSeed(events, 0.5)?.go).toBeGreaterThan(0)
    expect(plantingSeed(events, 1)).toMatchObject({ go: 1, opacity: 0 })
    expect(plantingSeed(lastMove(SEED_STAGE, [...PLANT, 'left']).events, 0.5)).toBeNull()
  })

  it('큐브가 턱 쪽으로 가장 기운 때까지 씨앗은 윗면에 있다가 그때 튀어 떨어진다', () => {
    const { events } = lastMove(SEED_STAGE, PLANT)

    expect(plantingSeed(events, 0.2)?.go).toBe(0)
    expect(plantingSeed(events, 0.3)?.go).toBeGreaterThan(0)
    expect(plantingSeed(events, 0.5)?.hop).toBeGreaterThan(0)
    expect(plantingSeed(events, 0)?.hop).toBeCloseTo(0)
    expect(plantingSeed(events, 1)?.hop).toBeCloseTo(0)
  })
})

describe('심는 씨앗', () => {
  const view = (planting: PlantingFrame | null) => ({
    planting,
    cubeScreen: { x: 10, y: 100 },
    cubeSink: 4,
    cube: { lift: 6 },
  })
  const frame = (go: number): PlantingFrame => ({ go, hop: 3, scale: 0.8, opacity: 0.5 })
  const soil = isoDelta(SAPLING.spot, -SAPLING.spot)

  it('plantedSeedAt은 심는 수가 아니면 없다', () => {
    expect(plantedSeedAt(view(null))).toBeNull()
  })

  it('plantedSeedAt은 큐브 윗면에서 떨어지는 길만큼 솟은 채 출발한다', () => {
    expect(plantedSeedAt(view(frame(0)))).toEqual({
      x: 10,
      y: 100 - TILE.layer + 4 - 6 - 3,
      scale: 0.8,
      opacity: 0.5,
    })
  })

  it('plantedSeedAt은 다 가면 그 칸의 흙 자리에 닿는다', () => {
    const seed = plantedSeedAt(view(frame(1)))

    expect(seed?.x).toBeCloseTo(10 + soil.x)
    expect(seed?.y).toBeCloseTo(100 + soil.y - SAPLING.soil + 4 - 3)
  })

  it('plantTiltOf는 출발할 때 큐브 윗면과 같이 기울고 다 가면 기울기를 벗는다', () => {
    const cube = { angle: 0.3, direction: 'right' as const }
    const start = plantTiltOf(frame(0), cube)?.(1, 2, 3)
    const tilted = tiltOnTop('right', 0.3)(1, 2, 3)
    const done = plantTiltOf(frame(1), cube)?.(1, 2, 3)

    expect(start?.x).toBeCloseTo(tilted.x)
    expect(start?.y).toBeCloseTo(tilted.y)
    expect(done?.x).toBeCloseTo(0)
    expect(done?.y).toBeCloseTo(0)
  })

  it('plantTiltOf는 심는 수가 아니면 없다', () => {
    expect(plantTiltOf(null, { angle: 0.3, direction: 'right' })).toBeUndefined()
  })
})
