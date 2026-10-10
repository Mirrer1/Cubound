import { AnimatePresence } from 'motion/react'
import {
  type MouseEvent,
  type PointerEvent,
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'

import Board from '@/components/board/Board'
import { lockFocus } from '@/components/board/frame'
import GuideOverlay from '@/components/guide/GuideOverlay'
import Button from '@/components/ui/Button'
import ClearCard from '@/components/ui/ClearCard'
import PlayCounts from '@/components/ui/PlayCounts'
import RestartCard from '@/components/ui/RestartCard'
import ExpandIcon from '@/components/ui/icons/ExpandIcon'
import GuideIcon from '@/components/ui/icons/GuideIcon'
import MenuIcon from '@/components/ui/icons/MenuIcon'
import RestartIcon from '@/components/ui/icons/RestartIcon'
import ShrinkIcon from '@/components/ui/icons/ShrinkIcon'
import { FLAME, movesLeft } from '@/game/rules'
import { useText } from '@/hooks/useText'
import { stageTextKey } from '@/i18n'
import { directionFromKey, directionFromSwipe, isOverviewKey, isRestartKey } from '@/platform/input'
import { localOverviewStorage } from '@/platform/storage'
import { goTo } from '@/routes/route'
import { STAGES, nextStageId, parseStageId } from '@/stages'
import { useGameStore } from '@/store/gameStore'

interface PlayScreenProps {
  stageId: string
}

const ASK_FROM_MOVES = 5 // 재시작 전에 묻기 시작하는 이동 수

// 개발 서버 전용 개발용 컨트롤러, 배포 빌드에서 빠지는 동적 import
const DevController = import.meta.env.DEV
  ? lazy(() => import('@/components/dev/DevController'))
  : null

const PlayScreen = ({ stageId: currentId }: PlayScreenProps) => {
  const loaded = useGameStore((s) => s.game)
  const progress = useGameStore((s) => s.progress)
  const enter = useGameStore((s) => s.enter)
  const move = useGameStore((s) => s.move)
  const restart = useGameStore((s) => s.restart)
  const prevGame = useGameStore((s) => s.prevGame)
  const events = useGameStore((s) => s.events)
  const turn = useGameStore((s) => s.turn)
  const finishAnimation = useGameStore((s) => s.finishAnimation)
  const queued = useGameStore((s) => s.queue.length)
  const chained = useGameStore((s) => s.chained)
  const restarting = useGameStore((s) => s.restarting)
  const animating = useGameStore((s) => s.animating)
  const guideStep = useGameStore((s) => s.guideStep)
  const openGuide = useGameStore((s) => s.openGuide)
  const nextGuide = useGameStore((s) => s.nextGuide)
  const closeGuide = useGameStore((s) => s.closeGuide)
  const [asking, setAsking] = useState(false)
  const [overview, setOverview] = useState(localOverviewStorage.load)
  const [showsAll, setShowsAll] = useState(true)
  const sectionRef = useRef<HTMLElement>(null)
  const swipeStart = useRef<{ x: number; y: number } | null>(null)
  const swiped = useRef(false)
  const t = useText()

  // 지금 스테이지일 때만 그리는 판, 주소가 바뀐 바로 다음 프레임에 남은 앞 스테이지 탓
  const game = loaded?.stage.id === currentId ? loaded : null
  const { world, stage: stageNumber } = parseStageId(currentId)
  const nextId = nextStageId(currentId)
  const hasNext = nextId !== undefined && nextId in STAGES
  const record = game ? progress.stages[game.stage.id] : undefined
  const guides = game?.stage.guides ?? []
  const hasGuide = guides.length > 0
  const guideTarget = guideStep !== null ? guides[guideStep]?.target : undefined
  // 갑문 가이드는 두 웅덩이 사이 장치 칸으로 맞추는 카메라
  const guideCell =
    typeof guideTarget === 'object'
      ? guideTarget
      : guideTarget === 'lock' && game
        ? (lockFocus(game.stage) ?? undefined)
        : undefined
  const left = game ? movesLeft(game) : null
  const outOfMoves = left === 0 && !game?.cleared

  const handleNext = () => {
    if (nextId) goTo({ screen: 'play', stageId: nextId })
  }
  const handleSelect = () => goTo({ screen: 'select', world })
  // 남으면 Enter나 Space로 가이드가 다시 열리는 버튼 포커스 해제
  const handleOpenGuide = (e: MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.blur()
    openGuide()
  }
  // 얼마 못 간 판은 묻지 않고 바로 재시작
  const askOrRestart = useCallback(() => {
    if (guideStep === null && (game?.moves ?? 0) >= ASK_FROM_MOVES) setAsking(true)
    else restart()
  }, [game, guideStep, restart])
  const toggleOverview = useCallback(() => {
    setOverview(!overview)
    localOverviewStorage.save(!overview)
  }, [overview])
  const handleOverview = (e: MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.blur()
    toggleOverview()
  }
  const handleKeep = () => setAsking(false)
  const handleRestart = () => {
    setAsking(false)
    restart()
  }
  // 가이드와 카드가 떠 있는 동안은 스와이프 무시, 제스처마다 지우는 앞 판정
  const handlePointerDown = (e: PointerEvent<HTMLElement>) => {
    swiped.current = false
    if (guideStep !== null || asking || game?.cleared) return
    swipeStart.current = { x: e.clientX, y: e.clientY }
  }
  // 최소 거리를 넘는 순간의 판정, 시작점을 비워 한 제스처에 한 칸
  const handlePointerMove = (e: PointerEvent<HTMLElement>) => {
    const start = swipeStart.current
    if (!start) return
    const direction = directionFromSwipe(e.clientX - start.x, e.clientY - start.y)
    if (!direction) return
    swipeStart.current = null
    swiped.current = true
    move(direction)
  }
  // 축에 가까워 미는 중에 판정하지 못한 제스처는 손을 뗄 때 판정
  const handlePointerEnd = (e: PointerEvent<HTMLElement>) => {
    const start = swipeStart.current
    swipeStart.current = null
    if (!start) return

    const direction = directionFromSwipe(e.clientX - start.x, e.clientY - start.y, true)
    if (!direction) return
    swiped.current = true
    move(direction)
  }
  // 스와이프로 판정한 제스처의 이어지는 클릭 버리기, 버튼 눌림 방지
  const handleClickCapture = (e: MouseEvent<HTMLElement>) => {
    if (!swiped.current) return
    swiped.current = false
    e.stopPropagation()
  }

  // 남아 있는 중간 상태가 있으면 이어서, 없으면 처음부터 시작
  useEffect(() => {
    enter(currentId)
  }, [enter, currentId])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (asking) {
        if (e.key === 'Escape') setAsking(false)
        return
      }

      const direction = directionFromKey(e.key)
      if (direction) {
        e.preventDefault()
        move(direction)
      } else if (isRestartKey(e.key)) {
        askOrRestart()
      } else if (isOverviewKey(e.key) && !showsAll) {
        toggleOverview()
      } else if (e.key === 'Escape' && guideStep === null) {
        goTo({ screen: 'select', world })
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [move, askOrRestart, toggleOverview, showsAll, asking, guideStep, world])

  return (
    <main
      className="mx-auto flex h-dvh max-w-[1920px] touch-none screen-pad select-none"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerLeave={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onClickCapture={handleClickCapture}
    >
      {game && (
        <section
          ref={sectionRef}
          className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[22px] border border-line bg-base-bg"
        >
          <header className="relative flex items-start justify-between gap-6 px-(--panel-pad) pt-(--panel-pad) short:items-center short:pt-3 narrow:flex-wrap narrow:items-center narrow:gap-x-3 narrow:gap-y-3">
            <div className="flex min-w-0 flex-col gap-1.5 short:flex-row short:items-baseline short:gap-3 narrow:flex-1 narrow:flex-row narrow:items-baseline narrow:gap-2">
              <span className="shrink-0 font-mono text-[11px] tracking-[0.22em] text-mute">
                <span className="narrow:hidden">{'STAGE '}</span>
                {String(stageNumber).padStart(2, '0')}
              </span>
              <span className="text-2xl tracking-tight short:text-xl wide:text-[27px] narrow:min-w-0 narrow:truncate narrow:text-xl">
                {t(stageTextKey(game.stage.id))}
              </span>
            </div>
            {DevController && (
              <Suspense>
                <DevController key={game.stage.id} game={game} />
              </Suspense>
            )}
            <div className="flex shrink-0 items-center gap-5 wide:gap-7 narrow:contents">
              <PlayCounts
                game={game}
                prevGame={prevGame}
                events={events}
                turn={turn}
                animating={animating}
              />
              {/* 320px에서 버튼과 긴 이름이 한 줄에 들어가는 폰 세로 전용 작은 버튼 */}
              <div className="flex gap-2.5 narrow:gap-1.5 narrow:[&>button]:size-8.5">
                {!showsAll && (
                  <Button
                    variant="icon"
                    onClick={handleOverview}
                    title={t('play.overview')}
                    aria-label={t('play.overview')}
                    aria-pressed={overview}
                    strong={overview}
                  >
                    {overview ? (
                      <ShrinkIcon className="size-4.5" />
                    ) : (
                      <ExpandIcon className="size-4.5" />
                    )}
                  </Button>
                )}
                {hasGuide && (
                  <Button variant="icon" onClick={handleOpenGuide} title={t('play.guide')}>
                    <GuideIcon />
                  </Button>
                )}
                <Button
                  variant="icon"
                  strong={outOfMoves}
                  onClick={askOrRestart}
                  title={t('play.restart')}
                  data-guide="restart"
                >
                  <RestartIcon />
                </Button>
                <Button variant="icon" onClick={handleSelect} title={t('play.select')}>
                  <MenuIcon />
                </Button>
              </div>
            </div>
          </header>
          <div className="min-h-0 flex-1 p-2 wide:p-6">
            <Board
              key={game.stage.id}
              game={game}
              prevGame={prevGame}
              events={events}
              turn={turn}
              onAnimationEnd={finishAnimation}
              queued={queued}
              chained={chained}
              restarting={restarting}
              guideCell={guideCell}
              overview={overview && !showsAll}
              onShowsAll={setShowsAll}
            />
          </div>
          <AnimatePresence>
            {game.cleared && (
              <ClearCard
                stageNumber={stageNumber}
                moves={game.moves}
                stars={record?.stars ?? 0}
                onNext={hasNext ? handleNext : undefined}
                onRetry={restart}
                onSelect={handleSelect}
              />
            )}
          </AnimatePresence>
          <AnimatePresence>
            {asking && <RestartCard onKeep={handleKeep} onRestart={handleRestart} />}
          </AnimatePresence>
          <AnimatePresence>
            {guideStep !== null && (
              <GuideOverlay
                guides={guides}
                step={guideStep}
                limit={
                  game.stage.rules?.moveLimit ??
                  game.stage.rules?.pushLimit ??
                  game.stage.rules?.climbLimit ??
                  game.stage.rules?.rideLimit ??
                  game.stage.rules?.dirLimit?.count ??
                  game.stage.rules?.melt ??
                  FLAME
                }
                containerRef={sectionRef}
                onNext={nextGuide}
                onSkip={closeGuide}
              />
            )}
          </AnimatePresence>
        </section>
      )}
    </main>
  )
}

export default PlayScreen
