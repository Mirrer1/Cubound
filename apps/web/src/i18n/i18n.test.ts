import { describe, expect, it } from 'vitest'

import { DICTIONARIES, type Language, guideText, isLanguage, languageFrom, text } from '.'
import { en } from './en'
import { ko } from './ko'

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
    expect(text('en', 'stars.label', 2)).toBe('2 of 3 stars')
    expect(text('ko', 'stars.label', 2)).toBe('별 2개')
  })
})

describe('guideText', () => {
  it('터치 기기면 터치 문구를 쓴다', () => {
    expect(guideText('en', 'move', true)).toBe('Swipe diagonally to roll the cube')
    expect(guideText('en', 'move', false)).toBe('Use the arrow keys to roll one tile at a time')
  })

  it('터치 문구가 없으면 기본 문구를 쓴다', () => {
    expect(guideText('en', 'goal', true)).toBe(text('en', 'guide.goal'))
  })

  it('{n}을 넘긴 숫자로 바꾼다', () => {
    expect(guideText('en', 'moveLimit', false, 24)).toBe('You have 24 moves to get home')
    expect(guideText('ko', 'moveLimit', false, 24)).toBe('24번 안에 도착해야 해요')
  })
})

// 스테이지와 월드 이름은 판이 늘 때마다 채워야 해서 번역을 미룬다
const isStageName = (key: string) => key.startsWith('stage.') || key.startsWith('world.')

describe('사전', () => {
  it.each(Object.keys(DICTIONARIES))('%s에 UI 문구가 다 있다', (code) => {
    const missing = Object.keys(en)
      .filter((key) => !isStageName(key))
      .filter((key) => !(key in DICTIONARIES[code as Language]))

    expect(missing).toEqual([])
  })

  it('한국어에는 스테이지와 월드 이름까지 다 있다', () => {
    const missing = Object.keys(en).filter((key) => !(key in ko))

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

  it('일본어와 스페인어는 지역을 떼고 고른다', () => {
    expect(languageFrom(['ja-JP'])).toBe('ja')
    expect(languageFrom(['ja'])).toBe('ja')
    expect(languageFrom(['es-MX'])).toBe('es')
    expect(languageFrom(['es'])).toBe('es')
  })

  it('번체를 쓰는 중국어 태그는 zh-Hant를 고른다', () => {
    expect(languageFrom(['zh-TW'])).toBe('zh-Hant')
    expect(languageFrom(['zh-HK'])).toBe('zh-Hant')
    expect(languageFrom(['zh-MO'])).toBe('zh-Hant')
    expect(languageFrom(['zh-Hant'])).toBe('zh-Hant')
    expect(languageFrom(['zh-Hant-TW'])).toBe('zh-Hant')
  })

  it('나머지 중국어 태그는 zh-Hans를 고른다', () => {
    expect(languageFrom(['zh'])).toBe('zh-Hans')
    expect(languageFrom(['zh-CN'])).toBe('zh-Hans')
    expect(languageFrom(['zh-SG'])).toBe('zh-Hans')
    expect(languageFrom(['zh-Hans'])).toBe('zh-Hans')
    expect(languageFrom(['zh-Hans-HK'])).toBe('zh-Hans')
  })
})

describe('isLanguage', () => {
  it('지원하는 언어 코드만 참이다', () => {
    expect(isLanguage('ko')).toBe(true)
    expect(isLanguage('fr')).toBe(false)
    expect(isLanguage(null)).toBe(false)
  })
})
