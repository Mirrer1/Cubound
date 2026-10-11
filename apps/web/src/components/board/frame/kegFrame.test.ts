import { describe, expect, it } from 'vitest'

import {
  KEG,
  blastAt,
  blastLean,
  blastSegments,
  caughtHeat,
  dustOf,
  kegDrop,
  kegEnd,
  kegLookOf,
  kegPath,
  kegScene,
  kegStart,
  movingKeg,
} from './kegFrame'
import { WIND, totalSeconds } from './pathFrame'
import { KEG_STAGE, blast } from './testStages'
import { NO_SWAMP, durationOf, moveSeconds, playerSegments } from './timeFrame'
import { createState, move } from '@/game/rules'
import type { GameEvent, GameState, Stage } from '@/game/types'

// 평지에 화약통 (2,1), 큐브는 (1,1)
const FLAT: Stage = {
  ...KEG_STAGE,
  heights: [
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
  ],
  fire: undefined,
  start: { x: 1, y: 1 },
}

const CHAIN: Partial<Stage> = {
  heights: [
    [1, 1, 2, 0, 0],
    [1, 1, 0, 0, 0],
    [0, 0, 0, 0, 0],
  ],
  entities: [
    { type: 'keg', x: 2, y: 1 },
    { type: 'keg', x: 3, y: 1 },
  ],
}

const moveOf = (events: GameEvent[]) => moveSeconds(events, NO_SWAMP)

const startOf = (events: GameEvent[]) => kegStart(events, moveOf(events))

const sceneAt = (prev: GameState, game: GameState, events: GameEvent[], elapsed: number) => {
  const move = moveOf(events)
  return kegScene({
    before: prev,
    game,
    events,
    moving: true,
    dropping: false,
    t: elapsed / durationOf(events),
    elapsed,
    move,
    stepT: Math.min(1, elapsed / move),
  })
}

describe('kegPath', () => {
  it('밀린 화약통을 상자 밀기와 같은 길로 본다', () => {
    const { events } = move(createState(FLAT), 'right')

    expect(kegPath(events)).toEqual([
      { type: 'pushed', from: { x: 2, y: 1 }, to: { x: 3, y: 1 }, result: 'slid' },
    ])
  })
})

describe('kegStart', () => {
  it('번진 불이 닿으면 이동 몫이 끝난 뒤 시작한다', () => {
    const { events } = blast()

    expect(startOf(events)).toBe(moveOf(events))
  })

  it('불 붙은 큐브가 밀면 기울어 닿는 순간 시작한다', () => {
    const { events } = move({ ...createState(FLAT), flame: 4 }, 'right')

    expect(events[0].type).toBe('torchedKeg')
    expect(startOf(events)).toBeCloseTo(0.13)
  })
})

describe('kegEnd', () => {
  it('이동 몫은 그대로 두고 터지는 0.4초를 더한다', () => {
    const { events } = blast()
    const own = moveOf(events)

    expect(own).toBe(moveOf(events.filter((e) => e.type !== 'exploded')))
    expect(kegEnd(events, own)).toBeCloseTo(own + KEG.end)
    expect(durationOf(events)).toBeCloseTo(own + KEG.end)
  })

  it('연쇄는 0.1초씩 늦게 터진다', () => {
    const { events } = blast(CHAIN)

    expect(events.filter((e) => e.type === 'exploded')).toHaveLength(2)
    expect(kegEnd(events, 0.24)).toBeCloseTo(0.24 + KEG.chain + KEG.end)
  })

  it('밀려나는 큐브는 터지는 순간부터 바람 미끄러짐만큼 늘린다', () => {
    const { events } = blast({}, 'down')

    expect(kegEnd(events, 0.24)).toBeCloseTo(0.24 + KEG.flash + WIND.slide / 2 + 0.28)
  })

  it('화약통이 없는 수는 0이다', () => {
    const { events } = move(createState({ ...KEG_STAGE, entities: [] }), 'left')

    expect(kegEnd(events, 0.24)).toBe(0)
  })
})

