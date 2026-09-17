import { EMPTY_PROGRESS, type Progress, migrateProgress } from '@/game/progress'

const KEY = 'cubound:progress'

export interface ProgressStorage {
  load: () => Progress
  save: (progress: Progress) => void
}

// 저장이 막힌 브라우저에서도 게임은 계속되도록 실패를 무시한다
export const localProgressStorage: ProgressStorage = {
  load: () => {
    try {
      const saved = localStorage.getItem(KEY)
      return saved ? migrateProgress(JSON.parse(saved)) : EMPTY_PROGRESS
    } catch {
      return EMPTY_PROGRESS
    }
  },
  save: (progress) => {
    try {
      localStorage.setItem(KEY, JSON.stringify(progress))
    } catch {
      // 저장 실패는 이번 세션 진행에 영향 없음
    }
  },
}
