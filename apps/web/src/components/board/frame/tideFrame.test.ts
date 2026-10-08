import { describe, expect, it } from 'vitest'

import { WATER } from '../view'
import { SHUTTLE, TIDE_STAGE, lastMove } from './testStages'
import { NO_TIDE, tideDisplay, tideLookOf } from './tideFrame'
import { TILE } from '@/game/iso'
import { createState } from '@/game/rules'
import type { GameState } from '@/game/types'

const look = (
  before: GameState,
  game: GameState,
  { t = 1, moving = false, dropping = false, level = 1 } = {},
) => tideLookOf({ before, moving, dropping, sluice: { phase: { level } } }, { game, t })

describe('tideDisplay', () => {
  it('남은 수와 방향', () => {
    const start = createState(TIDE_STAGE)
    const three = lastMove(TIDE_STAGE, SHUTTLE.slice(0, 3))
    const five = lastMove(TIDE_STAGE, [...SHUTTLE, 'right'])

    expect(tideDisplay(start, [], false)).toEqual({ left: 4, up: true, turning: false })
    expect(tideDisplay(three.game, three.events, true)).toEqual({
      left: 1,
      up: true,
      turning: false,
    })
    expect(tideDisplay(five.game, five.events, true)).toEqual({
      left: 3,
      up: false,
      turning: false,
    })
  })

  it('물때가 바뀌는 수의 연출 동안은 0, 끝나면 다음 숫자', () => {
    const { game, events } = lastMove(TIDE_STAGE, SHUTTLE)

    expect(tideDisplay(game, events, true)).toEqual({ left: 0, up: false, turning: true })
    expect(tideDisplay(game, events, false)).toEqual({ left: 4, up: false, turning: false })
  })

  it('밀물 판이 아니면 null', () => {
    expect(tideDisplay(createState({ ...TIDE_STAGE, rules: undefined }), [], false)).toBeNull()
    expect(tideDisplay(null, [], false)).toBeNull()
  })
})

describe('tideLookOf 젖은 빛', () => {
  it('TIDE 1 ▲에서 잠기는 줄 윗면만 젖은 빛', () => {
    const { game } = lastMove(TIDE_STAGE, SHUTTLE.slice(0, 3))
    const at = look(game, game)

    expect(at({ x: 2, y: 2 }).wet).toBe(1)
    expect(at({ x: 4, y: 2 }).wet).toBe(0)
    expect(at({ x: 2, y: 1 }).wet).toBe(0)
  })

  it('TIDE 1 ▲가 되는 수 동안 서서히 젖는 빛', () => {
    const { prev, game } = lastMove(TIDE_STAGE, SHUTTLE.slice(0, 3))
    const wet = (t: number) => look(prev, game, { t, moving: true, level: 1 })({ x: 2, y: 2 }).wet

    expect(wet(0)).toBe(0)
    expect(wet(0.5)).toBeGreaterThan(0.2)
    expect(wet(0.5)).toBeLessThan(0.8)
    expect(wet(1)).toBe(1)
  })

  it('밀물 수에는 수면 진행도를 따라 옅어지는 빛', () => {
    const { prev, game } = lastMove(TIDE_STAGE, SHUTTLE)
    const wet = (level: number) =>
      look(prev, game, { t: 0.5, moving: true, level })({ x: 2, y: 2 }).wet

    expect(wet(0)).toBe(1)
    expect(wet(0.5)).toBeCloseTo(0.5)
    expect(wet(1)).toBe(0)
  })

  it('집 칸은 젖은 빛 제외', () => {
    const stage = { ...TIDE_STAGE, goal: { x: 2, y: 2 } }
    const { game } = lastMove(stage, SHUTTLE.slice(0, 3))

    expect(look(game, game)({ x: 2, y: 2 }).wet).toBe(0)
  })
})

describe('tideLookOf 젖은 띠', () => {
  const sevenMoves = [...SHUTTLE, ...SHUTTLE.slice(0, 3)]

  it('TIDE 1 ▼에서 높은 물이 닿는 벽 면만 띠', () => {
    const { game } = lastMove(TIDE_STAGE, sevenMoves)
    const at = look(game, game)

    expect(at({ x: 2, y: 1 })).toMatchObject({ band: 1, bandLeft: true, bandRight: false })
    expect(at({ x: 0, y: 2 })).toMatchObject({ band: 1, bandLeft: false, bandRight: true })
    expect(at({ x: 3, y: 1 })).toMatchObject({ bandLeft: true })
    expect(at({ x: 1, y: 0 })).toMatchObject({ bandLeft: false, bandRight: false })
  })

  it('한 층 높은 벽은 수면 위 lip 높이 띠, 더 높은 벽은 한 층 띠', () => {
    const stage = {
      ...TIDE_STAGE,
      heights: TIDE_STAGE.heights.map((row, y) => (y === 1 ? [2, 2, 3, 2, 2, 3] : row)),
    }
    const { game } = lastMove(stage, sevenMoves)
    const at = look(game, game)

    expect(at({ x: 1, y: 1 })).toMatchObject({ bandTop: 0, bandHeight: WATER.lip })
    expect(at({ x: 2, y: 1 })).toMatchObject({ bandTop: WATER.lip, bandHeight: TILE.layer })
  })

  it('▼ 4에서 2까지는 띠 없음', () => {
    const { game } = lastMove(TIDE_STAGE, [...SHUTTLE, 'right'])

    expect(look(game, game)({ x: 2, y: 1 }).band).toBe(0)
  })

  it('썰물 수에는 수면 진행도를 따라 옅어지는 띠', () => {
    const { prev, game } = lastMove(TIDE_STAGE, [...SHUTTLE, ...SHUTTLE])
    const band = (level: number) =>
      look(prev, game, { t: 0.5, moving: true, level })({ x: 2, y: 1 }).band

    expect(band(0)).toBe(1)
    expect(band(0.5)).toBeCloseTo(0.5)
    expect(band(1)).toBe(0)
  })
})

describe('tideLookOf 재시작', () => {
  it('재시작 진행도를 따라 옅어지는 젖은 빛', () => {
    const { game: before } = lastMove(TIDE_STAGE, SHUTTLE.slice(0, 3))
    const game = createState(TIDE_STAGE)
    const wet = (level: number) =>
      look(before, game, { t: 0.5, dropping: true, level })({ x: 2, y: 2 }).wet

    expect(wet(0)).toBe(1)
    expect(wet(0.5)).toBeCloseTo(0.5)
    expect(wet(1)).toBe(0)
  })

  it('밀물 판이 아니면 늘 같은 빈 값', () => {
    const game = createState({ ...TIDE_STAGE, rules: undefined })

    expect(look(game, game)({ x: 2, y: 2 })).toBe(NO_TIDE)
  })
})
