import { describe, expect, it } from 'vitest'

import { ICE, STONE, pullLanes } from '../view'
import { playerFrame } from './cubeFrame'
import {
  floatBase,
  frostGround,
  frostPatches,
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
import { SECONDS } from './pathFrame'
import { SLUICE_ICE_STAGE, SLUICE_WHIRL_STAGE, STONE_STAGE, lastMove } from './testStages'
import {
  FREEZE_SECONDS,
  MELT_SECONDS,
  PULL_SECONDS,
  SLUICE,
  durationOf,
  moveSeconds,
  pullStart,
  sluiceStart,
} from './timeFrame'
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

    expect(covers.get('2-2')).toEqual({ cover: 1, from: 'up', gloss: 1 })
  })

  it('새로 언 칸은 돌 쪽에서 덮여 가고 녹는 칸은 옛 돌 쪽으로 물러난다', () => {
    const { prev, game } = lastMove(withEntities([stone(2, 3)], { start: { x: 1, y: 3 } }), [
      'right',
    ])
    const covers = iceCovers(prev, game, 0.25)

    expect(covers.get('4-3')).toEqual({ cover: 0.25, from: 'left', gloss: 0 })
    expect(covers.get('2-2')).toEqual({ cover: 0.75, from: 'down', gloss: 0 })
    expect(covers.get('2-3')?.cover).toBe(1)
  })

  it('반짝임 줄은 새로 언 칸과 돌이 떠난 칸에서 얼음 연출 끝 무렵 짙어지고 녹는 칸에서는 수가 시작하자마자 없다', () => {
    const { prev, game } = lastMove(withEntities([stone(2, 3)], { start: { x: 1, y: 3 } }), [
      'right',
    ])
    const covers = iceCovers(prev, game, 0.9, 0)

    expect(iceCovers(prev, game, 0.8, 0).get('4-3')?.gloss).toBe(0)
    expect(covers.get('4-3')?.gloss).toBeCloseTo(0.5)
    expect(covers.get('2-2')).toEqual({ cover: 1, from: 'down', gloss: 0 })
    expect(iceCovers(prev, game, 0.8, 0).get('2-3')).toMatchObject({ cover: 1, gloss: 0 })
    expect(covers.get('2-3')?.gloss).toBeCloseTo(0.5)
  })

  it('돌이 막 들어선 칸은 녹는 연출 없이 그 수가 끝날 때까지 덮인 채이다', () => {
    const { prev, game } = lastMove(STONE_STAGE, ['down'])

    expect(iceCovers(prev, game, 0.5).get('2-2')).toEqual({ cover: 1, from: 'up', gloss: 1 })
    expect(iceCovers(game, game, 1).has('2-2')).toBe(false)
  })
})

describe('iceCoversAt', () => {
  it('물에 밀자마자 끌리는 돌은 먼저 들어간 자리 둘레가 얼고 끌려가며 얼음이 같이 옮겨 간다', () => {
    const stage = withEntities([stone(2, 1), { type: 'whirlpool', x: 4, y: 2 }])
    const { prev, game, events } = lastMove(stage, ['down'])
    const pulling = iceCoversAt(prev, game, events, at(events, 0.6), NO_SWAMP)
    const half = iceCoversAt(prev, game, events, at(events, 0.75), NO_SWAMP)

    expect(pulling.get('3-2')).toEqual({ cover: 1, from: 'left', gloss: 1 })
    expect(pulling.get('2-3')?.cover).toBe(1)
    expect(half.get('3-2')?.cover).toBe(1)
    expect(half.get('2-3')?.cover).toBeLessThan(1)
    const end = [...iceCoversAt(prev, game, events, 1, NO_SWAMP)].filter(
      ([key, c]) => c.cover > 0 && key !== '3-2',
    )
    expect(new Map(end)).toEqual(iceCovers(game, game, 1))
  })

  it('소용돌이에 연달아 끌리는 돌 뒤에서 녹는 칸은 반짝임 줄이 언 바닥보다 빨리 옅어진다', () => {
    const stage: Stage = {
      ...STONE_STAGE,
      heights: [
        [1, 1, 1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1, 1, 1],
        [1, 0, 0, 0, 0, 0, 1],
        [1, 1, 1, 1, 1, 1, 1],
      ],
      start: { x: 0, y: 0 },
      goal: { x: 6, y: 3 },
      entities: [stone(1, 2), { type: 'whirlpool', x: 5, y: 2 }],
    }
    const { prev, game, events } = lastMove(stage, ['right', 'right'])
    const early = iceCoversAt(prev, game, events, 0.15, NO_SWAMP).get('1-2')
    const half = iceCoversAt(prev, game, events, 0.5, NO_SWAMP).get('1-2')

    expect(prev.stones).toEqual([{ x: 2, y: 2 }])
    expect(early?.gloss).toBeGreaterThan(0)
    expect(early?.gloss).toBeLessThan(early?.cover ?? 0)
    expect(half?.cover).toBeGreaterThan(0)
    expect(half?.gloss).toBe(0)
  })
})

