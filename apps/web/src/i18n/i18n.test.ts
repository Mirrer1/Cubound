import { describe, expect, it } from 'vitest'

import { DICTIONARIES, type Language, guideText, isLanguage, languageFrom, text } from '.'
import { en } from './en'

const STUB = 'stub' as Language

describe('text', () => {
  it('고른 언어의 문구를 돌려준다', () => {
    expect(text('ko', 'title.start')).toBe('시작')
    expect(text('en', 'title.start')).toBe('Start')
  })

  it('번역이 없는 문구는 영어로 돌려준다', () => {
    DICTIONARIES[STUB] = { 'title.start': 'はじめる' }

    expect(text(STUB, 'title.start')).toBe('はじめる')
    expect(text(STUB, 'clear.retry')).toBe('Retry')

    delete DICTIONARIES[STUB]
  })

  it('사전이 없는 언어는 영어로 돌려준다', () => {
    expect(text(STUB, 'clear.retry')).toBe('Retry')
  })

  it('{n}을 넘긴 숫자로 바꾼다', () => {
    expect(text('en', 'select.bossHint', 24)).toBe('Arrive in 24 moves')
    expect(text('ko', 'select.bossHint', 24)).toBe('24번 안에 도착')
  })
})

describe('guideText', () => {
  it('터치 기기면 터치 문구를 쓴다', () => {
    expect(guideText('en', 'move', true)).toBe('Swipe diagonally to roll the cube')
    expect(guideText('en', 'move', false)).toBe('Use the arrow keys to roll one tile')
  })

  it('터치 문구가 없으면 기본 문구를 쓴다', () => {
    expect(guideText('en', 'goal', true)).toBe(text('en', 'guide.goal'))
  })

  it('{n}을 넘긴 숫자로 바꾼다', () => {
    expect(guideText('en', 'moveLimit', false, 24)).toBe('You have 24 moves to get home')
    expect(guideText('ko', 'moveLimit', false, 24)).toBe('24번 안에 도착해야 해요')
  })
})

describe('사전', () => {
  it.each(Object.keys(DICTIONARIES))('%s에 모든 문구가 있다', (code) => {
    const missing = Object.keys(en).filter((key) => !(key in DICTIONARIES[code as Language]))

    expect(missing).toEqual([])
  })
})

describe('languageFrom', () => {
  it('기기 언어가 한국어면 ko를 고른다', () => {
    expect(languageFrom(['ko-KR', 'en-US'])).toBe('ko')
  })

  it('지원하지 않는 언어면 en을 고른다', () => {
    expect(languageFrom(['fr-FR'])).toBe('en')
    expect(languageFrom([])).toBe('en')
  })

  it('먼저 오는 기기 언어를 우선한다', () => {
    expect(languageFrom(['en-US', 'ko-KR'])).toBe('en')
  })
})

describe('isLanguage', () => {
  it('지원하는 언어 코드만 참이다', () => {
    expect(isLanguage('ko')).toBe(true)
    expect(isLanguage('fr')).toBe(false)
    expect(isLanguage(null)).toBe(false)
  })
})
