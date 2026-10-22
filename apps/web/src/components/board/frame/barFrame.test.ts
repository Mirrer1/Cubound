import { describe, expect, it } from 'vitest'

import { BAR, BAR_HEIGHT } from '../view'
import {
  FORGE,
  SINK_SECONDS,
  TURN_SECONDS,
  barEnd,
  barKeys,
  barScene,
  barTouchAt,
  barsAt,
  forgeStart,
  restPose,
  shoveClock,
  shoveSegments,
} from './barFrame'
import { NO_CHAIN } from './curveFrame'
import { kegScene } from './kegFrame'
import { SECONDS } from './pathFrame'
import { TILE } from '@/game/iso'
import { createState, move } from '@/game/rules'
import type { Entity, GameEvent, GameState, Point, Stage } from '@/game/types'

const FLAT: Stage = {
  version: 1,
  id: 'test-bar',
  heights: [
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
  ],
  start: { x: 0, y: 1 },
  goal: { x: 4, y: 2 },
  entities: [{ type: 'bar', x: 1, y: 1, axis: 'x' }],
}

const PIT_ROW = [
  [0, 0, 0, 0, 0],
  [0, -1, -1, 0, 0],
  [0, 0, 0, 0, 0],
]

const stateOf = (more: Partial<Stage> = {}, entities: Entity[] = FLAT.entities) =>
  createState({ ...FLAT, ...more, entities })

interface More {
  prevEvents?: GameEvent[]
  t?: number
  cube?: Point
  dropping?: boolean
  ride?: number
}

const sceneAt = (
  before: GameState,
  game: GameState,
  events: GameEvent[],
  elapsed: number,
  more: More = {},
) =>
  barScene({
    before,
    game,
    events,
    prevEvents: more.prevEvents ?? [],
    moving: true,
    dropping: more.dropping ?? false,
    t: more.t ?? 0.5,
    elapsed,
    chain: NO_CHAIN,
    ashed: [],
    keg: kegScene({
      before,
      game,
      events,
      moving: true,
      dropping: more.dropping ?? false,
      t: more.t ?? 0.5,
      elapsed,
      move: SECONDS.pushed,
      stepT: 0.5,
    }),
    stepT: 0.5,
    ride: () => more.ride ?? 0.5,
    cube: more.cube ?? game.player,
  })

// 막대 면 중 화면에서 가장 높은 점
const topOf = (scene: ReturnType<typeof barScene>) =>
  Math.min(
    ...scene.draws[0].pieces.flatMap((p) =>
      p.faces.flatMap((f) => f.points.split(' ').map((q) => Number(q.split(',')[1]))),
    ),
  )

describe('barTouchAt', () => {
  it('밀린 막대는 밀림이 끝날 때 새 칸에 닿고 밀림이 시작할 때 옛 칸을 떠난다', () => {
    const before = stateOf()
    const { events } = move(before, 'right')

    expect(barTouchAt(events, { x: 3, y: 1 })).toEqual({ arrive: SECONDS.pushed, leave: null })
    expect(barTouchAt(events, { x: 1, y: 1 })).toEqual({ arrive: null, leave: 0 })
    expect(barTouchAt(events, { x: 2, y: 1 })).toEqual({ arrive: null, leave: null })
  })
})

