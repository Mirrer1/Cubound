import { AnimatePresence, MotionConfig, motion } from 'motion/react'
import { useEffect, useRef } from 'react'

import { isUnlocked, isWorldUnlocked } from '@/game/progress'
import { useRoute } from '@/hooks/useRoute'
import { type Route, screenKeyOf, showingAll } from '@/routes/route'
import { documentTitle } from '@/routes/title'
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

// 월드가 없는 타이틀은 첫 월드
const worldOf = (route: Route) =>
  route.screen === 'play'
    ? parseStageId(route.stageId).world
    : route.screen === 'select'
      ? route.world
      : WORLDS[0]

// 지금 보는 월드가 속한 사이클의 세계 색, 폰 주소창 색도 같은 색
const applyCycle = (route: Route) => {
  const root = document.documentElement
  root.dataset.cycle = String(cycleOf(worldOf(route)))
  const color = getComputedStyle(root).getPropertyValue('--color-page-bg').trim()
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', color)
}

const App = () => {
  const progress = useGameStore((s) => s.progress)
  const language = useSettingsStore((s) => s.language)
  // 주소로 들어와도 열지 않는 판, 없는 스테이지와 잠긴 월드와 잠긴 스테이지
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

  // 화면이 바뀌는 이동은 옛 화면이 다 사라진 뒤 onExitComplete에서 색 교체
  const screenKeyRef = useRef(screenKeyOf(route))
  useEffect(() => {
    const key = screenKeyOf(route)
    if (key === screenKeyRef.current) applyCycle(route)
    screenKeyRef.current = key
  }, [route])

  return (
    <MotionConfig reducedMotion="user">
      <AnimatePresence mode="wait" onExitComplete={() => applyCycle(route)}>
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
