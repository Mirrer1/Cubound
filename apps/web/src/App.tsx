import { AnimatePresence, MotionConfig, motion } from 'motion/react'
import { useEffect } from 'react'

import PlayScreen from '@/screens/PlayScreen'
import StageSelectScreen from '@/screens/StageSelectScreen'
import TitleScreen from '@/screens/TitleScreen'
import { type Screen, useGameStore } from '@/store/gameStore'
import { useSettingsStore } from '@/store/settingsStore'

const SCREENS: Record<Screen, () => React.JSX.Element> = {
  title: TitleScreen,
  select: StageSelectScreen,
  play: PlayScreen,
}

const App = () => {
  const screen = useGameStore((s) => s.screen)
  const language = useSettingsStore((s) => s.language)
  const Current = SCREENS[screen]

  useEffect(() => {
    document.documentElement.lang = language
  }, [language])

  return (
    <MotionConfig reducedMotion="user">
      <AnimatePresence mode="wait">
        <motion.div
          key={screen}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4, transition: { duration: 0.15 } }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
        >
          <Current />
        </motion.div>
      </AnimatePresence>
    </MotionConfig>
  )
}

export default App