describe('blastSegments', () => {
  it('내 이동 뒤 터지는 순간까지 기다렸다가 한 칸 밀려난다', () => {
    const { prev, events } = blast({}, 'down')
    const own = playerSegments(events)
    const segments = blastSegments(events, own, 0.24, prev.player)

    expect(own).toHaveLength(1)
    expect(segments).toHaveLength(3)
    expect(segments[1].wait).toBe(true)
    expect(segments[1].seconds).toBeCloseTo(KEG.flash)
    expect(segments[2]).toMatchObject({
      event: { type: 'moved', from: { x: 1, y: 1 }, to: { x: 0, y: 1 } },
      seconds: WIND.slide,
    })
    expect(totalSeconds(segments)).toBeLessThanOrEqual(kegEnd(events, 0.24))
  })

  it('밀려나지 않는 수는 내 이동 그대로다', () => {
    const { prev, events } = blast()
    const own = playerSegments(events)

    expect(blastSegments(events, own, 0.24, prev.player)).toBe(own)
  })
})

describe('blastLean', () => {
  it('버티는 수는 터지는 순간부터 기울었다 돌아온다', () => {
    const stage: Partial<Stage> = {
      heights: [
        [1, 1, 2, 0, 0],
        [2, 1, 0, 1, 0],
        [0, 0, 0, 0, 0],
      ],
    }
    const { game, events } = blast(stage, 'down')
    const at = blastAt(events, 0.24, game.player) ?? 0

    expect(at).toBeCloseTo(0.24 + KEG.flash)
    expect(blastLean(events, 0.24, game.player, at - 0.01)).toBeNull()
    expect(blastLean(events, 0.24, game.player, at + WIND.brace / 2)).toBeCloseTo(1)
    expect(blastLean(events, 0.24, game.player, at + WIND.brace + 0.01)).toBeNull()
  })
})

describe('kegLookOf', () => {
  it('부풀었다가 터지는 순간 사라진다', () => {
    const { prev, game, events } = blast()
    const keg = { x: 2, y: 1 }
    const look = (s: number) => kegLookOf(sceneAt(prev, game, events, startOf(events) + s), keg)

    expect(look(-0.1)).toMatchObject({ on: true, heat: 0, swell: 1, opacity: 1, burst: -1 })
    expect(look(KEG.swell).heat).toBeGreaterThan(0.6)
    expect(look(KEG.swell).swell).toBeGreaterThan(1.05)
    expect(look(KEG.flash).opacity).toBe(0)
    expect(look(KEG.flash).burst).toBeCloseTo(0.16)
  })

  it('밀리는 화약통은 도착 칸에 서지 않는다', () => {
    const prev = createState(FLAT)
    const { state: game, events } = move(prev, 'right')
    const scene = sceneAt(prev, game, events, 0.1)

    expect(kegLookOf(scene, { x: 3, y: 1 }).on).toBe(false)
    expect(movingKeg(scene, { in: false, out: false })).toMatchObject({ to: { x: 3, y: 1 } })
    expect(movingKeg(sceneAt(prev, game, events, 0.3), { in: false, out: false })).toBeNull()
  })

  it('심지는 한 수마다 끝 마디가 타서 줄어든다', () => {
    const stage: Stage = { ...FLAT, entities: [{ type: 'keg', x: 2, y: 1, fuse: true }] }
    const lit = move({ ...createState(stage), flame: 4 }, 'right')
    expect(lit.state.kegs[0].lit).toBe(4)

    const prev = lit.state
    const { state: game, events } = move(prev, 'up')
    const look = (elapsed: number) =>
      kegLookOf(sceneAt(prev, game, events, elapsed), { x: 2, y: 1 })

    expect(look(0)).toMatchObject({ fuse: true, ember: 1 })
    expect(look(0).cords).toBeCloseTo(4)
    expect(look(0.12).cords).toBeCloseTo(3.5)
    expect(look(0.24).cords).toBeCloseTo(3)
  })

  it('수가 끝나 멈춘 심지는 남은 수만큼 마디가 남는다', () => {
    const stage: Stage = { ...FLAT, entities: [{ type: 'keg', x: 2, y: 1, fuse: true }] }
    const lit = move({ ...createState(stage), flame: 4 }, 'right')
    const { state: game, events } = move(lit.state, 'up')

    expect(kegLookOf(sceneAt(game, game, events, 1), { x: 2, y: 1 }).cords).toBeCloseTo(3)
    expect(kegLookOf(sceneAt(lit.state, lit.state, [], 1), { x: 2, y: 1 }).cords).toBeCloseTo(4)
  })

  it('심지가 탄 자리는 재로 남았다가 그 수 안에 옅어진다', () => {
    const stage: Stage = { ...FLAT, entities: [{ type: 'keg', x: 2, y: 1, fuse: true }] }
    const lit = move({ ...createState(stage), flame: 4 }, 'right')
    const prev = lit.state
    const { state: game, events } = move(prev, 'up')
    const look = (elapsed: number) =>
      kegLookOf(sceneAt(prev, game, events, elapsed), { x: 2, y: 1 })

    expect(look(0).ash).toBeCloseTo(1)
    expect(look(0.12)).toMatchObject({ ashTo: 4 })
    expect(look(0.12).ash).toBeCloseTo(0.5)
    expect(look(0.24).ash).toBeCloseTo(0)
    expect(kegLookOf(sceneAt(game, game, [], 1), { x: 2, y: 1 }).ash).toBe(0)
  })

  it('밀리는 심지 화약통은 불티가 반대쪽으로 처진다', () => {
    const stage: Stage = { ...FLAT, entities: [{ type: 'keg', x: 2, y: 1, fuse: true }] }
    const lit = move({ ...createState(stage), flame: 4 }, 'right')
    const prev = { ...lit.state, flame: 0 }
    const { state: game, events } = move(prev, 'right')
    const frame = movingKeg(sceneAt(prev, game, events, 0.13), { in: false, out: false })

    expect(frame?.look.trail.u).toBeLessThan(0)
    expect(frame?.look.trail.v).toBe(0)
  })

  it('심지에 불이 붙는 수는 끝이 서서히 달아오른다', () => {
    const stage: Stage = { ...FLAT, entities: [{ type: 'keg', x: 2, y: 1, fuse: true }] }
    const prev = { ...createState(stage), flame: 4 }
    const { state: game, events } = move(prev, 'right')
    const ember = (elapsed: number) =>
      kegLookOf(sceneAt(prev, game, events, elapsed), { x: 2, y: 1 }).ember

    expect(ember(0)).toBe(0)
    expect(ember(startOf(events) + 0.1)).toBeGreaterThan(0)
    expect(ember(startOf(events) + 0.2)).toBe(1)
  })
})

