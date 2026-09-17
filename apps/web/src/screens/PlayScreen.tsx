import { AnimatePresence } from 'motion/react'
import { useEffect } from 'react'

import Board from '@/components/board/Board'
import Button from '@/components/ui/Button'
import ClearCard from '@/components/ui/ClearCard'
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

  const { world, stage: stageNumber } = parseStageId(game?.stage.id ?? '0-0')
  const nextId = stageId(world, stageNumber + 1)
  const hasNext = nextId in STAGES
  const record = game ? progress.stages[game.stage.id] : undefined

  const handleNext = () => play(nextId)
  const handleSelect = () => goTo('select')

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
        <section className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[22px] border border-line bg-base-bg">
          <header className="flex items-start justify-between gap-6 px-6 pt-6 sm:px-9 sm:pt-8">
            <div className="flex flex-col gap-1.5">
              <span className="font-mono text-[11px] tracking-[0.22em] text-mute">
                STAGE {String(stageNumber).padStart(2, '0')}
              </span>
              <span className="text-2xl tracking-tight sm:text-[27px]">{game.stage.name}</span>
            </div>
            <div className="flex items-center gap-5 sm:gap-7">
              <div className="flex flex-col items-end gap-0.5">
                <span className="font-mono text-[10px] tracking-[0.22em] text-mute">MOVES</span>
                <span className="text-[32px] leading-none font-light tabular-nums">
                  {game.moves}
                </span>
              </div>
              <div className="hidden gap-2.5 sm:flex">
                <Button variant="icon" onClick={restart} title="다시 하기 (R)">
                  ↺
                </Button>
                <Button variant="icon" onClick={handleSelect} title="스테이지 선택">
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
            />
          </div>
          <div className="grid grid-cols-2 gap-3 p-4 sm:hidden">
            <Button onClick={restart}>↺ 다시</Button>
            <Button onClick={handleSelect}>≡ 메뉴</Button>
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
        </section>
      )}
    </main>
  )
}

export default PlayScreen
