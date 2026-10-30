import { describe, expect, it } from 'vitest'

import { NO_TRAIL, TRAIL_POOL, trailLookOf, trailScene } from './trailFrame'
import { createState, move } from '@/game/rules'
import type { Direction, GameEvent, GameState, Point, Stage } from '@/game/types'

// 2x3 빈터, 꼬리 불 판
const STAGE: Stage = {
  version: 1,
  id: 'test-trail',
  name: '꼬리 불',
  heights: [
    [0, 0, 0],
    [0, 0, 0],
  ],
  fire: ['...', '...'],
  start: { x: 0, y: 1 },
  goal: { x: 2, y: 1 },
  entities: [],
  rules: { trail: true },
}

const p = (x: number, y: number): Point => ({ x, y })

const play = (dirs: Direction[], from: GameState = createState(STAGE)) =>
  dirs.reduce<{ before: GameState; state: GameState; events: GameEvent[]; prev: GameEvent[] }>(
    ({ state, events }, dir) => {
      const next = move(state, dir)
      return { before: state, state: next.state, events: next.events, prev: events }
    },
    { before: from, state: from, events: [], prev: [] },
  )

const sceneOf = (played: ReturnType<typeof play>, stepT: number, moving = stepT < 1) =>
  trailScene({
    before: moving ? played.before : played.state,
    game: played.state,
    events: played.events,
    prevEvents: played.prev,
    moving,
    dropping: false,
    t: stepT,
    stepT,
  })

// 진행도 0, 0.25, 0.5, 0.75, 1에서 칸 하나의 값
const along = (played: ReturnType<typeof play>, at: Point, key: 'flame' | 'pool' | 'mark') =>
  [0, 0.25, 0.5, 0.75, 1].map((q) => +trailLookOf(sceneOf(played, q, true), at)[key].toFixed(3))

describe('trailScene', () => {
  it('꼬리 불 판이 아니면 null이다', () => {
    const game = createState({ ...STAGE, rules: undefined })
    const scene = trailScene({
      before: game,
      game,
      events: [],
      prevEvents: [],
      moving: false,
      dropping: false,
      t: 1,
      stepT: 1,
    })

    expect(scene).toBeNull()
    expect(trailLookOf(scene, p(0, 0))).toEqual(NO_TRAIL)
  })
})

describe('trailLookOf', () => {
  it('떠난 칸은 켜진 불 세기 1로 그려지고 빛 고임이 TRAIL_POOL에서 1로 차오른다', () => {
    const played = play(['up'])

    expect(along(played, p(0, 1), 'flame')).toEqual([1, 1, 1, 1, 1])
    expect(trailLookOf(sceneOf(played, 0, true), p(0, 1)).lit).toBe(true)
    expect(along(played, p(0, 1), 'pool')[0]).toBe(TRAIL_POOL)
    expect(along(played, p(0, 1), 'pool')[4]).toBe(1)
  })

  it('남은 수 3, 2, 1은 세기 1, 0.88, 0.76이고 수 동안 이어서 줄어든다', () => {
    const played = play(['up', 'right', 'right'])

    expect(trailLookOf(sceneOf(played, 1), p(1, 0)).flame).toBe(1)
    expect(trailLookOf(sceneOf(played, 1), p(0, 0)).flame).toBe(0.88)
    expect(trailLookOf(sceneOf(played, 1), p(0, 1)).flame).toBe(0.76)
    expect(along(played, p(0, 1), 'flame')).toEqual([0.88, 0.861, 0.82, 0.779, 0.76])
  })

  it('꺼지는 칸은 꺼진 불로 남은 세기를 그대로 두고 그을음이 0에서 1로 차오른다', () => {
    const played = play(['up', 'right', 'right', 'down'])

    expect(along(played, p(0, 1), 'flame')).toEqual([0.76, 0.76, 0.76, 0.76, 0.76])
    expect(trailLookOf(sceneOf(played, 0, true), p(0, 1)).lit).toBe(false)
    expect(along(played, p(0, 1), 'mark')).toEqual([0, 0.156, 0.5, 0.844, 1])
  })

  it('그을음은 쉬는 동안 남고 다음 수 동안 1에서 0으로 지워지며 그동안 꺼진 불로 남는다', () => {
    const out = play(['up', 'right', 'right', 'down'])
    const next = play(['left'], out.state)
    const played = { ...next, prev: out.events }

    expect(trailLookOf(sceneOf(out, 1, false), p(0, 1))).toMatchObject({ mark: 1, lit: false })
    expect(along(played, p(0, 1), 'mark')).toEqual([1, 0.844, 0.5, 0.156, 0])
    expect(trailLookOf(sceneOf(played, 0.5, true), p(0, 1)).lit).toBe(false)
  })

  it('재시작하면 꼬리 불이 그 진행도로 옅어진다', () => {
    const played = play(['up', 'right'])
    const restart = (t: number) =>
      trailScene({
        before: played.state,
        game: createState(STAGE),
        events: [],
        prevEvents: [],
        moving: true,
        dropping: true,
        t,
        stepT: t,
      })

    expect([0, 0.5, 1].map((t) => trailLookOf(restart(t), p(0, 0)).flame)).toEqual([1, 0.5, 0])
  })
})
