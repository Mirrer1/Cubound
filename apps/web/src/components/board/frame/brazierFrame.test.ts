import { describe, expect, it } from 'vitest'

import { BRAZIER } from '../view'
import {
  BOX_BURN,
  BRAZIER_LIGHT,
  bowlLift,
  brazierEnd,
  brazierLightEnd,
  brazierLookOf,
  brazierScene,
  flameDisplay,
  isBrazier,
} from './brazierFrame'
import { SECONDS } from './pathFrame'
import { durationOf } from './timeFrame'
import { createState, move } from '@/game/rules'
import type { Direction, GameEvent, GameState, Point, Stage } from '@/game/types'

// 윗줄 (1,0) 화로에서 세 칸 걸어 (4,0) 숯 벽, 아랫줄은 걷는 길
const STAGE: Stage = {
  version: 1,
  id: 'test-brazier',
  name: '화로',
  heights: [
    [0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0],
  ],
  fire: ['.@..#.', '*.....'],
  start: { x: 0, y: 0 },
  goal: { x: 5, y: 1 },
  entities: [],
}

// 상자 둘 사이 화로, 불 붙은 채 밀면 타는 상자
const BOX_STAGE: Stage = {
  version: 1,
  id: 'test-brazier-box',
  name: '타는 짐',
  heights: [
    [0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, -1],
  ],
  fire: ['.@....', '......'],
  start: { x: 0, y: 0 },
  goal: { x: 0, y: 1 },
  entities: [
    { type: 'box', x: 3, y: 0 },
    { type: 'box', x: 4, y: 1 },
  ],
  rules: { burnBox: true },
}

const play = (state: GameState, dirs: Direction[]) =>
  dirs.reduce<{ before: GameState; state: GameState; events: GameEvent[] }>(
    ({ state: s }, dir) => ({ before: s, ...move(s, dir) }),
    { before: state, state, events: [] },
  )

const sceneAt = (
  played: { before: GameState; state: GameState; events: GameEvent[] },
  stepT: number,
  { dropping = false, spread = stepT, elapsed = stepT * 0.24 } = {},
) =>
  brazierScene({
    before: played.before,
    game: played.state,
    events: played.events,
    moving: stepT < 1,
    dropping,
    t: stepT,
    stepT,
    spread,
    elapsed,
  })

const START = createState(STAGE)
const LIT = play(START, ['right'])

describe('isBrazier, bowlLift', () => {
  it('화로 칸에서 그릇 높이, 칸 사이는 이어서', () => {
    expect(isBrazier(STAGE, { x: 1, y: 0 })).toBe(true)
    expect(isBrazier(STAGE, { x: 4, y: 0 })).toBe(false)
    expect(bowlLift(STAGE, 1, 0)).toBe(BRAZIER.height)
    expect(bowlLift(STAGE, 0, 0)).toBe(0)
    expect(bowlLift(STAGE, 0.5, 0)).toBeCloseTo(BRAZIER.height / 2)
    expect(bowlLift(STAGE, 1, 0.25)).toBeCloseTo(BRAZIER.height * 0.75)
  })
})

