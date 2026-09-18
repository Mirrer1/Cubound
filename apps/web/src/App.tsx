import { AnimatePresence, MotionConfig, motion } from 'motion/react'
import { useEffect } from 'react'

import { isUnlocked } from '@/game/progress'
import { hashOf } from '@/platform/route'
import { useRoute } from '@/platform/useRoute'
import PlayScreen from '@/screens/PlayScreen'
import StageSelectScreen from '@/screens/StageSelectScreen'
import TitleScreen from '@/screens/TitleScreen'
import { STAGES, parseStageId, stageIdsOf } from '@/stages'
import { useGameStore } from '@/store/gameStore'
import { useSettingsStore } from '@/store/settingsStore'

const App = () => {
  const progress = useGameStore((s) => s.progress)
  const language = useSettingsStore((s) => s.language)
  // 없는 스테이지와 아직 열리지 않은 스테이지는 주소로 들어와도 열지 않는다
  const canPlay = (stageId: string) =>
    stageId in STAGES && isUnlocked(progress, stageIdsOf(parseStageId(stageId).world), stageId)
  const route = useRoute(canPlay)
  const screen =
    route.screen === 'play' ? (
      <PlayScreen stageId={route.stageId} />
    ) : route.screen === 'select' ? (
      <StageSelectScreen />
    ) : (
      <TitleScreen />
    )

  useEffect(() => {
    document.documentElement.lang = language
  }, [language])

  return (
    <MotionConfig reducedMotion="user">
      <AnimatePresence mode="wait">
        <motion.div
          key={hashOf(route)}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4, transition: { duration: 0.15 } }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
        >
          {screen}
        </motion.div>
      </AnimatePresence>
    </MotionConfig>
  )
}

export default App
