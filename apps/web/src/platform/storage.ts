import { EMPTY_PROGRESS, type Progress, migrateProgress } from '@/game/progress'
import type { Session } from '@/game/session'
import { type Language, isLanguage, languageFrom } from '@/i18n'

const KEY = 'cubound:progress'
const LANGUAGE_KEY = 'cubound:language'
const SESSION_KEY = 'cubound:session'
const WORLD_KEY = 'cubound:world'
const OVERVIEW_KEY = 'cubound:overview'

export interface ProgressStorage {
  load: () => Progress
  save: (progress: Progress) => void
}

export interface LanguageStorage {
  load: () => Language
  save: (language: Language) => void
}

// 목록에서 마지막으로 보던 월드, 시작과 스테이지 선택이 따로 기억하는 자리
export interface WorldStorage {
  load: (all: boolean) => number | undefined
  save: (all: boolean, world: number) => void
}

export interface OverviewStorage {
  load: () => boolean
  save: (overview: boolean) => void
}

export interface SessionStorage {
  load: () => unknown // 지금 스테이지와 맞는지는 game/session.ts의 restoreSession 몫
  save: (session: Session) => void
  clear: () => void
}

// 저장이 막힌 브라우저에서도 게임이 계속되는 실패 무시
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
      // 이번 세션 진행과 무관한 저장 실패
    }
  },
}

// 고른 적이 없으면 기기 언어
export const localLanguageStorage: LanguageStorage = {
  load: () => {
    try {
      const saved = localStorage.getItem(LANGUAGE_KEY)
      if (isLanguage(saved)) return saved
    } catch {
      // 저장을 못 읽어도 기기 언어로 시작
    }
    return languageFrom(navigator.languages)
  },
  save: (language) => {
    try {
      localStorage.setItem(LANGUAGE_KEY, language)
    } catch {
      // 이번 세션 진행과 무관한 저장 실패
    }
  },
}

// 한 칸에 담은 두 자리, 시작은 순서대로 푸는 자리, 스테이지 선택은 구경하는 자리
const readWorlds = (): Record<string, unknown> => {
  try {
    const saved = localStorage.getItem(WORLD_KEY)
    const parsed: unknown = saved ? JSON.parse(saved) : null
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

export const localWorldStorage: WorldStorage = {
  load: (all) => {
    const world = readWorlds()[all ? 'all' : 'play']
    return Number.isInteger(world) ? (world as number) : undefined
  },
  save: (all, world) => {
    try {
      localStorage.setItem(
        WORLD_KEY,
        JSON.stringify({ ...readWorlds(), [all ? 'all' : 'play']: world }),
      )
    } catch {
      // 이번 세션 진행과 무관한 저장 실패
    }
  },
}

// 진행 중인 스테이지 하나의 중간 상태, 진행 기록과 다른 키
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
      // 이번 세션 진행과 무관한 저장 실패
    }
  },
  clear: () => {
    try {
      localStorage.removeItem(SESSION_KEY)
    } catch {
      // 지우지 못해도 다음 저장이 덮어쓰는 값
    }
  },
}

// 판 전체를 한 화면에 담는 보기를 고른 상태
export const localOverviewStorage: OverviewStorage = {
  load: () => {
    try {
      return localStorage.getItem(OVERVIEW_KEY) === 'true'
    } catch {
      return false
    }
  },
  save: (overview) => {
    try {
      localStorage.setItem(OVERVIEW_KEY, String(overview))
    } catch {
      // 이번 세션 진행과 무관한 저장 실패
    }
  },
}