describe('brazierScene 큐브 빛', () => {
  it('꺼진 큐브는 화로에 다 올라선 뒤 빛이 아래에서 위로 차오름', () => {
    expect(LIT.state.flame).toBe(4)
    expect(sceneAt(LIT, 0.9, { elapsed: 0.22 }).glow.strength).toBe(0)
    const mid = sceneAt(LIT, 0.9, { elapsed: 0.3525 }).glow
    expect(mid.strength).toBeGreaterThan(0.4)
    expect(mid.strength).toBeLessThan(0.7)
    expect(mid.height).toBeLessThan(mid.strength / 2)
    expect(mid.flash).toBeGreaterThan(0.6)
    const end = sceneAt(LIT, 1).glow
    expect(end).toMatchObject({ strength: 1, height: 1, flash: 0 })
  })

  it('불 붙은 채 다시 밟으면 빛이 그릇 쪽으로 내려앉았다가 다 올라선 뒤 1로 다시 차오름', () => {
    const away = play(LIT.state, ['down'])
    expect(away.state.flame).toBe(3)
    const back = play(away.state, ['up'])
    expect(back.state.flame).toBe(4)
    const start = sceneAt(back, 0, { elapsed: 0 }).glow
    expect(start).toMatchObject({ strength: 0.88, height: 1 })
    const landed = sceneAt(back, 0.4, { elapsed: SECONDS.moved }).glow
    expect(landed.strength).toBeCloseTo(0.88)
    expect(landed.height).toBeCloseTo(0.45)
    const filling = sceneAt(back, 0.8, { elapsed: SECONDS.moved + BRAZIER_LIGHT / 2 }).glow
    expect(filling.strength).toBeCloseTo(1)
    expect(filling.height).toBeGreaterThan(0.45)
    expect(filling.height).toBeLessThan(1)
    expect(filling.flash).toBeCloseTo(1)
  })

  it('수마다 줄어드는 세기는 한 수 전체에 걸쳐 이어서', () => {
    const step = play(LIT.state, ['right'])
    expect(step.state.flame).toBe(3)
    expect(sceneAt(step, 0).glow.strength).toBeCloseTo(1)
    expect(sceneAt(step, 0.5).glow.strength).toBeCloseTo(0.94)
    expect(sceneAt(step, 1).glow.strength).toBeCloseTo(0.88)
  })

  it('번진 불이 닿은 수는 불 번짐 진행도로 차오름', () => {
    const caught = { before: START, state: { ...START, flame: 4 }, events: [] as GameEvent[] }
    caught.events.push({ type: 'ignited', at: START.player, by: 'fire' })
    expect(sceneAt(caught, 0.5, { spread: 0.3 }).glow.strength).toBeCloseTo(0.3)
    expect(sceneAt(caught, 0.5, { spread: 0.3 }).glow.height).toBeCloseTo(0.3)
  })

  it('꺼지는 수는 빛이 아래로 내려앉고 가운데쯤 마지막 불티', () => {
    const dying = play(LIT.state, ['down', 'right', 'right'])
    const out = play(dying.state, ['right'])
    expect(dying.state.flame).toBe(1)
    expect(out.events.some((e) => e.type === 'doused')).toBe(true)
    const third = sceneAt(out, 1 / 3).glow
    expect(third.strength).toBeCloseTo(0.64 * (2 / 3))
    expect(third.height).toBeLessThan(0.7)
    expect(sceneAt(out, 0.65).glow.last).toBeGreaterThan(0.9)
    expect(sceneAt(out, 1).glow).toMatchObject({ strength: 0, last: 0 })
  })

  it('남은 수 1의 깜빡임은 1이 되는 수에 이어서 차고 꺼지는 수에도 이어서', () => {
    const dying = play(LIT.state, ['down', 'right', 'right'])
    expect(sceneAt(dying, 1).glow.dip).toBe(1)
    expect(sceneAt(dying, 0.5).glow.dip).toBeCloseTo(0.5)
    expect(sceneAt(play(dying.state, ['right']), 0.5).glow.dip).toBe(1)
    expect(sceneAt(LIT, 1).glow.dip).toBe(0)
  })

  it('윗면 불티는 3 이상, 세기를 따라 이어서', () => {
    expect(sceneAt(LIT, 1).glow.spark).toBe(1)
    const two = play(LIT.state, ['down', 'right'])
    expect(sceneAt(two, 1).glow.spark).toBe(0)
    expect(sceneAt(two, 0.5).glow.spark).toBeGreaterThan(0)
  })

  it('재시작은 앞 상태의 빛이 내려앉는 동안 옅어짐', () => {
    const restart = { before: LIT.state, state: START, events: [] as GameEvent[] }
    expect(sceneAt(restart, 0, { dropping: true }).glow.strength).toBe(1)
    expect(sceneAt(restart, 1, { dropping: true }).glow.strength).toBe(0)
  })
})

