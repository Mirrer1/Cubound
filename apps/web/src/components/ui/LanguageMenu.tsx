import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'

import { LANGUAGES, type Language } from '@/i18n'
import { useSettingsStore } from '@/store/settingsStore'

const LanguageMenu = () => {
  const language = useSettingsStore((s) => s.language)
  const setLanguage = useSettingsStore((s) => s.setLanguage)
  const [open, setOpen] = useState(false)
  const current = LANGUAGES.find((item) => item.code === language)

  const handleToggle = () => setOpen((prev) => !prev)
  const handleSelect = (code: Language) => {
    setLanguage(code)
    setOpen(false)
  }

  useEffect(() => {
    if (!open) return

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open])

  return (
    <div className="relative">
      {open && <div className="fixed inset-0" onClick={() => setOpen(false)} />}
      <button
        type="button"
        className="relative cursor-pointer rounded-[0.8125rem] border border-line-strong px-3 py-1.5 text-sm text-mute transition-soft after:absolute after:-inset-x-1 after:top-1/2 after:h-[max(100%,44px)] after:-translate-y-1/2 hover:bg-hover"
        onClick={handleToggle}
      >
        {current?.label}
      </button>
      <AnimatePresence>
        {open && (
          <motion.ul
            className="absolute top-full right-0 mt-2 flex min-w-32 flex-col gap-2 rounded-[0.8125rem] border border-line bg-base-bg p-1 shadow-[0_20px_60px_-20px_rgb(0_0_0/0.18)]"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -2, transition: { duration: 0.15 } }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            {LANGUAGES.map((item) => (
              <li key={item.code}>
                <button
                  type="button"
                  className={`relative min-h-[34px] w-full cursor-pointer rounded-[0.5625rem] px-3 py-2 text-left text-sm transition-soft after:absolute after:inset-x-0 after:-inset-y-[3px] hover:bg-hover ${item.code === language ? '' : 'text-mute'}`}
                  onClick={() => handleSelect(item.code)}
                >
                  {item.label}
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  )
}

export default LanguageMenu