describe('restPose', () => {
  it('땅에 누운 막대는 두 칸 가운데에 받침 길이 1.64로 수평', () => {
    const game = stateOf()
    expect(restPose(game, game.bars[0])).toMatchObject({
      x: 1.5,
      y: 1,
      angle: 0,
      z: 0,
      sag: null,
      lips: 0,
    })
    expect(restPose(game, game.bars[0]).length).toBeCloseTo(1.64)
  })

  it('한 칸만 구덩이 위면 구덩이 쪽 끝이 두 칸 경계에서 처진다', () => {
    const game = stateOf({
      heights: [
        [0, 0, 0, 0, 0],
        [0, 0, -1, 0, 0],
        [0, 0, 0, 0, 0],
      ],
    })
    expect(restPose(game, game.bars[0]).sag).toEqual({ at: 0, angle: BAR.sag })
  })

  it('한 칸만 낮은 땅 위면 낮은 쪽 받침 끝이 그 땅에 닿게 처진다', () => {
    const game = stateOf({
      heights: [
        [1, 1, 1, 1, 1],
        [1, 0, 1, 1, 1],
        [1, 1, 1, 1, 1],
      ],
    })
    const pose = restPose(game, { ...game.bars[0], level: 1 })
    const sag = pose.sag ?? { at: 0, angle: 0 }
    const tip = Math.abs(-pose.length / 2 - sag.at) * TILE.height

    expect(sag.angle).toBeLessThan(-BAR.sag)
    expect(tip * Math.sin(-sag.angle)).toBeCloseTo(TILE.layer)
  })

  it('떠 있는 쪽이 구덩이면 정한 처짐 각이다', () => {
    const game = stateOf({
      heights: [
        [1, 1, 1, 1, 1],
        [1, -1, 1, 1, 1],
        [1, 1, 1, 1, 1],
      ],
    })
    expect(restPose(game, { ...game.bars[0], level: 1 }).sag?.angle).toBe(-BAR.sag)
  })

  it('두 칸 다 구덩이 위면 윗면이 바닥 높이인 수평 다리', () => {
    const game = stateOf({ heights: PIT_ROW })
    expect(restPose(game, { ...game.bars[0], level: 0 })).toMatchObject({
      length: 2,
      inset: 0,
      z: -BAR_HEIGHT,
      sag: null,
      lips: 0,
    })
  })
})

