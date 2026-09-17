import { describe, expect, it } from 'vitest'

import { EMPTY_PROGRESS, isUnlocked, migrateProgress, recordClear, totalStars } from './progress'

const IDS = ['1-1', '1-2', '1-3']

describe('recordClear', () => {
  it('처음 클리어하면 이동 수와 별을 기록한다', () => {
    const progress = recordClear(EMPTY_PROGRESS, '1-1', 20, 20)

    expect(progress.stages['1-1']).toEqual({ bestMoves: 20, stars: 3 })
  })

  it('더 적은 이동으로 클리어하면 기록을 갱신한다', () => {
    const first = recordClear(EMPTY_PROGRESS, '1-1', 30, 20)
    const second = recordClear(first, '1-1', 22, 20)

    expect(second.stages['1-1']).toEqual({ bestMoves: 22, stars: 2 })
  })

  it('기록보다 많거나 같은 이동이면 그대로 둔다', () => {
    const first = recordClear(EMPTY_PROGRESS, '1-1', 20, 20)

    expect(recordClear(first, '1-1', 25, 20)).toBe(first)
    expect(recordClear(first, '1-1', 20, 20)).toBe(first)
  })
})

describe('isUnlocked', () => {
  it('첫 스테이지는 처음부터 열려 있다', () => {
    expect(isUnlocked(EMPTY_PROGRESS, IDS, '1-1')).toBe(true)
    expect(isUnlocked(EMPTY_PROGRESS, IDS, '1-2')).toBe(false)
  })

  it('앞 스테이지를 클리어하면 다음 스테이지가 열린다', () => {
    const progress = recordClear(EMPTY_PROGRESS, '1-1', 40, 20)

    expect(isUnlocked(progress, IDS, '1-2')).toBe(true)
    expect(isUnlocked(progress, IDS, '1-3')).toBe(false)
  })

  it('목록에 없는 스테이지는 잠겨 있다', () => {
    expect(isUnlocked(EMPTY_PROGRESS, IDS, '1-9')).toBe(false)
  })
})

describe('totalStars', () => {
  it('스테이지별 별을 더한다', () => {
    const progress = recordClear(recordClear(EMPTY_PROGRESS, '1-1', 20, 20), '1-2', 24, 20)

    expect(totalStars(progress, IDS)).toBe(5)
  })
})

describe('migrateProgress', () => {
  it('현재 버전 기록은 그대로 읽는다', () => {
    const saved = { version: 1, stages: { '1-1': { bestMoves: 20, stars: 3 } } }

    expect(migrateProgress(saved)).toEqual(saved)
  })

  it('버전이 없던 예전 기록은 현재 버전으로 옮긴다', () => {
    const legacy = { stages: { '1-1': { bestMoves: 20, stars: 3 } } }

    expect(migrateProgress(legacy)).toEqual({ version: 1, ...legacy })
  })

  it('알 수 없거나 깨진 기록은 빈 진행으로 시작한다', () => {
    expect(migrateProgress(null)).toEqual(EMPTY_PROGRESS)
    expect(migrateProgress({ version: 99, stages: {} })).toEqual(EMPTY_PROGRESS)
    expect(migrateProgress({ version: 1, stages: 'x' })).toEqual(EMPTY_PROGRESS)
  })

  it('형식이 틀린 스테이지 기록은 빼고 읽는다', () => {
    const saved = {
      version: 1,
      stages: { '1-1': { bestMoves: 20, stars: 3 }, '1-2': { bestMoves: 'x' } },
    }

    expect(migrateProgress(saved)).toEqual({
      version: 1,
      stages: { '1-1': { bestMoves: 20, stars: 3 } },
    })
  })
})
