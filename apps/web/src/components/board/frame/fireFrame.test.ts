import { describe, expect, it } from 'vitest'

import { FIRE, fireEnd, fireKindAt, fireLookOf, fireScene, warmCells } from './fireFrame'
import { playerPath, segmentsOf } from './pathFrame'
import { durationOf, elapsedAt, playerSegments, stepProgress } from './timeFrame'
import { createState, move } from '@/game/rules'
import type { Direction, GameEvent, GameState, Point, Stage } from '@/game/types'

// 윗줄은 걷는 길, 아랫줄은 불씨 (1,1)에서 숯 벽 하나와 숯 다리 둘로 이어진 숯 길
const LINE_STAGE: Stage = {
  version: 1,
  id: 'test-fire',
  name: '불',
  heights: [
    [0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0],
  ],
  fire: ['......', '.*#==.'],
  start: { x: 1, y: 0 },
  goal: { x: 5, y: 0 },
  entities: [],
}

// 아랫줄 숯 다리 다섯, 쫓아오는 불
const FORK_STAGE: Stage = {
  version: 1,
  id: 'test-fire-fork',
  name: '쫓아오는 불',
  heights: [
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
  ],
  fire: ['..*..', '====='],
  start: { x: 1, y: 0 },
  goal: { x: 0, y: 0 },
  entities: [],
  rules: { chase: true },
}

// 가운데 (2,1)이 불붙은 쫓아오는 불 판, 큐브는 윗줄 x
const chaseAt = (x: number): GameState => ({
  ...createState({ ...FORK_STAGE, start: { x, y: 0 } }),
  sparks: [],
  burning: [{ x: 2, y: 1 }],
})

const WALL: Point = { x: 2, y: 1 }
const NEAR: Point = { x: 3, y: 1 }
const FAR: Point = { x: 4, y: 1 }
const SPARK: Point = { x: 1, y: 1 }

const play = (state: GameState, dirs: Direction[]) =>
  dirs.reduce<{ state: GameState; events: GameEvent[] }>(({ state: s }, dir) => move(s, dir), {
    state,
    events: [],
  })

const sceneAt = (before: GameState, game: GameState, events: GameEvent[], t: number) =>
  fireScene({
    before,
    game,
    events,
    moving: t < 1,
    dropping: false,
    t,
    elapsed: elapsedAt(events, { lead: 0, tail: 0 }, t),
    segments: playerSegments(events),
    tail: 0,
    stepT: stepProgress(events, t),
  })

const lookAt = (before: GameState, dirs: Direction[], t: number, p: Point) => {
  const { state, events } = play(before, dirs)
  return fireLookOf(sceneAt(before, state, events, t), p)
}

describe('fireKindAt', () => {
  it('불 줄의 글자로 불씨 칸, 숯 벽, 숯 다리를 가른다', () => {
    expect(fireKindAt(LINE_STAGE, SPARK)).toBe('spark')
    expect(fireKindAt(LINE_STAGE, WALL)).toBe('wall')
    expect(fireKindAt(LINE_STAGE, NEAR)).toBe('bridge')
    expect(fireKindAt(LINE_STAGE, { x: 0, y: 0 })).toBeNull()
  })
})

describe('warmCells', () => {
  it('불붙은 숯의 맞닿은 숯을 다음 수 끝에 불붙을 칸으로 낸다', () => {
    const { state } = move(createState(LINE_STAGE), 'down')

    expect(state.burning).toEqual([WALL])
    expect(warmCells(state)).toEqual([NEAR])
  })

  it('불이 없으면 빈 목록이다', () => {
    expect(warmCells(createState(LINE_STAGE))).toEqual([])
  })

  it('쫓아오는 불은 큐브와 가까워지는 쪽 숯만 낸다', () => {
    expect(warmCells(chaseAt(4))).toEqual([{ x: 3, y: 1 }])
  })
})

