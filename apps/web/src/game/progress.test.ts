import { describe, expect, it } from 'vitest'

import {
  EMPTY_PROGRESS,
  isUnlocked,
  isWorldUnlocked,
  migrateProgress,
  recordClear,
  shouldShowGuide,
  totalStars,
} from './progress'
import type { Stage } from './types'

const IDS = ['1-1', '1-2', '1-3']

const STAGE: Stage = {
  version: 1,
  id: '1-1',
  name: '테스트',
  heights: [[0, 0]],
  start: { x: 0, y: 0 },
  goal: { x: 1, y: 0 },
  entities: [],
  best: 1,
  guides: [{ id: 'goal', target: { x: 1, y: 0 } }],
}

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

  it('보스 이동 제한이 있으면 그 제한을 별 기준으로 쓴다', () => {
    const progress = recordClear(EMPTY_PROGRESS, '1-10', 22, 20, 22)

    expect(progress.stages['1-10']).toEqual({ bestMoves: 22, stars: 2 })
    expect(recordClear(EMPTY_PROGRESS, '1-10', 20, 20, 22).stages['1-10'].stars).toBe(3)
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

describe('isWorldUnlocked', () => {
  it('첫 월드는 기록이 없어도 열려 있다', () => {
    expect(isWorldUnlocked(EMPTY_PROGRESS, undefined)).toBe(true)
  })

  it('앞 월드의 마지막 스테이지를 클리어하면 열린다', () => {
    const progress = recordClear(EMPTY_PROGRESS, '1-10', 40, 20)

    expect(isWorldUnlocked(progress, '1-10')).toBe(true)
  })

  it('앞 월드의 마지막 스테이지가 남아 있으면 잠겨 있다', () => {
    const progress = recordClear(EMPTY_PROGRESS, '1-9', 40, 20)

    expect(isWorldUnlocked(progress, '1-10')).toBe(false)
    expect(isWorldUnlocked(EMPTY_PROGRESS, '1-10')).toBe(false)
  })
})

describe('shouldShowGuide', () => {
  it('클리어하지 않은 스테이지에 가이드가 있으면 띄운다', () => {
    expect(shouldShowGuide(STAGE, EMPTY_PROGRESS)).toBe(true)
  })

  it('클리어한 스테이지면 띄우지 않는다', () => {
    expect(shouldShowGuide(STAGE, recordClear(EMPTY_PROGRESS, '1-1', 3, 1))).toBe(false)
  })

  it('다른 스테이지만 클리어했으면 띄운다', () => {
    expect(shouldShowGuide(STAGE, recordClear(EMPTY_PROGRESS, '1-2', 3, 1))).toBe(true)
  })

  it('가이드가 없거나 비어 있으면 띄우지 않는다', () => {
    expect(shouldShowGuide({ ...STAGE, guides: undefined }, EMPTY_PROGRESS)).toBe(false)
    expect(shouldShowGuide({ ...STAGE, guides: [] }, EMPTY_PROGRESS)).toBe(false)
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
