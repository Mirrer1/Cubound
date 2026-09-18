import { type TextKey, text } from '.'
import { useSettingsStore } from '@/store/settingsStore'

export const useText = () => {
  const language = useSettingsStore((s) => s.language)
  return (key: TextKey, n?: number) => text(language, key, n)
}
