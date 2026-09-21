import { AnimatePresence } from 'motion/react'
import { type MouseEvent, type PointerEvent, useCallback, useEffect, useRef, useState } from 'react'

import Board from '@/components/board/Board'
import GuideOverlay from '@/components/guide/GuideOverlay'
import Button from '@/components/ui/Button'
import ClearCard from '@/components/ui/ClearCard'
import RestartCard from '@/components/ui/RestartCard'
import { climbsLeft, movesLeft, pushesLeft, ridesLeft } from '@/game/rules'
import { stageTextKey } from '@/i18n'
import { useText } from '@/i18n/useText'
import { directionFromKey, directionFromSwipe, isRestartKey } from '@/platform/input'
import { goTo } from '@/platform/route'
import { STAGES, nextStageId, parseStageId } from '@/stages'
import { useGameStore } from '@/store/gameStore'

interface PlayScreenProps {
  stageId: string
}

const ASK_FROM_MOVES = 5 // 이만큼 진행했으면 재시작 전에 물어본다

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
  const [asking, setAsking] = useState(false)
  const sectionRef = useRef<HTMLElement>(null)
  const swipeStart = useRef<{ x: number; y: number } | null>(null)
  const swiped = useRef(false)
  const t = useText()

  // 주소가 바뀐 바로 다음 프레임에는 앞 스테이지가 남아 있어 지금 스테이지일 때만 그린다
  const game = loaded?.stage.id === currentId ? loaded : null
  const { world, stage: stageNumber } = parseStageId(currentId)
  const nextId = nextStageId(currentId)
  const hasNext = nextId !== undefined && nextId in STAGES
  const record = game ? progress.stages[game.stage.id] : undefined
  const guides = game?.stage.guides ?? []
  const hasGuide = guides.length > 0
  const guideTarget = guideStep !== null ? guides[guideStep]?.target : undefined
  const guideCell = typeof guideTarget === 'object' ? guideTarget : undefined
  const left = game ? movesLeft(game) : null
  const pushesOver = game ? pushesLeft(game) : null
  const climbsOver = game ? climbsLeft(game) : null
  const ridesOver = game ? ridesLeft(game) : null
  const outOfMoves = left === 0 && !game?.cleared

  const handleNext = () => {
    if (nextId) goTo({ screen: 'play', stageId: nextId })
  }
  const handleSelect = () => goTo({ screen: 'select', world })
  // 포커스가 남으면 Enter나 Space로 가이드가 다시 열려서 버튼 포커스를 뺀다
  const handleOpenGuide = (e: MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.blur()
    openGuide()
  }
  // 얼마 못 간 판은 다시 풀기 쉬워서 묻지 않고 바로 다시 시작한다
  const askOrRestart = useCallback(() => {
    if (guideStep === null && (game?.moves ?? 0) >= ASK_FROM_MOVES) setAsking(true)
    else restart()
  }, [game, guideStep, restart])
  const handleKeep = () => setAsking(false)
  const handleRestart = () => {
    setAsking(false)
    restart()
  }
  // 가이드와 카드가 떠 있는 동안은 스와이프를 받지 않고 제스처마다 앞 판정을 지운다
  const handlePointerDown = (e: PointerEvent<HTMLElement>) => {
    swiped.current = false
    if (guideStep !== null || asking || game?.cleared) return
    swipeStart.current = { x: e.clientX, y: e.clientY }
  }
  // 최소 거리를 넘는 순간 판정하고, 시작점을 비워 한 제스처에 한 칸만 움직인다
  const handlePointerMove = (e: PointerEvent<HTMLElement>) => {
    const start = swipeStart.current
    if (!start) return
    const direction = directionFromSwipe(e.clientX - start.x, e.clientY - start.y)
    if (!direction) return
    swipeStart.current = null
    swiped.current = true
    move(direction)
  }
  // 축에 가까워 미는 중에 판정하지 못한 제스처는 손을 뗄 때 받는다
  const handlePointerEnd = (e: PointerEvent<HTMLElement>) => {
    const start = swipeStart.current
    swipeStart.current = null
    if (!start) return

    const direction = directionFromSwipe(e.clientX - start.x, e.clientY - start.y, true)
    if (!direction) return
    swiped.current = true
    move(direction)
  }
  // 스와이프로 판정한 제스처는 이어지는 클릭을 버려서 버튼이 눌리지 않게 한다
  const handleClickCapture = (e: MouseEvent<HTMLElement>) => {
    if (!swiped.current) return
    swiped.current = false
    e.stopPropagation()
  }

  // 남아 있는 중간 상태가 있으면 이어서 시작하고 없으면 처음부터 시작한다
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
      } else if (e.key === 'Escape' && guideStep === null) {
        goTo({ screen: 'select', world })
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [move, askOrRestart, asking, guideStep, world])

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
          <header className="flex items-start justify-between gap-6 px-(--panel-pad) pt-(--panel-pad) short:items-center short:pt-3 narrow:flex-wrap narrow:items-center narrow:gap-x-3 narrow:gap-y-3">
            <div className="flex min-w-0 flex-col gap-1.5 short:flex-row short:items-baseline short:gap-3 narrow:flex-1 narrow:flex-row narrow:items-baseline narrow:gap-2">
              <span className="shrink-0 font-mono text-[11px] tracking-[0.22em] text-mute">
                <span className="narrow:hidden">{'STAGE '}</span>
                {String(stageNumber).padStart(2, '0')}
              </span>
              <span className="text-2xl tracking-tight short:text-xl wide:text-[27px] narrow:min-w-0 narrow:truncate narrow:text-xl">
                {t(stageTextKey(game.stage.id))}
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-5 wide:gap-7 narrow:contents">
              <div className="flex items-center gap-5 wide:gap-7 narrow:order-last narrow:w-full narrow:justify-center narrow:gap-4 narrow:[&>*+*]:border-l narrow:[&>*+*]:border-line narrow:[&>*+*]:pl-4">
                {pushesOver !== null && (
                  <div
                    data-guide="pushes"
                    className="flex flex-col items-end gap-0.5 short:flex-row short:items-baseline short:gap-2 narrow:flex-row narrow:items-baseline narrow:gap-2"
                  >
                    <span className="font-mono text-[10px] tracking-[0.22em] text-mute">
                      PUSHES
                    </span>
                    <span className="text-[32px] leading-none font-light tabular-nums short:text-2xl narrow:text-[19px]">
                      {pushesOver}
                    </span>
                  </div>
                )}
                {climbsOver !== null && (
                  <div
                    data-guide="climbs"
                    className="flex flex-col items-end gap-0.5 short:flex-row short:items-baseline short:gap-2 narrow:flex-row narrow:items-baseline narrow:gap-2"
                  >
                    <span className="font-mono text-[10px] tracking-[0.22em] text-mute">
                      CLIMBS
                    </span>
                    <span className="text-[32px] leading-none font-light tabular-nums short:text-2xl narrow:text-[19px]">
                      {climbsOver}
                    </span>
                  </div>
                )}
                {ridesOver !== null && (
                  <div
                    data-guide="rides"
                    className="flex flex-col items-end gap-0.5 short:flex-row short:items-baseline short:gap-2 narrow:flex-row narrow:items-baseline narrow:gap-2"
                  >
                    <span className="font-mono text-[10px] tracking-[0.22em] text-mute">RIDES</span>
                    <span className="text-[32px] leading-none font-light tabular-nums short:text-2xl narrow:text-[19px]">
                      {ridesOver}
                    </span>
                  </div>
                )}
                <div
                  data-guide="moves"
                  className="flex flex-col items-end gap-0.5 short:flex-row short:items-baseline short:gap-2 narrow:flex-row narrow:items-baseline narrow:gap-2"
                >
                  <span className="font-mono text-[10px] tracking-[0.22em] text-mute">
                    {left === null ? 'MOVES' : 'LEFT'}
                  </span>
                  <span className="text-[32px] leading-none font-light tabular-nums short:text-2xl narrow:text-[19px]">
                    {left ?? game.moves}
                  </span>
                </div>
              </div>
              {/* 320px에서 버튼과 긴 이름이 한 줄에 들어가도록 폰 세로에서만 버튼을 줄인다 */}
              <div className="flex gap-2.5 narrow:gap-1.5 narrow:[&>button]:size-8.5">
                {hasGuide && (
                  <Button variant="icon" onClick={handleOpenGuide} title={t('play.guide')}>
                    ?
                  </Button>
                )}
                <Button
                  variant="icon"
                  strong={outOfMoves}
                  onClick={askOrRestart}
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
                  game.stage.rules?.rideLimit
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