describe('brazierScene 170', () => {
  const box = createState(BOX_STAGE)
  const lit = play(box, ['right'])
  const burnt = play(lit.state, ['right', 'right'])

  it('밀어 재가 되는 상자는 밀기 시작부터 BOX_BURN초', () => {
    expect(burnt.events.some((e) => e.type === 'boxBurned')).toBe(true)
    expect(brazierEnd(burnt.events)).toBe(BOX_BURN)
    expect(brazierEnd(lit.events)).toBe(0)
    expect(brazierLightEnd(lit.events)).toBeCloseTo(SECONDS.moved + BRAZIER_LIGHT)
    const at = sceneAt(burnt, 0.5, { elapsed: BOX_BURN / 2 }).burning
    expect(at).toEqual({ at: { x: 4, y: 0 }, q: 0.5 })
    expect(sceneAt(burnt, 1).burning).toBeNull()
  })

  it('타는 상자 칸, 재 자국은 바닥 칸만', () => {
    const scene = sceneAt(burnt, 0.8, { elapsed: BOX_BURN * 0.8 })
    const look = (p: Point, game = burnt.state, before = burnt.before) =>
      brazierLookOf({ scene, game, before, cube: game.player, box: null, boxHere: false, p })
    expect(look({ x: 4, y: 0 }).burn).toBeCloseTo(0.8)
    expect(look({ x: 4, y: 0 }).mark).toBeGreaterThan(0)
    const done = sceneAt(burnt, 1)
    const after = brazierLookOf({
      scene: done,
      game: burnt.state,
      before: burnt.state,
      cube: burnt.state.player,
      box: null,
      boxHere: false,
      p: { x: 4, y: 0 },
    })
    expect(after).toMatchObject({ burn: -1, mark: 1 })
    const pit = { ...burnt.state, charred: [{ x: 5, y: 1 }] }
    const inPit = brazierLookOf({
      scene: done,
      game: pit,
      before: pit,
      cube: pit.player,
      box: null,
      boxHere: false,
      p: { x: 5, y: 1 },
    })
    expect(inPit.mark).toBe(0)
  })

  it('재시작에 재 자국이 옅어짐', () => {
    const restart = sceneAt({ before: burnt.state, state: box, events: [] }, 0.5, {
      dropping: true,
    })
    const look = brazierLookOf({
      scene: restart,
      game: box,
      before: burnt.state,
      cube: box.player,
      box: null,
      boxHere: false,
      p: { x: 4, y: 0 },
    })
    expect(look.mark).toBeGreaterThan(0)
    expect(look.mark).toBeLessThan(1)
  })
})

describe('brazierLookOf 화로 칸', () => {
  it('그릇 높이, 올라선 큐브가 덮은 정도와 속불빛', () => {
    const scene = sceneAt(LIT, 0.9, { elapsed: 0.3525 })
    const look = brazierLookOf({
      scene,
      game: LIT.state,
      before: LIT.before,
      cube: { x: 0.8, y: 0 },
      box: null,
      boxHere: false,
      p: { x: 1, y: 0 },
    })
    expect(look.on).toBe(true)
    expect(look.lift).toBe(BRAZIER.height)
    expect(look.covered).toBeCloseTo(0.8)
    expect(look.flash).toBeGreaterThan(0.5)
    const plain = brazierLookOf({
      scene,
      game: LIT.state,
      before: LIT.before,
      cube: { x: 0.8, y: 0 },
      box: null,
      boxHere: true,
      p: { x: 3, y: 0 },
    })
    expect(plain).toMatchObject({ on: false, lift: 0, covered: 0, flash: 0 })
  })
})

describe('brazierEnd', () => {
  it('숯 벽에 불을 붙이는 수는 밀기와 같은 0.26초, 상자가 타는 수는 0.5초', () => {
    const torched = play(LIT.state, ['right', 'right', 'right'])
    expect(torched.events.map((e) => e.type)).toContain('torched')
    expect(durationOf(torched.events)).toBeCloseTo(0.26)
    const box = play(createState(BOX_STAGE), ['right', 'right', 'right'])
    expect(durationOf(box.events)).toBeCloseTo(BOX_BURN)
  })
})

describe('flameDisplay', () => {
  it('불이 있는 동안 남은 수, 꺼지는 수의 연출 동안 0, 그 뒤 없음', () => {
    expect(flameDisplay(START, [], false)).toBeNull()
    expect(flameDisplay(LIT.state, LIT.events, true)).toEqual({ count: 4, out: false })
    const out = play(LIT.state, ['down', 'right', 'right', 'right'])
    expect(flameDisplay(out.state, out.events, true)).toEqual({ count: 0, out: true })
    expect(flameDisplay(out.state, out.events, false)).toBeNull()
  })
})
