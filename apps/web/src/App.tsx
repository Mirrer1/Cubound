import { AnimatePresence, MotionConfig, motion } from 'motion/react'
import { useEffect } from 'react'

import { isUnlocked, isWorldUnlocked } from '@/game/progress'
import { type Route, screenKeyOf, showingAll } from '@/platform/route'
import { documentTitle } from '@/platform/title'
import { useRoute } from '@/platform/useRoute'
import PlayScreen from '@/screens/PlayScreen'
import StageSelectScreen from '@/screens/StageSelectScreen'
import TitleScreen from '@/screens/TitleScreen'
import {
  STAGES,
  WORLDS,
  currentWorld,
  cycleOf,
  parseStageId,
  stageIdsOf,
  worldUnlockStageId,
} from '@/stages'
import { useGameStore } from '@/store/gameStore'
import { useSettingsStore } from '@/store/settingsStore'

// 타이틀은 월드가 없어 첫 월드로 둔다
const worldOf = (route: Route) =>
  route.screen === 'play'
    ? parseStageId(route.stageId).world
    : route.screen === 'select'
      ? route.world
      : WORLDS[0]

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
      <StageSelectScreen world={route.world} chapters={route.chapters ?? false} />
    ) : (
      <TitleScreen />
    )

  useEffect(() => {
    document.documentElement.lang = language
    document.title = documentTitle(route, language)
  }, [language, route])

  // 세계 색은 지금 보는 월드가 속한 사이클을 따르고 폰 주소창 색도 같이 간다
  useEffect(() => {
    const root = document.documentElement
    root.dataset.cycle = String(cycleOf(worldOf(route)))
    const color = getComputedStyle(root).getPropertyValue('--color-page-bg').trim()
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', color)
  }, [route])

  return (
    <MotionConfig reducedMotion="user">
      <AnimatePresence mode="wait">
        <motion.div
          key={screenKeyOf(route)}
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
