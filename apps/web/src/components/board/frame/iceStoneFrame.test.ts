import { describe, expect, it } from 'vitest'

import { ICE, STONE, pullLanes } from '../view'
import {
  floatBase,
  frozenCells,
  iceCovers,
  iceCoversAt,
  icePhase,
  iceSink,
  laneShown,
  meltDisplay,
  restartStones,
  stoneFrames,
  thawingBoxes,
} from './iceStoneFrame'
import { STONE_STAGE, lastMove } from './testStages'
import { FREEZE_SECONDS, MELT_SECONDS, durationOf, moveSeconds } from './timeFrame'
import { TILE, toScreen } from '@/game/iso'
import { createState } from '@/game/rules'
import type { Entity, Stage } from '@/game/types'

const stone = (x: number, y: number): Entity => ({ type: 'iceStone', x, y })
const box = (x: number, y: number): Entity => ({ type: 'box', x, y })
const withEntities = (entities: Entity[], rest: Partial<Stage> = {}): Stage => ({
  ...STONE_STAGE,
  ...rest,
  entities,
})
const NO_SWAMP = { lead: 0, tail: 0 }
// 이동 연출의 그 초에 해당하는 진행도
const at = (events: Parameters<typeof durationOf>[0], seconds: number) =>
  seconds / durationOf(events)

describe('frozenCells', () => {
  it('돌 둘레 네 칸의 물 칸이 얼고 그 칸에서 돌 쪽 방향을 단다', () => {
    const cells = frozenCells(createState(withEntities([stone(3, 2)])))

    expect([...cells.entries()].sort()).toEqual([
      ['2-2', 'right'],
      ['3-3', 'up'],
      ['4-2', 'left'],
    ])
  })

  it('소용돌이 칸은 얼지 않는다', () => {
    const cells = frozenCells(
      createState(withEntities([stone(3, 2), { type: 'whirlpool', x: 4, y: 2 }])),
    )

    expect(cells.has('4-2')).toBe(false)
  })
})

describe('iceCovers', () => {
  it('가만히 있으면 언 칸은 다 덮인다', () => {
    const game = createState(STONE_STAGE)
    const covers = iceCovers(game, game, 1)

    expect(covers.get('2-2')).toEqual({ cover: 1, from: 'up' })
  })

  it('새로 언 칸은 돌 쪽에서 덮여 가고 녹는 칸은 옛 돌 쪽으로 물러난다', () => {
    const { prev, game } = lastMove(withEntities([stone(2, 3)], { start: { x: 1, y: 3 } }), [
      'right',
    ])
    const covers = iceCovers(prev, game, 0.25)

    expect(covers.get('4-3')).toEqual({ cover: 0.25, from: 'left' })
    expect(covers.get('2-2')).toEqual({ cover: 0.75, from: 'down' })
    expect(covers.get('2-3')?.cover).toBe(1)
  })

  it('돌이 막 들어선 칸은 녹는 연출 없이 그 수가 끝날 때까지 덮인 채이다', () => {
    const { prev, game } = lastMove(STONE_STAGE, ['down'])

    expect(iceCovers(prev, game, 0.5).get('2-2')).toEqual({ cover: 1, from: 'up' })
    expect(iceCovers(game, game, 1).has('2-2')).toBe(false)
  })
})

describe('iceCoversAt', () => {
  it('물에 밀자마자 끌리는 돌은 먼저 들어간 자리 둘레가 얼고 끌려가며 얼음이 같이 옮겨 간다', () => {
    const stage = withEntities([stone(2, 1), { type: 'whirlpool', x: 4, y: 2 }])
    const { prev, game, events } = lastMove(stage, ['down'])
    const pulling = iceCoversAt(prev, game, events, at(events, 0.3), NO_SWAMP)
    const half = iceCoversAt(prev, game, events, at(events, 0.45), NO_SWAMP)

    expect(pulling.get('3-2')).toEqual({ cover: 1, from: 'left' })
    expect(pulling.get('2-3')?.cover).toBe(1)
    expect(half.get('3-2')?.cover).toBe(1)
    expect(half.get('2-3')?.cover).toBeLessThan(1)
    const end = [...iceCoversAt(prev, game, events, 1, NO_SWAMP)].filter(
      ([key, c]) => c.cover > 0 && key !== '3-2',
    )
    expect(new Map(end)).toEqual(iceCovers(game, game, 1))
  })
})

