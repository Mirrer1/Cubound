import { describe, expect, it } from 'vitest'

import { TAP, pullLanes } from '../view'
import {
  fadeLanes,
  sluiceLookOf,
  sluiceScene,
  stoneSlab,
  tapFronts,
  waterAtOf,
} from './sluiceFrame'
import { ridePhase } from './switchFrame'
import {
  LOCK_STAGE,
  SHUTTLE,
  SLUICE_STAGE,
  SLUICE_WHIRL_STAGE,
  STAGE,
  TIDE_STAGE,
  lastMove,
} from './testStages'
import { NO_SWAMP, SLUICE, durationOf, sluicePhase, sluiceStart } from './timeFrame'
import { createState } from '@/game/rules'
import type { GameEvent } from '@/game/types'

// 물 구간 안의 초를 이 수 진행도로
const atSeconds = (events: GameEvent[], seconds: number) => seconds / durationOf(events)

const midLevel = (events: GameEvent[]) =>
  atSeconds(events, sluiceStart(events)! + SLUICE.tap + SLUICE.level / 2)

describe('waterAtOf', () => {
  it('수위 없는 판은 판의 물 높이', () => {
    const game = createState({ ...STAGE, water: 1 })

    expect(waterAtOf(game, game, 0.5)({ x: 2, y: 0 })).toBe(1)
  })

  it('수 전후 물 높이를 진행도만큼 섞은 높이', () => {
    const { prev, game } = lastMove(SLUICE_STAGE, ['left'])
    const at = waterAtOf(prev, game, 0.25)

    expect(at({ x: 1, y: 1 })).toBeCloseTo(1.25)
    expect(at({ x: 2, y: 0 })).toBeCloseTo(1.25)
  })

  it('밀물 판도 수 전후 물 높이를 진행도만큼 섞은 높이', () => {
    const { prev, game } = lastMove(TIDE_STAGE, SHUTTLE)

    expect(waterAtOf(prev, game, 0.5)({ x: 2, y: 2 })).toBeCloseTo(1.5)
  })
})

describe('sluiceScene', () => {
  it('수위 없는 판은 받은 물길 그대로, 진행도는 다 끝난 값', () => {
    const game = createState(STAGE)
    const lanes = pullLanes(game.stage)
    const scene = sluiceScene({
      before: game,
      game,
      events: [],
      t: 0.5,
      swamp: NO_SWAMP,
      moving: true,
      dropping: false,
      lanes,
    })

    expect(scene.lanes).toBe(lanes)
    expect(scene.laneFade).toBeNull()
    expect(scene.phase).toEqual({ tap: 1, level: 1, freeze: 1, thaw: 1, slab: 1 })
  })

  it('물이 오르는 동안 새로 이어지는 물길은 수면을 따라 짙어진다', () => {
    const { prev, game, events } = lastMove(SLUICE_WHIRL_STAGE, ['left'])
    const lanes = pullLanes(game.stage, (p) => (p.y === 1 ? 2 : 1))
    const t = midLevel(events)
    const scene = sluiceScene({
      before: prev,
      game,
      events,
      t,
      swamp: NO_SWAMP,
      moving: true,
      dropping: false,
      lanes,
    })

    expect(scene.phase.level).toBeCloseTo(0.5)
    expect(scene.lanes.has('1-1')).toBe(true)
    expect(scene.laneFade?.get('1-1')).toBeCloseTo(0.5)
    expect(scene.waterAt({ x: 1, y: 1 })).toBeCloseTo(1.5)
  })

  it('재시작하면 큐브가 내려앉는 곡선으로 처음 물 높이로 돌아간다', () => {
    const { game: high } = lastMove(SLUICE_STAGE, ['left'])
    const start = createState(SLUICE_STAGE)
    const at = (t: number) =>
      sluiceScene({
        before: high,
        game: start,
        events: [],
        t,
        swamp: NO_SWAMP,
        moving: true,
        dropping: true,
        lanes: new Map(),
      }).waterAt({ x: 1, y: 1 })

    expect(at(0)).toBe(2)
    expect(at(1)).toBe(1)
    expect(at(0.3)).toBeGreaterThan(1)
    expect(at(0.3)).toBeLessThan(2)
  })
})

