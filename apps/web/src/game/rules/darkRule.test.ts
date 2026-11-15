import { describe, expect, it } from 'vitest'

import { isDark, isNightStage } from './darkRule'
import { FLAT_STAGE, play } from './testStages'

const NIGHT = { ...FLAT_STAGE, id: '21-1' }

describe('isNightStage', () => {
  it('21월드부터 어둠 박자가 돈다', () => {
    expect(
      ['20-10', '21-1', '25-10', 'test'].map((id) => isNightStage({ ...FLAT_STAGE, id })),
    ).toEqual([false, true, true, false])
  })
})

describe('isDark', () => {
  it('네 수 밝고 두 수 어둡다', () => {
    const darks = [0, 1, 2, 3, 4, 5, 6, 7, 10].map((moves) =>
      isDark({ ...play(NIGHT, []).state, moves }),
    )

    expect(darks).toEqual([false, false, false, false, true, true, false, false, true])
  })

  it('20월드까지는 늘 밝다', () => {
    expect(isDark({ ...play(FLAT_STAGE, []).state, moves: 4 })).toBe(false)
  })
})
