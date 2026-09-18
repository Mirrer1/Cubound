import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'

import { LANGUAGES, type Language } from '@/i18n'
import { useSettingsStore } from '@/store/settingsStore'

const LanguageMenu = () => {
  const language = useSettingsStore((s) => s.language)
  const setLanguage = useSettingsStore((s) => s.setLanguage)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const current = LANGUAGES.find((item) => item.code === language)

  const handleToggle = () => setOpen((prev) => !prev)
  const handleSelect = (code: Language) => {
    setLanguage(code)
    setOpen(false)
  }

  useEffect(() => {
    if (!open) return

    const onPointerDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }

    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        className="cursor-pointer rounded-[13px] border border-line-strong px-3 py-1.5 text-sm text-mute transition-soft hover:bg-hover"
        onClick={handleToggle}
      >
        {current?.label}
      </button>
      <AnimatePresence>
        {open && (
          <motion.ul
            className="absolute top-full right-0 mt-2 flex min-w-32 flex-col rounded-[13px] border border-line bg-base-bg p-1 shadow-[0_20px_60px_-20px_rgb(0_0_0/0.18)]"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -2, transition: { duration: 0.15 } }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            {LANGUAGES.map((item) => (
              <li key={item.code}>
                <button
                  type="button"
                  className={`w-full cursor-pointer rounded-[9px] px-3 py-2 text-left text-sm transition-soft hover:bg-hover ${item.code === language ? '' : 'text-mute'}`}
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