describe('kegDrop', () => {
  it('깎인 칸은 터진 뒤 한 층 내려앉는다', () => {
    const { prev, game, events } = blast()
    const p = { x: 2, y: 0 }
    const drop = (s: number) => kegDrop(sceneAt(prev, game, events, startOf(events) + s), p)

    expect(drop(0)).toBe(0)
    expect(drop(KEG.flash)).toBeGreaterThan(0.3)
    expect(drop(KEG.settle)).toBeCloseTo(1)
  })

  it('밀려나는 큐브가 떠난 칸은 큐브가 반쯤 간 뒤 내려앉는다', () => {
    const { prev, game, events } = blast({}, 'down')
    const p = { x: 1, y: 1 }
    const from = startOf(events) + KEG.flash + WIND.slide / 2
    const drop = (elapsed: number) => kegDrop(sceneAt(prev, game, events, elapsed), p)

    expect(drop(from)).toBe(0)
    expect(drop(from + 0.28)).toBeCloseTo(1)
  })

  it('재시작하면 깎인 칸이 제 높이로 돌아온다', () => {
    const { game } = blast()
    const start = createState(KEG_STAGE)
    const scene = (t: number) =>
      kegScene({
        before: game,
        game: start,
        events: [],
        moving: true,
        dropping: true,
        t,
        elapsed: 0,
        move: 0,
        stepT: 1,
      })

    expect(game.heights[0][2]).toBe(1)
    expect(kegDrop(scene(0), { x: 2, y: 0 })).toBeCloseTo(1)
    expect(kegDrop(scene(1), { x: 2, y: 0 })).toBe(0)
    expect(kegLookOf(scene(0), { x: 2, y: 1 }).opacity).toBe(0)
    expect(kegLookOf(scene(1), { x: 2, y: 1 })).toMatchObject({ on: true, opacity: 1 })
    expect(kegLookOf(scene(1), { x: 2, y: 1 }).lift).toBeCloseTo(0)
  })

  it('재시작하면 화약통은 깎인 칸과 같은 박자로 차오르고 재 자국은 옅어진다', () => {
    const { game } = blast()
    const start = createState(KEG_STAGE)
    const scene = (t: number) =>
      kegScene({
        before: game,
        game: start,
        events: [],
        moving: true,
        dropping: true,
        t,
        elapsed: 0,
        move: 0,
        stepT: 1,
      })
    const keg = { x: 2, y: 1 }

    for (const t of [0.1, 0.3, 0.5]) {
      const look = kegLookOf(scene(t), keg)
      expect(look.opacity).toBeCloseTo(1 - kegDrop(scene(t), { x: 2, y: 0 }))
      expect(look.mark).toBeCloseTo(1 - look.opacity)
      expect(look.lift).toBe(0)
    }
    expect(kegLookOf(scene(1), keg)).toMatchObject({ opacity: 1, mark: 0 })
  })

  it('재시작 전에 그 자리에 서 있던 화약통은 그대로 둔다', () => {
    const prev = createState(KEG_STAGE)
    const scene = kegScene({
      before: prev,
      game: prev,
      events: [],
      moving: true,
      dropping: true,
      t: 0,
      elapsed: 0,
      move: 0,
      stepT: 1,
    })

    expect(kegLookOf(scene, { x: 2, y: 1 })).toMatchObject({ on: true, opacity: 1 })
  })
})

