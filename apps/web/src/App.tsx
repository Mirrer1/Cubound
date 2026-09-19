import { AnimatePresence, MotionConfig, motion } from 'motion/react'
import { useEffect } from 'react'

import { isUnlocked, isWorldUnlocked } from '@/game/progress'
import { hashOf, showingAll } from '@/platform/route'
import { documentTitle } from '@/platform/title'
import { useRoute } from '@/platform/useRoute'
import PlayScreen from '@/screens/PlayScreen'
import StageSelectScreen from '@/screens/StageSelectScreen'
import TitleScreen from '@/screens/TitleScreen'
import {
  STAGES,
  WORLDS,
  currentWorld,
  parseStageId,
  stageIdsOf,
  worldUnlockStageId,
} from '@/stages'
import { useGameStore } from '@/store/gameStore'
import { useSettingsStore } from '@/store/settingsStore'

const App = () => {
  const progress = useGameStore((s) => s.progress)
  const language = useSettingsStore((s) => s.language)
  // 없는 스테이지, 잠긴 월드, 잠긴 스테이지는 주소로 들어와도 열지 않는다
  const canPlay = (stageId: string) => {
    const { world } = parseStageId(stageId)
    return (
      stageId in STAGES &&
      (showingAll() ||
        (isWorldUnlocked(progress, worldUnlockStageId(world)) &&
          isUnlocked(progress, stageIdsOf(world), stageId)))
    )
  }
  const route = useRoute({ canPlay, worlds: WORLDS, currentWorld: currentWorld(progress) })
  const screen =
    route.screen === 'play' ? (
      <PlayScreen stageId={route.stageId} />
    ) : route.screen === 'select' ? (
      <StageSelectScreen world={route.world} />
    ) : (
      <TitleScreen />
    )

  useEffect(() => {
    document.documentElement.lang = language
    document.title = documentTitle(route, language)
  }, [language, route])

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
