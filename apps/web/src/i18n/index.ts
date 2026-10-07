import { type Texts, en } from './en'
import { es } from './es'
import { ja } from './ja'
import { ko } from './ko'
import { zhHans } from './zhHans'
import { zhHant } from './zhHant'

export type Language = 'ko' | 'en' | 'ja' | 'zh-Hant' | 'zh-Hans' | 'es'

export type TextKey = keyof Texts

export const LANGUAGES: { code: Language; label: string }[] = [
  { code: 'ko', label: '한국어' },
  { code: 'en', label: 'English' },
  { code: 'ja', label: '日本語' },
  { code: 'zh-Hant', label: '繁體中文' },
  { code: 'zh-Hans', label: '简体中文' },
  { code: 'es', label: 'Español' },
]

export const DICTIONARIES: Record<Language, Partial<Texts>> = {
  ko,
  en,
  ja,
  'zh-Hant': zhHant,
  'zh-Hans': zhHans,
  es,
}

// 어느 사전에도 없는 키는 키 이름 그대로, 문구 하나가 빠져도 열리는 화면
const lookup = (language: Language, key: string) =>
  DICTIONARIES[language]?.[key as TextKey] ?? en[key as TextKey] ?? key

// n을 넘기면 채우는 문구의 {n} 자리
const fill = (value: string, n?: number) =>
  n === undefined ? value : value.replace('{n}', String(n))

export const text = (language: Language, key: TextKey, n?: number) => fill(lookup(language, key), n)

export const guideText = (language: Language, id: string, touch: boolean, n?: number) => {
  const touchKey = `guide.${id}.touch`
  return fill(lookup(language, touch && touchKey in en ? touchKey : `guide.${id}`), n)
}

export const stageTextKey = (id: string) => `stage.${id}` as TextKey

export const worldTextKey = (world: number) => `world.${world}` as TextKey

export const worldNoteKey = (world: number) => `world.${world}.note` as TextKey

// 월드 설명을 한 줄에 한 문장씩 그리는 문장 단위
export const sentencesOf = (text: string) => text.split(/(?<=[.。!?！？])\s*/).filter(Boolean)

export const chapterTextKey = (chapter: number) => `chapter.${chapter}` as TextKey

export const isLanguage = (value: unknown): value is Language =>
  LANGUAGES.some((language) => language.code === value)

const TRADITIONAL_REGIONS = ['tw', 'hk', 'mo']

// 태그의 문자나 지역으로 가르는 중국어 번체와 간체
const chineseFrom = (subtags: string[]): Language => {
  if (subtags.includes('hant')) return 'zh-Hant'
  if (subtags.includes('hans')) return 'zh-Hans'
  return subtags.some((subtag) => TRADITIONAL_REGIONS.includes(subtag)) ? 'zh-Hant' : 'zh-Hans'
}

// 기기가 선호하는 순서에서 먼저 지원하는 언어
export const languageFrom = (tags: readonly string[]): Language => {
  for (const tag of tags) {
    const subtags = tag.toLowerCase().split('-')
    if (subtags[0] === 'zh') return chineseFrom(subtags)

    const found = LANGUAGES.find((language) => language.code === subtags[0])
    if (found) return found.code
  }
  return 'en'
}
