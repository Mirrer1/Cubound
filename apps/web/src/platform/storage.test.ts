import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  localLanguageStorage,
  localOverviewStorage,
  localProgressStorage,
  localSessionStorage,
  localWorldStorage,
} from './storage'
import { EMPTY_PROGRESS, type Progress } from '@/game/progress'
import type { Session } from '@/game/session'

const memoryStorage = (saved: Record<string, string> = {}) => {
  const items = new Map(Object.entries(saved))
  return {
    items,
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => {
      items.set(key, value)
    },
    removeItem: (key: string) => {
      items.delete(key)
    },
  }
}

const brokenStorage = {
  getItem: () => {
    throw new Error('막힘')
  },
  setItem: () => {
    throw new Error('막힘')
  },
  removeItem: () => {
    throw new Error('막힘')
  },
}

const PROGRESS: Progress = {
  ...EMPTY_PROGRESS,
  stages: { '1-1': { bestMoves: 7, stars: 3 } },
}

let storage = memoryStorage()

beforeEach(() => {
  storage = memoryStorage()
  vi.stubGlobal('localStorage', storage)
  vi.stubGlobal('navigator', { languages: ['ja-JP'] })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('localProgressStorage', () => {
  it('저장한 진행 기록을 다시 읽는다', () => {
    localProgressStorage.save(PROGRESS)

    expect(storage.items.get('cubound:progress')).toBe(JSON.stringify(PROGRESS))
    expect(localProgressStorage.load()).toEqual(PROGRESS)
  })

  it('저장한 것이 없거나 깨졌으면 빈 기록으로 시작한다', () => {
    expect(localProgressStorage.load()).toEqual(EMPTY_PROGRESS)

    storage.items.set('cubound:progress', '{깨짐')
    expect(localProgressStorage.load()).toEqual(EMPTY_PROGRESS)
  })

  it('저장소가 막혀도 빈 기록으로 시작하고 저장 실패를 넘긴다', () => {
    vi.stubGlobal('localStorage', brokenStorage)

    expect(localProgressStorage.load()).toEqual(EMPTY_PROGRESS)
    expect(() => localProgressStorage.save(PROGRESS)).not.toThrow()
  })
})

describe('localLanguageStorage', () => {
  it('고른 언어를 날것 문자열로 저장하고 다시 읽는다', () => {
    localLanguageStorage.save('es')

    expect(storage.items.get('cubound:language')).toBe('es')
    expect(localLanguageStorage.load()).toBe('es')
  })

  it('고른 적이 없거나 모르는 값이면 기기 언어를 따른다', () => {
    expect(localLanguageStorage.load()).toBe('ja')

    storage.items.set('cubound:language', 'xx')
    expect(localLanguageStorage.load()).toBe('ja')
  })

  it('저장소가 막혀도 기기 언어로 시작한다', () => {
    vi.stubGlobal('localStorage', brokenStorage)

    expect(localLanguageStorage.load()).toBe('ja')
    expect(() => localLanguageStorage.save('ko')).not.toThrow()
  })
})

describe('localWorldStorage', () => {
  it('시작과 스테이지 선택의 월드를 따로 기억한다', () => {
    localWorldStorage.save(false, 3)
    localWorldStorage.save(true, 7)

    expect(localWorldStorage.load(false)).toBe(3)
    expect(localWorldStorage.load(true)).toBe(7)
    expect(JSON.parse(storage.items.get('cubound:world') ?? '')).toEqual({ play: 3, all: 7 })
  })

  it('저장한 것이 없거나 정수가 아니면 없는 것으로 본다', () => {
    expect(localWorldStorage.load(false)).toBeUndefined()

    storage.items.set('cubound:world', JSON.stringify({ play: 'six', all: 2.5 }))
    expect(localWorldStorage.load(false)).toBeUndefined()
    expect(localWorldStorage.load(true)).toBeUndefined()
  })

  it('깨진 값은 비우고 새로 담는다', () => {
    storage.items.set('cubound:world', '{깨짐')
    localWorldStorage.save(true, 4)

    expect(JSON.parse(storage.items.get('cubound:world') ?? '')).toEqual({ all: 4 })
  })

  it('저장소가 막혀도 실패를 넘긴다', () => {
    vi.stubGlobal('localStorage', brokenStorage)

    expect(localWorldStorage.load(false)).toBeUndefined()
    expect(() => localWorldStorage.save(false, 2)).not.toThrow()
  })
})

describe('localSessionStorage', () => {
  const SESSION = { stageId: '1-1' } as unknown as Session

  it('중간 상태를 저장하고 읽고 지운다', () => {
    localSessionStorage.save(SESSION)
    expect(localSessionStorage.load()).toEqual(SESSION)

    localSessionStorage.clear()
    expect(storage.items.has('cubound:session')).toBe(false)
    expect(localSessionStorage.load()).toBeNull()
  })

  it('깨진 값이나 막힌 저장소는 없는 것으로 본다', () => {
    storage.items.set('cubound:session', '{깨짐')
    expect(localSessionStorage.load()).toBeNull()

    vi.stubGlobal('localStorage', brokenStorage)
    expect(localSessionStorage.load()).toBeNull()
    expect(() => localSessionStorage.save(SESSION)).not.toThrow()
    expect(() => localSessionStorage.clear()).not.toThrow()
  })
})

describe('localOverviewStorage', () => {
  it('전체 보기를 고른 상태를 다시 읽는다', () => {
    expect(localOverviewStorage.load()).toBe(false)

    localOverviewStorage.save(true)
    expect(localOverviewStorage.load()).toBe(true)

    localOverviewStorage.save(false)
    expect(localOverviewStorage.load()).toBe(false)
  })

  it('저장소가 막혀도 기본 화면으로 시작한다', () => {
    vi.stubGlobal('localStorage', brokenStorage)

    expect(() => localOverviewStorage.save(true)).not.toThrow()
    expect(localOverviewStorage.load()).toBe(false)
  })
})
