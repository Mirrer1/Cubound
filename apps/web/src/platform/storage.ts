import { EMPTY_PROGRESS, type Progress, migrateProgress } from '@/game/progress'
import type { Session } from '@/game/session'
import { type Language, isLanguage, languageFrom } from '@/i18n'

const KEY = 'cubound:progress'
const LANGUAGE_KEY = 'cubound:language'
const SESSION_KEY = 'cubound:session'

export interface ProgressStorage {
  load: () => Progress
  save: (progress: Progress) => void
}

export interface LanguageStorage {
  load: () => Language
  save: (language: Language) => void
}

export interface SessionStorage {
  load: () => unknown // 지금 스테이지와 맞는지는 game/session.ts의 restoreSession이 가린다
  save: (session: Session) => void
  clear: () => void
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

// 고른 적이 없으면 기기 언어를 따른다
export const localLanguageStorage: LanguageStorage = {
  load: () => {
    try {
      const saved = localStorage.getItem(LANGUAGE_KEY)
      if (isLanguage(saved)) return saved
    } catch {
      // 저장을 못 읽어도 기기 언어로 시작한다
    }
    return languageFrom(navigator.languages)
  },
  save: (language) => {
    try {
      localStorage.setItem(LANGUAGE_KEY, language)
    } catch {
      // 저장 실패는 이번 세션 진행에 영향 없음
    }
  },
}

// 진행 중인 스테이지 하나의 중간 상태. 진행 기록과 다른 키에 둔다
export const localSessionStorage: SessionStorage = {
  load: () => {
    try {
      const saved = localStorage.getItem(SESSION_KEY)
      return saved ? JSON.parse(saved) : null
    } catch {
      return null
    }
  },
  save: (session) => {
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(session))
    } catch {
      // 저장 실패는 이번 세션 진행에 영향 없음
    }
  },
  clear: () => {
    try {
      localStorage.removeItem(SESSION_KEY)
    } catch {
      // 지우지 못해도 다음 저장이 덮어쓴다
    }
  },
}
