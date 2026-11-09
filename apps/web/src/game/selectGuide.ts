export type SelectGuideTarget = 'stage' | 'locked' | 'stars' | 'worlds' | 'chapter' | 'chapterCard'

export interface SelectGuide {
  id: string // 문구 사전의 guide 키
  target: SelectGuideTarget
}

const STEPS: SelectGuide[] = [
  { id: 'selectStage', target: 'stage' },
  { id: 'selectLocked', target: 'locked' },
  { id: 'selectStars', target: 'stars' },
  { id: 'selectWorld', target: 'worlds' },
  { id: 'selectChapter', target: 'chapter' },
  { id: 'selectChapterCard', target: 'chapterCard' },
]

// 스테이지 선택 가이드 단계, 비출 카드가 없는 단계 제외
export const selectGuides = (hasOpen: boolean, hasLocked: boolean) =>
  STEPS.filter(
    ({ target }) => (target !== 'stage' || hasOpen) && (target !== 'locked' || hasLocked),
  )
