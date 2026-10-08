import { describe, expect, it } from 'vitest'

import { swampTime } from './swampFrame'
import { STAGE, WIND_STAGE, gust } from './testStages'
import { stepProgress } from './timeFrame'
import { ownProgress, windDisplay, windLeaning, windSeconds } from './windFrame'
import { createState, move, windLeft } from '@/game/rules'

describe('ownProgress', () => {
  it('바람이 분 수는 바람이 불기 전에 1이 되고 안 분 수는 stepProgress와 같다', () => {
    const { events } = gust()
    const calm = move(createState(STAGE), 'right').events

    expect(ownProgress(events, 0.24 / 0.54)).toBeCloseTo(1)
    expect(ownProgress(events, 0.12 / 0.54)).toBeCloseTo(0.5)
    expect(ownProgress(calm, 0.3)).toBe(stepProgress(calm, 0.3))
  })
})

describe('windLeaning', () => {
  it('바람에 밀리거나 기대는 동안만 참이다', () => {
    const { events } = gust()

    expect(windLeaning(events, 0.2)).toBe(false)
    expect(windLeaning(events, 0.7)).toBe(true)
    expect(windLeaning(move(createState(STAGE), 'right').events, 0.5)).toBe(false)
  })
})

describe('windSeconds', () => {
  it('내 이동 연출이 끝나 바람이 부는 초를 돌려주고 바람이 안 분 수는 null이다', () => {
    const { events } = gust()

    expect(windSeconds(events)).toBeCloseTo(0.24)
    expect(windSeconds(move(createState(STAGE), 'right').events)).toBeNull()
  })
})

describe('windDisplay', () => {
  it('바람이 분 수의 연출 중에는 바람 시각을 주고 숫자는 앞 상태로 둔다', () => {
    const { prev, game, events } = gust()
    const shown = windDisplay({ game, prevGame: prev, events, animating: true })

    expect(shown.gustAt).toBe(windSeconds(events, swampTime(prev, game)))
    expect(shown.gustAt).not.toBeNull()
    expect(shown.wind).toBe(windLeft(prev))
  })

  it('바람이 분 수의 연출이 끝나면 다음 숫자로 바뀐다', () => {
    const { prev, game, events } = gust()
    const shown = windDisplay({ game, prevGame: prev, events, animating: false })

    expect(shown.wind).toBe(windLeft(game))
    expect(shown.wind).not.toBe(windLeft(prev))
  })

  it('바람이 안 분 수는 연출 중에도 지금 숫자를 보인다', () => {
    const prev = createState(WIND_STAGE)
    const { state: game, events } = move(prev, 'up')
    const shown = windDisplay({ game, prevGame: prev, events, animating: true })

    expect(shown).toEqual({ gustAt: null, wind: windLeft(game) })
  })

  it('앞 상태가 없으면 바람 시각이 없고 판이 없으면 숫자도 없다', () => {
    const game = createState(WIND_STAGE)

    expect(windDisplay({ game, prevGame: null, events: [], animating: false })).toEqual({
      gustAt: null,
      wind: windLeft(game),
    })
    expect(windDisplay({ game: null, prevGame: null, events: [], animating: false })).toEqual({
      gustAt: null,
      wind: null,
    })
  })
})
