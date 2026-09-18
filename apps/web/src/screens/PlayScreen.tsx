import { AnimatePresence } from 'motion/react'
import { type MouseEvent, type PointerEvent, useEffect, useRef } from 'react'

import Board from '@/components/board/Board'
import GuideOverlay from '@/components/guide/GuideOverlay'
import Button from '@/components/ui/Button'
import ClearCard from '@/components/ui/ClearCard'
import { movesLeft } from '@/game/rules'
import { stageTextKey } from '@/i18n'
import { useText } from '@/i18n/useText'
import { directionFromKey, directionFromSwipe, isRestartKey } from '@/platform/input'
import { goTo } from '@/platform/route'
import { STAGES, parseStageId, stageId } from '@/stages'
import { useGameStore } from '@/store/gameStore'

interface PlayScreenProps {
  stageId: string
}

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
  const guideStep = useGameStore((s) => s.guideStep)
  const openGuide = useGameStore((s) => s.openGuide)
  const nextGuide = useGameStore((s) => s.nextGuide)
  const closeGuide = useGameStore((s) => s.closeGuide)
  const sectionRef = useRef<HTMLElement>(null)
  const swipeStart = useRef<{ x: number; y: number } | null>(null)
  const t = useText()

  // 주소가 바뀐 바로 다음 프레임에는 앞 스테이지가 남아 있어 지금 스테이지일 때만 그린다
  const game = loaded?.stage.id === currentId ? loaded : null
  const { world, stage: stageNumber } = parseStageId(currentId)
  const nextId = stageId(world, stageNumber + 1)
  const hasNext = nextId in STAGES
  const record = game ? progress.stages[game.stage.id] : undefined
  const guides = game?.stage.guides ?? []
  const hasGuide = guides.length > 0
  const guideTarget = guideStep !== null ? guides[guideStep]?.target : undefined
  const guideCell = typeof guideTarget === 'object' ? guideTarget : undefined
  const left = game ? movesLeft(game) : null
  const outOfMoves = left === 0 && !game?.cleared

  const handleNext = () => goTo({ screen: 'play', stageId: nextId })
  const handleSelect = () => goTo({ screen: 'select' })
  // 포커스가 남으면 Enter나 Space로 가이드가 다시 열려서 버튼 포커스를 뺀다
  const handleOpenGuide = (e: MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.blur()
    openGuide()
  }
  const handlePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    swipeStart.current = { x: e.clientX, y: e.clientY }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  // 최소 거리를 넘는 순간 판정하고, 시작점을 비워 한 제스처에 한 칸만 움직인다
  const handlePointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const start = swipeStart.current
    if (!start) return
    const direction = directionFromSwipe(e.clientX - start.x, e.clientY - start.y)
    if (!direction) return
    swipeStart.current = null
    move(direction)
  }
  const handlePointerEnd = () => {
    swipeStart.current = null
  }

  // 남아 있는 중간 상태가 있으면 이어서 시작하고 없으면 처음부터 시작한다
  useEffect(() => {
    enter(currentId)
  }, [enter, currentId])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const direction = directionFromKey(e.key)
      if (direction) {
        e.preventDefault()
        move(direction, e.repeat)
      } else if (isRestartKey(e.key)) {
        restart()
      } else if (e.key === 'Escape' && guideStep === null) {
        goTo({ screen: 'select' })
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [move, restart, guideStep])

  return (
    <main className="mx-auto flex h-dvh max-w-[1920px] screen-pad">
      {game && (
        <section
          ref={sectionRef}
          className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[22px] border border-line bg-base-bg"
        >
          <header className="flex items-start justify-between gap-6 px-(--panel-pad) pt-(--panel-pad) short:items-center short:pt-3">
            <div className="flex flex-col gap-1.5 short:flex-row short:items-baseline short:gap-3">
              <span className="font-mono text-[11px] tracking-[0.22em] text-mute">
                STAGE {String(stageNumber).padStart(2, '0')}
              </span>
              <span className="text-2xl tracking-tight short:text-xl wide:text-[27px]">
                {t(stageTextKey(game.stage.id))}
              </span>
            </div>
            <div className="flex items-center gap-5 wide:gap-7">
              <div
                data-guide="moves"
                className="flex flex-col items-end gap-0.5 short:flex-row short:items-baseline short:gap-2"
              >
                <span className="font-mono text-[10px] tracking-[0.22em] text-mute">
                  {left === null ? 'MOVES' : 'LEFT'}
                </span>
                <span className="text-[32px] leading-none font-light tabular-nums short:text-2xl">
                  {left ?? game.moves}
                </span>
              </div>
              <div className="hidden gap-2.5 sm:flex">
                {hasGuide && (
                  <Button variant="icon" onClick={handleOpenGuide} title={t('play.guide')}>
                    ?
                  </Button>
                )}
                <Button
                  variant="icon"
                  strong={outOfMoves}
                  onClick={restart}
                  title={t('play.restart')}
                  data-guide="restart"
                >
                  ↺
                </Button>
                <Button variant="icon" onClick={handleSelect} title={t('play.select')}>
                  ≡
                </Button>
              </div>
            </div>
          </header>
          <div
            className="min-h-0 flex-1 touch-none p-2 select-none wide:p-6"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerEnd}
            onPointerCancel={handlePointerEnd}
          >
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
            />
          </div>
          <div
            className={`grid gap-3 panel-pad whitespace-nowrap sm:hidden ${hasGuide ? 'grid-cols-3' : 'grid-cols-2'}`}
          >
            <Button strong={outOfMoves} onClick={restart} data-guide="restart">
              ↺ {t('play.restartShort')}
            </Button>
            {hasGuide && <Button onClick={handleOpenGuide}>? {t('play.guideShort')}</Button>}
            <Button onClick={handleSelect}>≡ {t('play.menuShort')}</Button>
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
            {guideStep !== null && (
              <GuideOverlay
                guides={guides}
                step={guideStep}
                moveLimit={game.stage.rules?.moveLimit}
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
