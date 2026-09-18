import { AnimatePresence } from 'motion/react'
import { type MouseEvent, useEffect, useRef } from 'react'

import Board from '@/components/board/Board'
import GuideOverlay from '@/components/guide/GuideOverlay'
import Button from '@/components/ui/Button'
import ClearCard from '@/components/ui/ClearCard'
import { movesLeft } from '@/game/rules'
import { stageTextKey } from '@/i18n'
import { useText } from '@/i18n/useText'
import { directionFromKey, isRestartKey } from '@/platform/input'
import { STAGES, parseStageId, stageId } from '@/stages'
import { useGameStore } from '@/store/gameStore'

const PlayScreen = () => {
  const game = useGameStore((s) => s.game)
  const progress = useGameStore((s) => s.progress)
  const move = useGameStore((s) => s.move)
  const restart = useGameStore((s) => s.restart)
  const play = useGameStore((s) => s.play)
  const goTo = useGameStore((s) => s.goTo)
  const prevGame = useGameStore((s) => s.prevGame)
  const events = useGameStore((s) => s.events)
  const turn = useGameStore((s) => s.turn)
  const finishAnimation = useGameStore((s) => s.finishAnimation)
  const queued = useGameStore((s) => s.queue.length)
  const chained = useGameStore((s) => s.chained)
  const guideStep = useGameStore((s) => s.guideStep)
  const openGuide = useGameStore((s) => s.openGuide)
  const nextGuide = useGameStore((s) => s.nextGuide)
  const closeGuide = useGameStore((s) => s.closeGuide)
  const sectionRef = useRef<HTMLElement>(null)
  const t = useText()

  const { world, stage: stageNumber } = parseStageId(game?.stage.id ?? '0-0')
  const nextId = stageId(world, stageNumber + 1)
  const hasNext = nextId in STAGES
  const record = game ? progress.stages[game.stage.id] : undefined
  const guides = game?.stage.guides ?? []
  const hasGuide = guides.length > 0
  const guideTarget = guideStep !== null ? guides[guideStep]?.target : undefined
  const guideCell = typeof guideTarget === 'object' ? guideTarget : undefined
  const left = game ? movesLeft(game) : null
  const outOfMoves = left === 0 && !game?.cleared

  const handleNext = () => play(nextId)
  const handleSelect = () => goTo('select')
  // 포커스가 남으면 Enter나 Space로 가이드가 다시 열려서 버튼 포커스를 뺀다
  const handleOpenGuide = (e: MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.blur()
    openGuide()
  }

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const direction = directionFromKey(e.key)
      if (direction) {
        e.preventDefault()
        move(direction, e.repeat)
      } else if (isRestartKey(e.key)) {
        restart()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [move, restart])

  return (
    <main className="flex h-dvh p-4 sm:p-8">
      {game && (
        <section
          ref={sectionRef}
          className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[22px] border border-line bg-base-bg"
        >
          <header className="flex items-start justify-between gap-6 px-6 pt-6 sm:px-9 sm:pt-8">
            <div className="flex flex-col gap-1.5">
              <span className="font-mono text-[11px] tracking-[0.22em] text-mute">
                STAGE {String(stageNumber).padStart(2, '0')}
              </span>
              <span className="text-2xl tracking-tight sm:text-[27px]">
                {t(stageTextKey(game.stage.id))}
              </span>
            </div>
            <div className="flex items-center gap-5 sm:gap-7">
              <div data-guide="moves" className="flex flex-col items-end gap-0.5">
                <span className="font-mono text-[10px] tracking-[0.22em] text-mute">
                  {left === null ? 'MOVES' : 'LEFT'}
                </span>
                <span className="text-[32px] leading-none font-light tabular-nums">
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
          <div className="min-h-0 flex-1 p-4 sm:p-6">
            <Board
              key={game.stage.id}
              game={game}
              prevGame={prevGame}
              events={events}
              turn={turn}
              onAnimationEnd={finishAnimation}
              queued={queued}
              chained={chained}
              guideCell={guideCell}
            />
          </div>
          <div
            className={`grid gap-3 p-4 whitespace-nowrap sm:hidden ${hasGuide ? 'grid-cols-3' : 'grid-cols-2'}`}
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
