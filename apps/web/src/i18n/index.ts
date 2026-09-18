import { type Texts, en } from './en'
import { ko } from './ko'

export type Language = 'ko' | 'en'

export type TextKey = keyof Texts

export const LANGUAGES: { code: Language; label: string }[] = [
  { code: 'ko', label: '한국어' },
  { code: 'en', label: 'English' },
]

export const DICTIONARIES: Record<Language, Partial<Texts>> = { ko, en }

const lookup = (language: Language, key: string) =>
  DICTIONARIES[language]?.[key as TextKey] ?? en[key as TextKey]

// n을 넘기면 문구의 {n} 자리를 채운다
export const text = (language: Language, key: TextKey, n?: number) => {
  const value = lookup(language, key)
  return n === undefined ? value : value.replace('{n}', String(n))
}

export const guideText = (language: Language, id: string, touch: boolean) => {
  const touchKey = `guide.${id}.touch`
  return lookup(language, touch && touchKey in en ? touchKey : `guide.${id}`)
}

export const stageTextKey = (id: string) => `stage.${id}` as TextKey

export const worldTextKey = (world: number) => `world.${world}` as TextKey

export const isLanguage = (value: unknown): value is Language =>
  LANGUAGES.some((language) => language.code === value)

// 기기가 선호하는 순서대로 보고 먼저 지원하는 언어를 고른다
export const languageFrom = (tags: readonly string[]): Language => {
  for (const tag of tags) {
    const found = LANGUAGES.find((language) => tag.toLowerCase().startsWith(language.code))
    if (found) return found.code
  }
  return 'en'
}