describe('kegLookOf 재 자국', () => {
  it('통이 사라질 즈음부터 터진 자리에 재 자국이 차오르고 남는다', () => {
    const { prev, game, events } = blast()
    const keg = { x: 2, y: 1 }
    const mark = (s: number) =>
      kegLookOf(sceneAt(prev, game, events, startOf(events) + s), keg).mark

    expect(mark(KEG.swell)).toBe(0)
    expect(mark(KEG.flash)).toBeGreaterThan(0)
    expect(mark(KEG.flash)).toBeLessThan(1)
    expect(mark(KEG.settle)).toBe(1)
  })

  it('깎인 칸에는 재 자국이 없다', () => {
    const { prev, game, events } = blast()

    expect(
      kegLookOf(sceneAt(prev, game, events, startOf(events) + KEG.end), { x: 2, y: 0 }).mark,
    ).toBe(0)
  })

  it('수가 끝난 판에는 터진 자리마다 재 자국이 남는다', () => {
    const { game } = blast()
    const scene = kegScene({
      before: game,
      game,
      events: [],
      moving: false,
      dropping: false,
      t: 1,
      elapsed: 0,
      move: 0,
      stepT: 1,
    })

    expect(kegLookOf(scene, { x: 2, y: 1 })).toMatchObject({ on: false, mark: 1 })
  })
})

describe('caughtHeat', () => {
  it('둘레 숯은 화약통이 터지는 순간부터 불이 붙는다', () => {
    const stage: Partial<Stage> = {
      heights: [
        [1, 1, 0, 0, 0],
        [1, 1, 0, 1, 0],
        [0, 0, 0, 0, 0],
      ],
      fire: ['..#..', '.....', '..##.'],
    }
    const { prev, game, events } = blast(stage)
    const heat = (s: number) =>
      caughtHeat(sceneAt(prev, game, events, startOf(events) + s), { x: 2, y: 0 })

    expect(heat(KEG.flash)).toBeCloseTo(0)
    expect(heat(KEG.end)).toBe(1)
    expect(caughtHeat(sceneAt(prev, game, events, 0), { x: 1, y: 1 })).toBeNull()
  })
})

describe('dustOf', () => {
  it('깎인 칸에서 화약통 반대쪽으로 먼지가 인다', () => {
    const { prev, game, events } = blast()
    const at = startOf(events) + KEG.flash

    expect(dustOf(sceneAt(prev, game, events, at), { x: 2, y: 0 })).toEqual({
      s: expect.closeTo(0.16) as number,
      du: 0,
      dv: -1,
    })
    expect(dustOf(sceneAt(prev, game, events, at + KEG.end), { x: 2, y: 0 })).toBeNull()
  })
})
