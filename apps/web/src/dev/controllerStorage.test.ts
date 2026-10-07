import { afterEach, describe, expect, it, vi } from 'vitest'

import { loadCollapsed, loadShown, saveCollapsed } from './controllerStorage'

const memoryStorage = () => {
  const items = new Map<string, string>()
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => {
      items.set(key, value)
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
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('loadCollapsed', () => {
  it('저장한 적이 없으면 펼친 상태다', () => {
    vi.stubGlobal('localStorage', memoryStorage())
    expect(loadCollapsed()).toBe(false)
  })

  it('저장한 접힘 상태를 읽는다', () => {
    vi.stubGlobal('localStorage', memoryStorage())
    saveCollapsed(true)
    expect(loadCollapsed()).toBe(true)
    saveCollapsed(false)
    expect(loadCollapsed()).toBe(false)
  })

  it('저장소가 막혀도 펼친 상태로 읽고 저장은 넘어간다', () => {
    vi.stubGlobal('localStorage', brokenStorage)
    expect(loadCollapsed()).toBe(false)
    expect(() => saveCollapsed(true)).not.toThrow()
  })
})

describe('loadShown', () => {
  it('사람이 여는 브라우저에서는 보인다', () => {
    vi.stubGlobal('localStorage', memoryStorage())
    vi.stubGlobal('navigator', { webdriver: false })
    expect(loadShown()).toBe(true)
  })

  it('자동화 브라우저에서는 저장한 값이 없으면 숨는다', () => {
    vi.stubGlobal('localStorage', memoryStorage())
    vi.stubGlobal('navigator', { webdriver: true })
    expect(loadShown()).toBe(false)
    saveCollapsed(false)
    expect(loadShown()).toBe(true)
  })
})