describe('iceCoversAt 물에 들어가는 돌', () => {
  it('돌이 물로 내려앉기 시작할 때부터 둘레가 얼고 그 전에는 안 언다', () => {
    const { prev, game, events } = lastMove(STONE_STAGE, ['down'])
    const early = iceCoversAt(prev, game, events, at(events, 0.1), NO_SWAMP)
    const late = iceCoversAt(prev, game, events, at(events, 0.55), NO_SWAMP)

    expect(early.get('3-2')?.cover).toBe(0)
    expect(late.get('3-2')?.cover).toBeGreaterThan(0.5)
  })

  it('얼음바닥을 미끄러지다 물에 들어가는 돌은 미끄러지는 동안 새 둘레가 안 언다', () => {
    const stage: Stage = {
      ...STONE_STAGE,
      heights: [
        [1, 1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1, 1],
        [1, 1, 1, 1, 0, 1],
        [1, 1, 1, 1, 0, 1],
        [1, 1, 1, 1, 1, 1],
      ],
      ice: ['......', '......', '.###..', '......', '......'],
      start: { x: 0, y: 2 },
      entities: [stone(1, 2)],
    }
    const { prev, game, events } = lastMove(stage, ['right'])
    const sliding = iceCoversAt(prev, game, events, at(events, 0.3), NO_SWAMP)

    expect(game.stones).toEqual([{ x: 4, y: 2 }])
    expect(sliding.get('4-3')?.cover).toBe(0)
  })
})

describe('icePhase', () => {
  it('얼음이 바뀌는 때는 돌이 밀려 가는 동안이다', () => {
    const { events } = lastMove(STONE_STAGE, ['down'])

    expect(icePhase(events, 0, NO_SWAMP)).toBe(0)
    expect(icePhase(events, 1, NO_SWAMP)).toBe(1)
  })

  it('뜬 돌을 한 칸 밀면 돌이 다 간 뒤에도 얼음이 이어서 덮인다', () => {
    const { events } = lastMove(withEntities([stone(2, 3)], { start: { x: 1, y: 3 } }), ['right'])

    expect(durationOf(events)).toBeCloseTo(FREEZE_SECONDS)
    expect(icePhase(events, at(events, 0.26), NO_SWAMP)).toBeLessThan(0.9)
    expect(icePhase(events, 1, NO_SWAMP)).toBe(1)
  })

  it('물에 밀자마자 끌리는 돌의 얼음은 끌려가기 시작할 때부터 바뀐다', () => {
    const stage = withEntities([stone(2, 1), { type: 'whirlpool', x: 4, y: 2 }])
    const { events } = lastMove(stage, ['down'])

    expect(icePhase(events, at(events, 0.2), NO_SWAMP)).toBe(0)
    expect(icePhase(events, 1, NO_SWAMP)).toBe(1)
  })

  it('녹아 사라지는 수는 이동이 끝난 뒤 녹는 동안이다', () => {
    const { events } = lastMove({ ...STONE_STAGE, rules: { melt: 1 } }, ['down', 'left'])
    const start = moveSeconds(events, NO_SWAMP)

    expect(icePhase(events, at(events, start), NO_SWAMP)).toBe(0)
    expect(icePhase(events, at(events, start + MELT_SECONDS / 2), NO_SWAMP)).toBeCloseTo(0.5)
  })
})

describe('stoneFrames', () => {
  it('물로 밀린 돌은 내려앉아 얼음 판 위에 서고 다 앉으면 칸 그림 몫이다', () => {
    const { prev, game, events } = lastMove(STONE_STAGE, ['down'])
    const start = stoneFrames({ prev, game, events, t: 0, swamp: NO_SWAMP })[0]
    const end = stoneFrames({ prev, game, events, t: 0.999, swamp: NO_SWAMP })[0]

    expect(start.y).toBeCloseTo(toScreen({ x: 2, y: 1 }, 1).y)
    expect(start.cut).toBe(0)
    expect(end.y).toBeCloseTo(toScreen({ x: 2, y: 2 }, floatBase(1)).y, 0)
    expect(end.cut).toBeCloseTo(STONE.floatCut, 0)
    expect(stoneFrames({ prev, game, events, t: 1, swamp: NO_SWAMP })).toEqual([])
  })

  it('물에 밀자마자 끌리는 돌은 밀려 가는 동안에도 끌려갈 칸을 맡아 그 칸에 멈춘 돌을 따로 그리지 않는다', () => {
    const stage = withEntities([stone(2, 1), { type: 'whirlpool', x: 4, y: 2 }])
    const { prev, game, events } = lastMove(stage, ['down'])

    expect(game.stones).toEqual([{ x: 3, y: 2 }])
    for (const t of [0.05, 0.3, 0.6, 0.95]) {
      const frames = stoneFrames({ prev, game, events, t, swamp: NO_SWAMP })
      expect(frames).toHaveLength(1)
      expect(frames[0].to).toEqual({ x: 3, y: 2 })
    }
  })

  it('물에 뜬 돌을 밀면 한 칸 미끄러지며 뒤에 물테가 남는다', () => {
    const { prev, game, events } = lastMove(
      withEntities([stone(2, 3)], { start: { x: 1, y: 3 } }),
      ['right'],
    )
    const mid = stoneFrames({ prev, game, events, t: 0.5, swamp: NO_SWAMP })[0]

    expect(mid.to).toEqual({ x: 3, y: 3 })
    expect(mid.slab).toBe(1)
    expect(mid.wake.length).toBeGreaterThan(0)
    expect(mid.bare).toBe(true)
  })

  it('녹는 돌은 작아지며 잠기고 끝에 고리 하나가 남는다', () => {
    const { prev, game, events } = lastMove({ ...STONE_STAGE, rules: { melt: 1 } }, [
      'down',
      'left',
    ])
    const start = moveSeconds(events, NO_SWAMP)
    const half = stoneFrames({
      prev,
      game,
      events,
      t: at(events, start + MELT_SECONDS / 2),
      swamp: NO_SWAMP,
    })[0]
    const late = stoneFrames({
      prev,
      game,
      events,
      t: at(events, start + MELT_SECONDS * 0.9),
      swamp: NO_SWAMP,
    })[0]

    expect(half.scale).toBeCloseTo(0.75)
    expect(half.cut).toBeCloseTo(STONE.floatCut + STONE.meltCut / 2)
    expect(late.ring).not.toBeNull()
  })
})

