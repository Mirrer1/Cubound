import { create } from 'zustand'

import type { Language } from '@/i18n'
import { localLanguageStorage } from '@/platform/storage'

interface SettingsStore {
  language: Language
  setLanguage: (language: Language) => void
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  language: localLanguageStorage.load(),
  setLanguage: (language) => {
    localLanguageStorage.save(language)
    set({ language })
  },
}))