describe('barScene', () => {
  it('길이 방향으로 밀면 상자 밀기 시간 동안 한 칸 미끄러진다', () => {
    const before = stateOf()
    const { state, events } = move(before, 'right')
    expect(barEnd(events)).toBeCloseTo(SECONDS.pushed)
    expect(barKeys(sceneAt(before, state, events, 0))).toBe('1-1 2-1')
    expect(barKeys(sceneAt(before, state, events, SECONDS.pushed))).toBe('2-1 3-1')
    expect(barsAt(sceneAt(before, state, events, SECONDS.pushed), { x: 3, y: 1 })).toHaveLength(1)
  })

  it('끝을 옆에서 밀면 반대쪽 끝을 축으로 돌고 도는 동안은 축 쪽 조각을 축 칸에 그린다', () => {
    const before = createState({ ...FLAT, start: { x: 2, y: 2 } })
    const { state, events } = move(before, 'up')
    const keysAt = (s: number) => barKeys(sceneAt(before, state, events, s))
    expect(keysAt(0)).toBe('1-1 2-1')
    expect(barKeys(sceneAt(state, state, [], 0))).toBe('1-0 1-1')
    // 돌기 동안은 축 칸과 나머지 조각이 걸친 가장 앞 칸, 큐브가 그 앞
    expect(keysAt(TURN_SECONDS / 2)).toBe('1-1 2-1')
  })

  it('두 칸 구덩이 위로 밀면 밀림을 마친 뒤 바닥 높이까지 내려앉아 다리가 된다', () => {
    const before = stateOf(
      {
        heights: [
          [0, 0, 0, 0, 0],
          [0, 0, -1, -1, 0],
          [0, 0, 0, 0, 0],
        ],
      },
      [{ type: 'bar', x: 1, y: 1, axis: 'x' }],
    )
    const { state, events } = move(before, 'right')
    const flat = stateOf()
    const slid = move(flat, 'right')
    const drop = (s: number) =>
      topOf(sceneAt(before, state, events, s)) - topOf(sceneAt(flat, slid.state, slid.events, s))
    // 밀리는 동안은 바닥 위, 다 밀린 뒤 내려앉음
    expect(Math.abs(drop(SECONDS.pushed * 0.4))).toBeLessThan(3)
    expect(drop(SECONDS.pushed)).toBeLessThan(0)
    const settled = SECONDS.pushed + SINK_SECONDS
    expect(topOf(sceneAt(before, state, events, settled))).toBeCloseTo(
      topOf(sceneAt(state, state, [], 0)),
    )
    expect(drop(settled)).toBeGreaterThan(0)
  })

  it('막혀서 못 돌면 끝이 들렸다 제자리로 돌아온다', () => {
    const before = createState({
      ...FLAT,
      start: { x: 2, y: 2 },
      entities: [...FLAT.entities, { type: 'box', x: 2, y: 0 }],
    })
    const { state, events } = move(before, 'up')
    expect(events[0].type).toBe('blocked')
    const at = (s: number) =>
      sceneAt(before, state, events, s).draws[0].pieces.map((p) => p.faces[0].points)
    expect(at(SECONDS.blocked / 2)).not.toEqual(at(0))
    expect(at(SECONDS.blocked)).toEqual(at(0))
  })

  it('다리에 올라서는 동안 큐브와 다리가 함께 가라앉고 다리 위에서는 그 깊이를 유지한다', () => {
    const pit = stateOf({ heights: PIT_ROW })
    const game = { ...pit, bars: [{ ...pit.bars[0], level: 0 }] }
    const events: GameEvent[] = [{ type: 'moved', from: { x: 0, y: 1 }, to: { x: 1, y: 1 } }]
    expect(sceneAt(game, game, events, 0, { cube: { x: 0, y: 1 } }).roll).toBeNull()
    const scene = sceneAt(game, game, events, 0.18, { cube: { x: 3 / 4, y: 1 } })
    expect(scene.roll?.dip).toBeGreaterThan(0.75)
    expect(scene.roll?.dip).toBeLessThan(1.5)
    expect(scene.roll?.angle).toBe(0)
    expect(scene.roll?.z).toBe(-BAR_HEIGHT / 2)
    expect(sceneAt(game, game, events, 0.24, { cube: { x: 1, y: 1 } }).roll?.dip).toBeCloseTo(1.5)
  })

  it('재시작하면 돌았던 막대는 놓인 자리에서 옅어지고 처음 자리에서 차오른다', () => {
    const game = stateOf()
    const before = { ...game, bars: [{ ...game.bars[0], dir: 'up' as const }] }
    const scene = sceneAt(before, game, [], 0, { dropping: true, t: 0 })
    expect(scene.draws.map((d) => d.opacity)).toEqual([1, 0])
  })
})