describe('sluiceLookOf', () => {
  const lookAt = (
    stage: typeof SLUICE_STAGE,
    directions: Parameters<typeof lastMove>[1],
    t: number,
  ) => {
    const { prev, game, events } = lastMove(stage, directions)
    const phase = sluicePhase(events, t)
    const sluice = { phase, waterAt: waterAtOf(prev, game, phase.level) }
    return sluiceLookOf(
      { before: prev, moving: t < 1, dropping: false, sluice },
      { game, events, t, swamp: NO_SWAMP },
    )
  }

  it('장치에 오른 수는 판이 눌리고 꼭지가 물 구간 앞에 열린다', () => {
    const { events } = lastMove(SLUICE_STAGE, ['left'])
    const start = sluiceStart(events)!
    const before = lookAt(SLUICE_STAGE, ['left'], atSeconds(events, start))({ x: 0, y: 0 })
    const opened = lookAt(
      SLUICE_STAGE,
      ['left'],
      atSeconds(events, start + SLUICE.tap),
    )({
      x: 0,
      y: 0,
    })

    expect(before).toMatchObject({ device: true, open: 0, plate: TAP.pressed })
    expect(opened.open).toBe(1)
  })

  it('잠기는 줄의 집은 물이 차는 만큼 잠긴다', () => {
    const stage = { ...SLUICE_STAGE, goal: { x: 1, y: 1 } }
    const { events } = lastMove(stage, ['left'])

    expect(lookAt(stage, ['left'], midLevel(events))({ x: 1, y: 1 }).sunk).toBeCloseTo(0.5)
    expect(lookAt(stage, ['left'], 1)({ x: 1, y: 1 }).sunk).toBe(1)
  })

  it('갑문 물길은 물이 오가는 동안만 흐른다', () => {
    const { events } = lastMove(LOCK_STAGE, ['down'])

    expect(lookAt(LOCK_STAGE, ['down'], midLevel(events))({ x: 3, y: 1 })).toMatchObject({
      channel: 'x',
    })
    expect(lookAt(LOCK_STAGE, ['down'], midLevel(events))({ x: 3, y: 1 }).flow).toBeGreaterThan(0.5)
    expect(lookAt(LOCK_STAGE, ['down'], 1)({ x: 3, y: 1 }).flow).toBe(0)
  })

  it('수위와 상관없는 칸은 빈 묶음', () => {
    expect(lookAt(SLUICE_STAGE, ['left'], 0.5)({ x: 2, y: 0 })).toEqual({
      device: false,
      open: 0,
      turn: 0,
      plate: 0,
      channel: null,
      flow: 0,
      sunk: 0,
    })
  })
})

describe('ridePhase 수위', () => {
  it('물이 바뀌는 수는 수면 진행도', () => {
    const { game, events } = lastMove(SLUICE_STAGE, ['left', 'down'])
    const t = midLevel(events)

    expect(ridePhase(game, events, game.player, t, NO_SWAMP)).toBeCloseTo(0.5)
    expect(ridePhase(game, events, game.player, atSeconds(events, 0.1), NO_SWAMP)).toBe(0)
  })
})

describe('fadeLanes', () => {
  it('생기거나 끊기는 몫을 곱하고 수위 없는 판은 그대로', () => {
    const shown = new Map([
      ['1-1', 1],
      ['2-1', 0.5],
    ])

    expect(fadeLanes(shown, null)).toBe(shown)
    expect([...fadeLanes(shown, new Map([['1-1', 0.4]]))]).toEqual([
      ['1-1', 0.4],
      ['2-1', 0.5],
    ])
  })
})

describe('tapFronts', () => {
  const device = { x: 0, y: 0 }

  it('장치 칸 가운데 물건 앞에 꼭지, 그 물건을 그리는 칸', () => {
    expect(tapFronts(SLUICE_STAGE, [{ x: 0, y: 0, cell: device }])).toEqual([
      { device, cell: device },
    ])
  })

  it('앞 칸 차례로 그리는 물건은 장치 칸 가운데에서 반 칸 안일 때만', () => {
    const cell = { x: 1, y: 0 }

    expect(tapFronts(SLUICE_STAGE, [{ x: 0.5, y: 0, cell }])).toEqual([{ device, cell }])
    expect(tapFronts(SLUICE_STAGE, [{ x: 0.75, y: 0, cell }])).toEqual([])
  })

  it('장치 칸 차례로 그리는 동안은 안쪽 칸으로 나가도 꼭지가 앞', () => {
    const stage = {
      ...SLUICE_STAGE,
      entities: [{ type: 'sluice' as const, x: 1, y: 1 }],
    }

    expect(tapFronts(stage, [{ x: 1, y: 0.25, cell: { x: 1, y: 1 } }])).toEqual([
      { device: { x: 1, y: 1 }, cell: { x: 1, y: 1 } },
    ])
    expect(tapFronts(stage, [{ x: 1, y: 0, cell: { x: 1, y: 1 } }])).toEqual([
      { device: { x: 1, y: 1 }, cell: { x: 1, y: 1 } },
    ])
  })

  it('여럿이면 꼭지 앞에 오는 물건 하나', () => {
    const holders = [
      { x: 1, y: 0.5, cell: { x: 1, y: 1 } },
      { x: 0, y: 0.5, cell: { x: 0, y: 1 } },
    ]

    expect(tapFronts(SLUICE_STAGE, holders)).toEqual([{ device, cell: { x: 0, y: 1 } }])
  })

  it('옆 칸에 있거나 장치가 없는 판은 앞 꼭지 없음', () => {
    expect(tapFronts(SLUICE_STAGE, [{ x: 1, y: 0, cell: { x: 1, y: 0 } }])).toEqual([])
    expect(tapFronts(STAGE, [{ x: 0, y: 0, cell: device }])).toEqual([])
  })
})

describe('stoneSlab', () => {
  const phase = { tap: 1, level: 0.25, freeze: 0, thaw: 1, slab: 0.5 }

  it('잠길 때는 수면이 반쯤 오를 때까지 먼저 얼고, 드러날 때는 둘레가 다 녹은 뒤 녹고, 그대로인 칸은 물이면 1, 땅이면 0', () => {
    const low = createState(SLUICE_STAGE)
    const { game: high } = lastMove(SLUICE_STAGE, ['left'])
    const row = { x: 1, y: 1 }
    const deep = { x: 0, y: 1 }

    expect(stoneSlab(low, high, phase, row)).toBeCloseTo(0.5)
    expect(stoneSlab(high, low, phase, row)).toBeCloseTo(0.5)
    expect(stoneSlab(high, high, phase, deep)).toBe(1)
    expect(stoneSlab(low, low, phase, row)).toBe(0)
  })
})
