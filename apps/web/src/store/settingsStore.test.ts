import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const items = new Map<string, string>()

beforeEach(() => {
  items.clear()
  vi.resetModules()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => {
      items.set(key, value)
    },
  })
  vi.stubGlobal('navigator', { languages: ['en-US'] })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

// 저장소를 처음 읽는 때가 스토어를 만들 때라 테스트마다 새로 불러오는 스토어
const loadStore = async () => (await import('./settingsStore')).useSettingsStore

describe('useSettingsStore', () => {
  it('저장한 언어로 시작한다', async () => {
    items.set('cubound:language', 'ko')
    const store = await loadStore()

    expect(store.getState().language).toBe('ko')
  })

  it('저장한 언어가 없으면 기기 언어로 시작한다', async () => {
    const store = await loadStore()

    expect(store.getState().language).toBe('en')
  })

  it('setLanguage는 언어를 바꾸고 저장한다', async () => {
    const store = await loadStore()
    store.getState().setLanguage('zh-Hant')

    expect(store.getState().language).toBe('zh-Hant')
    expect(items.get('cubound:language')).toBe('zh-Hant')
  })
})