describe('iceCoversAt 물에 들어가는 돌', () => {
  it('돌이 수면에 닿을 때부터 둘레가 얼고 그 전에는 안 언다', () => {
    const { prev, game, events } = lastMove(STONE_STAGE, ['down'])
    const early = iceCoversAt(prev, game, events, at(events, 0.1), NO_SWAMP)
    const late = iceCoversAt(prev, game, events, at(events, 0.7), NO_SWAMP)

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

  it('높은 칸에서 떨어지는 돌은 수면에 닿은 뒤에 둘레가 얼기 시작해 얼음 덮임 시간 동안 다 언다', () => {
    const heights = STONE_STAGE.heights.map((row, y) => (y < 2 ? row.map(() => 3) : row))
    const { prev, game, events } = lastMove(withEntities([stone(2, 1)], { heights }), ['down'])
    const surface = toScreen({ x: 2, y: 2 }, floatBase(1)).y
    const steps = Array.from({ length: 100 }, (_, i) => i / 100)
    const touch = steps.find(
      (t) => stoneFrames({ prev, game, events, t, swamp: NO_SWAMP })[0].y >= surface - 1,
    )!
    const cover = (t: number) => iceCoversAt(prev, game, events, t, NO_SWAMP).get('3-2')!.cover
    const seconds = durationOf(events)

    for (const t of steps.filter((s) => s < touch)) expect(cover(t)).toBe(0)
    expect(cover(Math.min(touch + FREEZE_SECONDS / seconds / 2, 0.99))).toBeLessThan(0.9)
    expect(cover(0.999)).toBeGreaterThan(0.99)
    expect((1 - touch) * seconds).toBeGreaterThan(FREEZE_SECONDS * 0.9)
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
  it('땅에서 떠서 끌릴 돌은 물이 차기 전에는 땅 위에 잠기지 않은 채 있다', () => {
    const stage: Stage = {
      ...SLUICE_WHIRL_STAGE,
      entities: SLUICE_WHIRL_STAGE.entities.map((e) =>
        e.type === 'box' ? { type: 'iceStone', x: e.x, y: e.y } : e,
      ),
    }
    const { prev, game, events } = lastMove(stage, ['left'])
    const [pulled] = stoneFrames({ prev, game, events, t: 0.1, swamp: NO_SWAMP, waterAt: () => 1 })

    expect(events.some((e) => e.type === 'stonePulled')).toBe(true)
    expect(pulled.y).toBeCloseTo(toScreen({ x: 1, y: 1 }, 1).y)
    expect(pulled.cut).toBe(0)
  })

  it('물로 밀린 돌은 내려앉아 얼음 판 위에 서고 다 앉으면 칸 그림 몫이다', () => {
    const { prev, game, events } = lastMove(STONE_STAGE, ['down'])
    const start = stoneFrames({ prev, game, events, t: 0, swamp: NO_SWAMP })[0]
    const end = stoneFrames({ prev, game, events, t: at(events, 0.599), swamp: NO_SWAMP })[0]

    expect(start.y).toBeCloseTo(toScreen({ x: 2, y: 1 }, 1).y)
    expect(start.cut).toBe(0)
    expect(end.y).toBeCloseTo(toScreen({ x: 2, y: 2 }, floatBase(1)).y, 0)
    expect(end.cut).toBeCloseTo(STONE.floatCut, 0)
    expect(stoneFrames({ prev, game, events, t: 1, swamp: NO_SWAMP })).toEqual([])
  })

  it('높은 칸에서 물로 떨어지는 돌은 수면에 닿기 전까지 밑에 얼음 판이 없고 서리 판도 다시 생기지 않는다', () => {
    const heights = STONE_STAGE.heights.map((row, y) => (y < 2 ? row.map(() => 3) : row))
    const { prev, game, events } = lastMove(withEntities([stone(2, 1)], { heights }), ['down'])
    const surface = toScreen({ x: 2, y: 2 }, floatBase(1)).y
    const frames = Array.from({ length: 50 }, (_, i) =>
      stoneFrames({ prev, game, events, t: i / 50, swamp: NO_SWAMP }),
    ).flatMap((f) => f.slice(0, 1))
    const above = frames.filter((frame) => frame.to.y === 2 && frame.y < surface - 1)

    expect(game.stones).toEqual([{ x: 2, y: 2 }])
    expect(above.length).toBeGreaterThan(0)
    for (const frame of above) expect(frame.slab).toBe(0)
    const frost = frames.map((frame) => frame.frost)
    frost.slice(1).forEach((f, i) => expect(f).toBeLessThanOrEqual(frost[i]))
    expect(frames.at(-1)!.slab).toBeGreaterThan(0.9)
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

  it('끌리는 돌은 긴 수에도 끌림 시간 안에 도착해 기다린다', () => {
    // (0,4) 물에 상자를 띄우는 긴 수 동안 (2,2) 돌이 오른쪽 소용돌이로 끌림
    const stage: Stage = {
      ...STONE_STAGE,
      heights: [
        [1, 1, 1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1, 1, 1],
        [1, 0, 0, 0, 0, 0, 1],
        [1, 1, 1, 1, 1, 1, 1],
        [0, 1, 1, 1, 1, 1, 1],
      ],
      start: { x: 2, y: 4 },
      goal: { x: 6, y: 0 },
      entities: [stone(2, 2), box(1, 4), { type: 'whirlpool', x: 5, y: 2 }],
    }
    const { prev, game, events } = lastMove(stage, ['left'])
    const arrived = at(events, pullStart(events) + PULL_SECONDS)
    const x = (t: number) => stoneFrames({ prev, game, events, t, swamp: NO_SWAMP })[0].x

    expect(game.stones).toEqual([{ x: 3, y: 2 }])
    expect(arrived).toBeLessThan(0.9)
    expect(x(arrived)).toBeCloseTo(toScreen({ x: 3, y: 2 }, floatBase(1)).x)
  })

  it('밀려 가는 돌에는 서리 판이 붙어 다니지 않는다', () => {
    const { prev, game, events } = lastMove(
      withEntities([stone(1, 1)], { start: { x: 0, y: 1 } }),
      ['right'],
    )
    for (const seconds of [0, 0.08, 0.16, 0.24]) {
      const t = at(events, seconds)
      expect(stoneFrames({ prev, game, events, t, swamp: NO_SWAMP })[0].frost).toBe(0)
    }
  })

  it('물에 뜬 돌을 밀면 한 칸 미끄러지고 둘레가 언 물이라 물테가 없다', () => {
    const { prev, game, events } = lastMove(
      withEntities([stone(2, 3)], { start: { x: 1, y: 3 } }),
      ['right'],
    )
    const mid = stoneFrames({ prev, game, events, t: 0.5, swamp: NO_SWAMP })[0]

    expect(mid.to).toEqual({ x: 3, y: 3 })
    expect(mid.slab).toBe(1)
    expect(mid.wake).toEqual([])
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
      holding: false,
      melting: false,
    })
  })

  it('둘레에 서서 버티는 0은 따로 알린다', () => {
    const one = lastMove(MELT_STAGE, ['down', 'right']).game
    const held = lastMove(MELT_STAGE, ['down', 'right', 'down']).game

    expect(meltDisplay(one)).toMatchObject({ count: 1, faint: false, holding: false })
    expect(meltDisplay(held)).toMatchObject({ count: 0, holding: true })
  })

  it('돌이 녹는 수의 연출 동안은 0, 끝나면 판 숫자', () => {
    const { game, events } = lastMove(MELT_STAGE, ['down', 'right', 'up'])

    expect(meltDisplay(game, events, true)).toMatchObject({ count: 0, melting: true })
    expect(meltDisplay(game, events, false)).toMatchObject({
      count: 2,
      faint: true,
      melting: false,
    })
  })
})

describe('얼음 돌 뒤를 따라 미끄러지는 큐브', () => {
  it('큐브는 밀려 미끄러지는 돌을 앞지르거나 겹치지 않고 늘 한 칸쯤 뒤에 있다', () => {
    const stage: Stage = {
      ...STONE_STAGE,
      heights: [
        [1, 1, 1, 1, 1, 1, 0],
        [1, 1, 1, 1, 1, 1, 1],
      ],
      water: 1,
      ice: ['.#####.', '.......'],
      start: { x: 0, y: 0 },
      goal: { x: 6, y: 1 },
      entities: [stone(1, 0)],
    }
    const { prev, game, events } = lastMove(stage, ['right'])
    const steps = Array.from({ length: 50 }, (_, i) => i / 50)

    expect(game.stones).toEqual([{ x: 6, y: 0 }])
    for (const t of steps) {
      const stone = stoneFrames({ prev, game, events, t, swamp: NO_SWAMP })[0]
      if (!stone) continue
      const cube = playerFrame(prev, game, events, t)
      const cubeX = toScreen({ x: cube.x, y: cube.y }, 0).x
      expect(stone.x - cubeX).toBeGreaterThan((TILE.width / 2) * 0.8)
    }
  })
})

describe('frostGround', () => {
  it('표시 없는 땅에만 서리 판을 깔고 물, 얼음바닥, 무너지는 칸, 스위치, 짝 칸은 뺀다', () => {
    const stage = withEntities(
      [
        { type: 'switch', x: 3, y: 0, target: 'a' },
        { type: 'warp', id: 'w', x: 4, y: 0 },
        { type: 'warp', id: 'w', x: 5, y: 0 },
      ],
      {
        ice: ['.#....', '......', '......', '......', '......'],
        cracks: ['..2...', '......', '......', '......', '......'],
      },
    )
    const game = createState(stage)
    const ground = [0, 1, 2, 3, 4].map((x) => frostGround(game, { x, y: 0 }))

    expect(ground).toEqual([true, false, false, false, false])
    expect(frostGround(game, { x: 2, y: 2 })).toBe(false)
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

  it('땅 위 돌의 서리 판은 공중에서는 없고 땅에 거의 닿을 때 생긴다', () => {
    const game = createState(withEntities([stone(2, 1)]))

    expect(restartStones(game, 0)[0].frost).toBe(0)
    expect(restartStones(game, 1)[0].frost).toBe(1)
  })

  it('땅 위 돌만 서리 판을 깔고 얼음바닥 위 돌은 깔지 않는다', () => {
    const stage = withEntities([stone(1, 1), stone(3, 1)], {
      ice: ['......', '...#..', '......', '......', '......'],
    })
    const [land, ice] = restartStones(createState(stage), 1)

    expect(land.frost).toBe(1)
    expect(ice.frost).toBe(0)
  })
})

describe('iceCoversAt 수위', () => {
  it('물이 차오르며 떠서 끌리는 돌은 끌리기 전까지 자기 밑 판을 그리고 끌린 뒤 떠난 칸이 언 채 남는다', () => {
    const stage: Stage = {
      ...SLUICE_WHIRL_STAGE,
      entities: SLUICE_WHIRL_STAGE.entities.map((e) =>
        e.type === 'box' ? { type: 'iceStone', x: e.x, y: e.y } : e,
      ),
    }
    const { prev, game, events } = lastMove(stage, ['left'])
    const cover = (key: string, seconds: number) =>
      iceCoversAt(prev, game, events, seconds / durationOf(events), NO_SWAMP).get(key)?.cover ?? 0
    const before = pullStart(events) - 0.01

    const stone = (seconds: number) =>
      stoneFrames({ prev, game, events, t: seconds / durationOf(events), swamp: NO_SWAMP })[0]

    expect(stone(before).bare).toBe(false)
    expect(cover('1-1', before)).toBe(0)
    expect(stone(pullStart(events) + 0.01).bare).toBe(true)
    expect(cover('1-1', pullStart(events) + PULL_SECONDS)).toBe(1)
  })

  it('새로 잠긴 칸은 수면이 반쯤 오른 때부터 돌 쪽부터 얼고, 빠지는 수에는 꼭지가 잠기기 시작할 때부터 얼음 녹는 시간에 녹는다', () => {
    const up = lastMove(SLUICE_ICE_STAGE, ['left'])
    const down = lastMove(SLUICE_ICE_STAGE, ['left', 'right'])
    const cover = (move: typeof up, seconds: number) =>
      iceCoversAt(
        move.prev,
        move.game,
        move.events,
        seconds / durationOf(move.events),
        NO_SWAMP,
      ).get('1-1')?.cover ?? 0
    const rose = sluiceStart(up.events)! + SLUICE.tap + SLUICE.level * SLUICE.afloat

    expect(cover(up, rose)).toBe(0)
    expect(cover(up, rose + FREEZE_SECONDS / 2)).toBeCloseTo(0.5)
    expect(cover(up, durationOf(up.events))).toBe(1)
    expect(cover(down, sluiceStart(down.events)! + FREEZE_SECONDS / 2)).toBeCloseTo(0.5)
    expect(cover(down, sluiceStart(down.events)! + FREEZE_SECONDS)).toBe(0)
    expect(cover(down, sluiceStart(down.events)!)).toBe(1)
  })

  it('돌은 그대로이고 물이 빠져 녹는 칸은 반짝임 줄이 언 바닥과 같이 옅어진다', () => {
    const down = lastMove(SLUICE_ICE_STAGE, ['left', 'right'])
    const at = (seconds: number) =>
      iceCoversAt(
        down.prev,
        down.game,
        down.events,
        seconds / durationOf(down.events),
        NO_SWAMP,
      ).get('1-1')!
    const half = at(sluiceStart(down.events)! + FREEZE_SECONDS / 2)

    expect(at(sluiceStart(down.events)!).gloss).toBe(1)
    expect(half.gloss).toBeCloseTo(half.cover)
  })
})

describe('frostPatches', () => {
  it('떠나는 칸 서리는 앞 절반에 옅어지고 도착하는 칸 서리는 뒤 절반에 생긴다', () => {
    const { prev, game, events } = lastMove(
      withEntities([stone(1, 1)], { start: { x: 0, y: 1 } }),
      ['right'],
    )
    const patchAt = (seconds: number) =>
      frostPatches(prev, game, events, at(events, seconds), NO_SWAMP)
    const half = SECONDS.pushed / 2

    expect(patchAt(0).get('1-1')).toBe(1)
    expect(patchAt(half).get('1-1')).toBeCloseTo(0)
    expect(patchAt(half).get('2-1')).toBeCloseTo(0)
    expect(patchAt(SECONDS.pushed).get('2-1')).toBeCloseTo(1)
  })

  it('얼음바닥 칸에는 서리를 남기지 않는다', () => {
    const stage = withEntities([stone(1, 1)], {
      start: { x: 0, y: 1 },
      ice: ['......', '..###.', '......', '......', '......'],
    })
    const { prev, game, events } = lastMove(stage, ['right'])

    expect(game.stones).toEqual([{ x: 5, y: 1 }])
    expect(frostPatches(prev, game, events, 1, NO_SWAMP).get('5-1')).toBe(1)
    expect(frostPatches(prev, game, events, 1, NO_SWAMP).has('3-1')).toBe(false)
  })
})