describe('달군 쇠', () => {
  const FORGED: Stage = {
    ...FLAT,
    heights: [[0, 0, 0, 0, 0, 0]],
    fire: ['#.....'],
    start: { x: 4, y: 0 },
    goal: { x: 5, y: 0 },
    entities: [{ type: 'bar', x: 2, y: 0, axis: 'x' }],
    rules: { forge: true },
  }
  const forged = () => {
    const before = { ...createState(FORGED), burning: [{ x: 0, y: 0 }] }
    return { before, ...move(before, 'left') }
  }

  it('불에 닿으면 이동 뒤 숯불빛이 스미고 한 칸 늘어나는 시간이 붙는다', () => {
    const { events } = forged()
    expect(events.some((e) => e.type === 'barStretched')).toBe(true)
    const start = forgeStart(events) ?? 0
    expect(start).toBeCloseTo(SECONDS.pushed)
    expect(barEnd(events)).toBeCloseTo(start + FORGE.heat + FORGE.grow)
  })

  it('늘어난 수가 끝나도 달궈진 채이고 다음 수에 걸쳐 식는다', () => {
    const { before, state, events } = forged()
    expect(sceneAt(before, state, events, 0).draws[0].heat).toBe(0)
    expect(sceneAt(before, state, events, barEnd(events)).draws[0].heat).toBe(1)
    const later = sceneAt(state, state, [], 0, { prevEvents: events, t: 0.5 })
    expect(later.draws[0].heat).toBeCloseTo(0.5)
  })

  it('밀려나는 큐브와 상자는 늘어나는 동안 같이 밀린다', () => {
    const stretched: GameEvent = {
      type: 'barStretched',
      bar: 0,
      at: { x: 3, y: 0 },
      shoved: { subject: 'player', from: { x: 3, y: 0 }, to: { x: 4, y: 0 } },
    }
    const events: GameEvent[] = [
      { type: 'moved', from: { x: 4, y: 0 }, to: { x: 3, y: 0 } },
      { type: 'barHeated', bar: 0, end: 'head' },
      stretched,
      { type: 'moved', from: { x: 3, y: 0 }, to: { x: 4, y: 0 } },
    ]
    const segments = shoveSegments(events, [])
    expect(segments.map((s) => s.wait ?? false)).toEqual([false, true, false])
    expect(segments[0].seconds + segments[1].seconds).toBeCloseTo(SECONDS.moved + FORGE.heat)
    expect(segments[2].seconds).toBe(FORGE.grow)

    const boxed = events.map((e) =>
      e === stretched
        ? { ...stretched, shoved: { ...stretched.shoved!, subject: 'box' as const } }
        : e,
    )
    expect(shoveClock(boxed, SECONDS.moved)).toBe(0)
    expect(shoveClock(boxed, SECONDS.moved + FORGE.heat + FORGE.grow)).toBeCloseTo(SECONDS.pushed)
    expect(shoveClock(events, 0.1)).toBe(0.1)
  })
})

describe('barScene', () => {
  it('발판에 실린 막대는 발판이 오르는 진행도를 따라 오른다', () => {
    const lifted = createState({
      version: 1,
      id: 'test-bar-lifts',
      heights: [
        [1, 1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1, 1],
      ],
      start: { x: 2, y: 2 },
      goal: { x: 5, y: 0 },
      entities: [
        { type: 'bar', x: 2, y: 0, axis: 'x' },
        { type: 'lift', x: 2, y: 0, id: 'a' },
        { type: 'lift', x: 3, y: 0, id: 'b' },
        { type: 'switch', x: 0, y: 2, target: 'a' },
        { type: 'switch', x: 5, y: 2, target: 'b' },
        { type: 'box', x: 1, y: 2 },
        { type: 'box', x: 4, y: 2 },
      ],
    })
    const before = (['left', 'right', 'right'] as const).reduce((s, d) => move(s, d).state, lifted)
    const { state, events } = move(before, 'right')
    const still = (game: GameState) => topOf(sceneAt(game, game, [], 0, { t: 1 }))

    expect(topOf(sceneAt(before, state, events, 0.1, { ride: 0 }))).toBeCloseTo(still(before))
    expect(topOf(sceneAt(before, state, events, 0.1, { ride: 1 }))).toBeCloseTo(still(state))
  })
})

describe('barScene 축 칸이 앞인 돌기', () => {
  it('뒤쪽으로 도는 끝은 축 칸이 아니라 끝이 지나는 칸 차례에 그린다', () => {
    const before = stateOf({ start: { x: 2, y: 0 } }, [{ type: 'bar', x: 1, y: 0, axis: 'y' }])
    const { events, state } = move(before, 'left')
    const pivot = { x: 1, y: 1 }

    expect(events).toContainEqual(expect.objectContaining({ type: 'barPushed', pivot }))
    for (const elapsed of [0.02, TURN_SECONDS / 2]) {
      const cells = sceneAt(before, state, events, elapsed).draws[0].pieces.map((p) => p.cell)
      expect(cells.some((c) => c.x + c.y < pivot.x + pivot.y)).toBe(true)
    }
  })
})