describe('fireEnd', () => {
  it('불이 없는 수는 0이다', () => {
    const { events } = move(createState(LINE_STAGE), 'right')

    expect(fireEnd(events, playerSegments(events), 0)).toBe(0)
  })

  it('켜는 수는 큐브가 닿은 뒤 켜짐 시간까지다', () => {
    const { events } = move(createState(LINE_STAGE), 'down')
    const cube = playerSegments(events).reduce((sum, s) => sum + s.seconds, 0)

    expect(fireEnd(events, playerSegments(events), 0)).toBeCloseTo(cube + FIRE.kindle)
    expect(durationOf(events)).toBeCloseTo(cube + FIRE.kindle)
  })

  it('재가 되는 수는 재 시간보다 짧지 않다', () => {
    const lit = move(createState(LINE_STAGE), 'down').state
    const { events } = move(lit, 'up')

    expect(fireEnd(events, playerSegments(events), 0)).toBeCloseTo(FIRE.ash)
    expect(durationOf(events)).toBeCloseTo(FIRE.ash)
  })

  it('큐브가 떠나는 불붙은 칸은 첫 칸 반을 지난 뒤부터 재 시간이다', () => {
    const before: GameState = {
      ...createState({ ...LINE_STAGE, fire: ['......', '.*.==.'], start: { x: 4, y: 0 } }),
      sparks: [],
      burning: [NEAR],
    }
    const onBridge = move(before, 'down').state
    expect(onBridge.burning).toEqual([FAR])
    const { events } = move(onBridge, 'up')
    const first = segmentsOf(playerPath(events))[0]

    expect(fireEnd(events, playerSegments(events), 0)).toBeCloseTo(first.seconds / 2 + FIRE.ash)
  })
})

