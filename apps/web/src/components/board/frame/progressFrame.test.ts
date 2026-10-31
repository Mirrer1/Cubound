import { describe, expect, it } from 'vitest'

import { SECONDS } from './pathFrame'
import { countDisplay, riseProgress, sluicePhase, stepProgress } from './progressFrame'
import {
  PLANT,
  RIDE,
  SEED_STAGE,
  SHUTTLE,
  SLUICE_STAGE,
  STAGE,
  TIDE_STAGE,
  lastMove,
} from './testStages'
import { SLUICE, durationOf } from './timeFrame'
import { createState, move } from '@/game/rules'

describe('stepProgress', () => {
  it('솟는 수는 이동 몫이 끝날 때 1이 된다', () => {
    const { events } = lastMove(SEED_STAGE, RIDE)

    expect(stepProgress(events, 0.2)).toBeCloseTo(0.5)
    expect(stepProgress(events, 0.4)).toBeCloseTo(1)
    expect(stepProgress(events, 0.8)).toBe(1)
  })

  it('솟지 않는 수는 t 그대로다', () => {
    const { events } = lastMove(SEED_STAGE, [...PLANT, 'left'])

    expect(stepProgress(events, 0.3)).toBeCloseTo(0.3)
  })
})

describe('riseProgress', () => {
  it('이동이 끝난 뒤에 시작해 끝에서 1이 된다', () => {
    const { events } = lastMove(SEED_STAGE, RIDE)

    expect(riseProgress(events, 0)).toBe(0)
    expect(riseProgress(events, 0.4)).toBeCloseTo(0)
    expect(riseProgress(events, 0.7)).toBeGreaterThan(0)
    expect(riseProgress(events, 0.7)).toBeLessThan(1)
    expect(riseProgress(events, 1)).toBe(1)
  })

  it('처음과 끝에서 느려 튀지 않는다', () => {
    const { events } = lastMove(SEED_STAGE, RIDE)
    const at = (seconds: number) => riseProgress(events, (0.24 + seconds) / 0.6)

    expect(at(0.036)).toBeLessThan(0.05)
    expect(1 - at(0.324)).toBeLessThan(0.05)
  })
})

describe('countDisplay', () => {
  const prevGame = createState(STAGE)
  const { state: game, events } = move(prevGame, 'right')
  const count = (state: typeof game) => state.moves * 2
  const at = () => [0.1, 0.2]
  const view = { game, prevGame, events, animating: true, passed: 0 }

  it('연출 중에는 지난 순간 수만큼만 다음 숫자로 다가간다', () => {
    expect(countDisplay(view, count, at)).toEqual({ at: [0.1, 0.2], count: 0 })
    expect(countDisplay({ ...view, passed: 1 }, count, at).count).toBe(1)
    expect(countDisplay({ ...view, passed: 2 }, count, at).count).toBe(2)
  })

  it('연출이 끝났거나 앞 상태가 없으면 지금 숫자다', () => {
    expect(countDisplay({ ...view, animating: false }, count, at)).toEqual({ at: [], count: 2 })
    expect(countDisplay({ ...view, prevGame: null }, count, at)).toEqual({ at: [], count: 2 })
  })

  it('판이 없거나 숫자가 없는 판이면 null이다', () => {
    expect(countDisplay({ ...view, game: null }, count, at)).toEqual({ at: [], count: null })
    expect(countDisplay(view, () => null, at)).toEqual({ at: [], count: null })
  })
})

describe('sluicePhase', () => {
  it('꼭지는 움직임 뒤 0.12초에, 수면은 그 뒤 0.48초에 걸쳐 바뀐다', () => {
    const { events } = lastMove(SLUICE_STAGE, ['left'])
    const total = durationOf(events)
    const at = (seconds: number) => sluicePhase(events, seconds / total)

    expect(at(SECONDS.moved)).toEqual({ tap: 0, level: 0, freeze: 0, thaw: 0, slab: 0 })
    expect(at(SECONDS.moved + SLUICE.tap)).toMatchObject({ tap: 1, level: 0 })
    expect(at(SECONDS.moved + SLUICE.tap + SLUICE.level / 2).level).toBeCloseTo(0.5)
    expect(at(total)).toMatchObject({ tap: 1, level: 1 })
  })

  it('밀물은 꼭지 기다림 없이 움직임 바로 뒤 0.48초에 걸쳐 바뀌는 수면', () => {
    const { events } = lastMove(TIDE_STAGE, SHUTTLE)
    const total = durationOf(events)
    const at = (seconds: number) => sluicePhase(events, seconds / total)

    expect(total).toBeCloseTo(SECONDS.moved + SLUICE.level)
    expect(at(SECONDS.moved).level).toBe(0)
    expect(at(SECONDS.moved + SLUICE.level / 2).level).toBeCloseTo(0.5)
    expect(at(total)).toMatchObject({ tap: 1, level: 1 })
  })

  it('물이 그대로인 수는 처음부터 다 바뀐 진행도', () => {
    const { events } = lastMove(SLUICE_STAGE, ['down'])

    expect(sluicePhase(events, 0)).toEqual({ tap: 1, level: 1, freeze: 1, thaw: 1, slab: 1 })
  })
})
