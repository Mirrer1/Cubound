import { describe, expect, it } from 'vitest'

import { selectGuides } from './selectGuide'

const targets = (hasOpen: boolean, hasLocked: boolean) =>
  selectGuides(hasOpen, hasLocked).map((guide) => guide.target)

describe('selectGuides', () => {
  it('열린 카드와 잠긴 카드가 다 있으면 여섯 단계를 차례대로 비춘다', () => {
    expect(targets(true, true)).toEqual([
      'stage',
      'locked',
      'stars',
      'worlds',
      'chapter',
      'chapterCard',
    ])
  })

  it('잠긴 카드가 없으면 잠긴 카드 단계를 건너뛴다', () => {
    expect(targets(true, false)).toEqual(['stage', 'stars', 'worlds', 'chapter', 'chapterCard'])
  })

  it('월드가 잠겨 열린 카드가 없으면 판 카드 단계를 건너뛴다', () => {
    expect(targets(false, true)).toEqual(['locked', 'stars', 'worlds', 'chapter', 'chapterCard'])
  })

  it('단계마다 다른 문구를 쓴다', () => {
    const ids = selectGuides(true, true).map((guide) => guide.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