describe('fireLookOf', () => {
  it('불이 없는 칸은 종류 없음이다', () => {
    const state = createState(LINE_STAGE)

    expect(fireLookOf(sceneAt(state, state, [], 1), { x: 0, y: 0 }).kind).toBeNull()
  })

  it('켠 뒤 멈춘 판은 불씨 칸이 켜지고 불붙은 숯은 1, 다음 숯은 달아오름 0.5다', () => {
    const lit = move(createState(LINE_STAGE), 'down').state
    const scene = sceneAt(lit, lit, [], 1)

    expect(fireLookOf(scene, SPARK).lit).toBe(1)
    expect(fireLookOf(scene, WALL).heat).toBe(1)
    expect(fireLookOf(scene, NEAR).heat).toBe(0.5)
    expect(fireLookOf(scene, FAR).heat).toBe(0)
  })

  it('켜는 수는 큐브가 닿기 전에 꺼져 있다가 닿은 뒤 이어서 켜진다', () => {
    const start = createState(LINE_STAGE)
    const { events } = move(start, 'down')
    const cube = playerSegments(events).reduce((sum, s) => sum + s.seconds, 0)
    const landed = cube / durationOf(events)

    expect(lookAt(start, ['down'], landed * 0.9, SPARK).lit).toBe(0)
    expect(lookAt(start, ['down'], landed * 0.9, WALL).heat).toBe(0)
    let last = 0
    for (let t = landed; t <= 1; t += 0.05) {
      const heat = lookAt(start, ['down'], t, WALL).heat
      expect(heat).toBeGreaterThanOrEqual(last)
      last = heat
    }
    expect(lookAt(start, ['down'], 1, WALL).heat).toBe(1)
  })

  it('번지는 수는 달아오름에서 불붙음으로, 평소에서 달아오름으로 이어서 바뀐다', () => {
    const lit = move(createState(LINE_STAGE), 'down').state
    const back = move(lit, 'up').state

    expect(lookAt(lit, ['up'], 0, NEAR).heat).toBe(0.5)
    expect(lookAt(lit, ['up'], 0.5, NEAR).heat).toBeGreaterThan(0.5)
    expect(lookAt(lit, ['up'], 0.5, NEAR).heat).toBeLessThan(1)
    expect(lookAt(lit, ['up'], 0.5, FAR).heat).toBeGreaterThan(0)
    expect(lookAt(lit, ['up'], 0.5, FAR).heat).toBeLessThan(0.5)
    expect(fireLookOf(sceneAt(back, back, [], 1), FAR).heat).toBe(0.5)
  })

  it('재가 되는 수는 불붙은 채 부서지고 재 자국이 차오르며 다음에는 자국만 남는다', () => {
    const lit = move(createState(LINE_STAGE), 'down').state
    const after = move(lit, 'up').state

    expect(lookAt(lit, ['up'], 0, WALL)).toMatchObject({ heat: 1, crumble: 0, stand: 1 })
    const mid = lookAt(lit, ['up'], 0.5, WALL)
    expect(mid.crumble).toBeGreaterThan(0)
    expect(mid.crumble).toBeLessThan(1)
    expect(mid.mark).toBeGreaterThan(0)
    expect(lookAt(lit, ['up'], 0.999, WALL).crumble).toBeGreaterThan(0.99)
    expect(fireLookOf(sceneAt(after, after, [], 1), WALL)).toMatchObject({
      crumble: 0,
      stand: 0,
      mark: 1,
    })
  })

  it('큐브가 선 불붙은 숯은 불붙음이고 떠나는 수에 큐브가 반 칸 넘게 간 뒤 부서진다', () => {
    const before: GameState = {
      ...createState({ ...LINE_STAGE, fire: ['......', '.*.==.'], start: { x: 4, y: 0 } }),
      sparks: [],
      burning: [NEAR],
    }
    const onBridge = move(before, 'down').state
    const { events } = move(onBridge, 'up')
    const first = segmentsOf(playerPath(events))[0]
    const half = first.seconds / 2 / durationOf(events)

    expect(fireLookOf(sceneAt(onBridge, onBridge, [], 1), FAR).heat).toBe(1)
    expect(lookAt(onBridge, ['up'], half * 0.9, FAR).crumble).toBe(0)
    expect(lookAt(onBridge, ['up'], half + 0.1, FAR).crumble).toBeGreaterThan(0)
  })

  it('빗나간 달아오름은 그 수 동안 0.5에서 0으로 이어서 식는다', () => {
    const ahead = chaseAt(3)
    expect(warmCells(ahead)).toEqual([{ x: 3, y: 1 }])
    expect(move(ahead, 'left').state.burning).toEqual([])

    const steps = [0, 0.25, 0.5, 0.75, 1].map(
      (t) => lookAt(ahead, ['left'], t, { x: 3, y: 1 }).heat,
    )
    expect(steps[0]).toBe(0.5)
    expect(steps.at(-1)).toBe(0)
    steps.slice(1).forEach((heat, i) => expect(heat).toBeLessThanOrEqual(steps[i]))
  })

  it('재시작은 재 자국에서 숯이 다시 서고 불과 불씨 칸이 꺼진다', () => {
    const burnt = play(createState(LINE_STAGE), ['down', 'up']).state
    const fresh = createState(LINE_STAGE)
    const restartAt = (t: number) =>
      fireScene({
        before: burnt,
        game: fresh,
        events: [],
        moving: true,
        dropping: true,
        t,
        elapsed: 0,
        segments: [],
        tail: 0,
        stepT: 1,
      })

    expect(fireLookOf(restartAt(0), WALL)).toMatchObject({ stand: 0, mark: 1 })
    expect(fireLookOf(restartAt(0), SPARK).lit).toBe(1)
    expect(fireLookOf(restartAt(0), NEAR).heat).toBe(1)
    const mid = fireLookOf(restartAt(0.5), WALL)
    expect(mid.stand).toBeGreaterThan(0)
    expect(mid.stand).toBeLessThan(1)
    expect(fireLookOf(restartAt(1), WALL)).toMatchObject({ stand: 1, mark: 0, heat: 0 })
    expect(fireLookOf(restartAt(1), SPARK).lit).toBe(0)
    expect(fireLookOf(restartAt(1), NEAR).heat).toBe(0)
  })

  it('쫓아오는 불 판의 숯은 보스 불이다', () => {
    const state = createState(FORK_STAGE)

    expect(fireLookOf(sceneAt(state, state, [], 1), { x: 1, y: 1 }).boss).toBe(true)
    expect(fireLookOf(sceneAt(state, state, [], 1), { x: 0, y: 0 }).boss).toBe(false)
  })
})