describe('thawingBoxes', () => {
  it('녹은 칸의 언 칸 위 상자는 내려앉아 뜬 배가 된다', () => {
    // (2,1) 돌이 얼린 (2,2) 위로 (1,2) 상자를 밀어 올리고 돌을 옆으로 밀어 녹이는 판
    const stage = withEntities([stone(2, 1), box(1, 2)], { start: { x: 0, y: 2 } })
    const { prev, game } = lastMove(stage, ['right', 'up', 'right'])
    const start = thawingBoxes(prev, game, 0)
    const end = thawingBoxes(prev, game, 1)

    expect(start).toMatchObject([{ to: { x: 2, y: 2 }, level: floatBase(1), shown: TILE.layer }])
    expect(end[0].level).toBeCloseTo(0)
  })
})

describe('iceSink', () => {
  it('언 칸에 선 큐브는 얼음 판이 땅보다 낮은 만큼 내려앉는다', () => {
    const game = createState(STONE_STAGE)
    const covers = iceCovers(game, game, 1)

    expect(iceSink(covers, game, 2, 2)).toBe(ICE.below)
    expect(iceSink(covers, game, 2, 1.5)).toBe(ICE.below / 2)
    expect(iceSink(covers, game, 0, 0)).toBe(0)
  })
})

describe('laneShown', () => {
  // (4,2) 소용돌이가 왼쪽 줄 (3,2), (2,2)를 끄는 판
  const whirl = (entities: Entity[]) =>
    withEntities([{ type: 'whirlpool', x: 4, y: 2 }, ...entities])

  it('줄 밖 돌이 얼린 칸 너머의 물길 띠는 끊긴다', () => {
    const stage = whirl([stone(3, 1)])
    const game = createState(stage)

    expect(laneShown(pullLanes(stage), game, game, 1).get('2-2')).toBe(0)
    expect(laneShown(pullLanes(stage), game, game, 1).get('3-2')).toBe(1)
  })

  it('줄 안에 뜬 돌의 제 얼음은 띠를 끊지 않는다', () => {
    const stage = whirl([stone(2, 2)])
    const game = createState(stage)

    expect(laneShown(pullLanes(stage), game, game, 1).get('2-2')).toBe(1)
  })
})

describe('meltDisplay', () => {
  const MELT_STAGE = { ...STONE_STAGE, rules: { melt: 2 } }

  it('녹는 판이 아니면 숫자가 없고 뜬 돌이 없으면 판 숫자를 흐리게 보인다', () => {
    expect(meltDisplay(createState(STONE_STAGE))).toBeNull()
    expect(meltDisplay(createState(MELT_STAGE))).toEqual({
      count: 2,
      faint: true,
      edge: false,
      holding: false,
    })
  })

  it('1과 0은 곧 녹는 숫자이고 둘레에 서서 버티는 0은 따로 알린다', () => {
    const one = lastMove(MELT_STAGE, ['down', 'right']).game
    const held = lastMove(MELT_STAGE, ['down', 'right', 'down']).game

    expect(meltDisplay(one)).toMatchObject({ count: 1, faint: false, edge: true, holding: false })
    expect(meltDisplay(held)).toMatchObject({ count: 0, edge: true, holding: true })
  })
})

describe('restartStones', () => {
  it('재시작하면 얼음 돌도 상자처럼 처음 자리 위에서 내려앉는다', () => {
    const game = createState(withEntities([stone(2, 1), stone(4, 3)]))
    const start = restartStones(game, 0)
    const end = restartStones(game, 1)

    expect(start.map((frame) => frame.to)).toEqual([
      { x: 2, y: 1 },
      { x: 4, y: 3 },
    ])
    expect(start[0].y).toBeLessThan(end[0].y)
    expect(end[0].y).toBeCloseTo(toScreen({ x: 2, y: 1 }, 1).y)
    expect(end[1].y).toBeCloseTo(toScreen({ x: 4, y: 3 }, floatBase(1)).y)
    expect(end[1].slab).toBe(1)
    expect(end[0].opacity).toBe(1)
  })
})
