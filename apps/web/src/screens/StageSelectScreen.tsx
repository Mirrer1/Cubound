import { useEffect, useRef } from 'react'

import Button from '@/components/ui/Button'
import StageCard, { type StageCardState } from '@/components/ui/StageCard'
import { isUnlocked, isWorldUnlocked, totalStars } from '@/game/progress'
import { worldNoteKey, worldTextKey } from '@/i18n'
import { useText } from '@/i18n/useText'
import { goTo, showingAll } from '@/platform/route'
import { WORLDS, isBossStage, parseStageId, stageIdsOf, worldUnlockStageId } from '@/stages'
import { useGameStore } from '@/store/gameStore'

const cardsIn = (grid: HTMLDivElement | null) =>
  [...(grid?.querySelectorAll('button') ?? [])] as HTMLButtonElement[]

// 한 줄에 놓인 카드 수. 화면 폭에 따라 달라져서 누를 때마다 잰다
const columnsOf = (cards: HTMLButtonElement[]) =>
  cards.filter((card) => card.offsetTop === cards[0].offsetTop).length

// 잠긴 카드는 건너뛰고 같은 방향으로 이어서 찾는다
const nextFocus = (cards: HTMLButtonElement[], from: number, delta: number) => {
  const step = delta > 0 ? 1 : -1
  for (let i = from + delta; i >= 0 && i < cards.length; i += step) {
    if (!cards[i].disabled) return i
  }
  return from
}

interface StageSelectScreenProps {
  world: number
}

const StageSelectScreen = ({ world }: StageSelectScreenProps) => {
  const progress = useGameStore((s) => s.progress)
  const gridRef = useRef<HTMLDivElement>(null)
  const previousRef = useRef<HTMLButtonElement>(null)
  const t = useText()

  const index = WORLDS.indexOf(world)
  const showArrows = WORLDS.length > 1
  const all = showingAll()
  const unlocked = all || isWorldUnlocked(progress, worldUnlockStageId(world))
  // 아직 열리지 않은 월드는 들어가 봐야 잠긴 카드뿐이라 이름부터 미리 보여주지 않는다
  const next = WORLDS[index + 1]
  const nextOpen =
    next !== undefined && (all || isWorldUnlocked(progress, worldUnlockStageId(next)))
  const ids = stageIdsOf(world)
  const cards = ids.map((id) => {
    const record = progress.stages[id]
    const state: StageCardState = !unlocked
      ? 'locked'
      : record
        ? 'cleared'
        : all || isUnlocked(progress, ids, id)
          ? 'open'
          : 'locked'

    return {
      id,
      number: parseStageId(id).stage,
      state,
      stars: record?.stars ?? 0,
      boss: isBossStage(id),
      bestMoves: record?.bestMoves,
    }
  })
  const now = Math.max(
    0,
    cards.findIndex((card) => card.state === 'open'),
  )

  const handleBack = () => goTo({ screen: 'title' })
  const handleSelect = (stageId: string) => goTo({ screen: 'play', stageId })
  const handlePrevious = () => goTo({ screen: 'select', world: WORLDS[index - 1] })
  const handleNext = () => goTo({ screen: 'select', world: WORLDS[index + 1] })

  // 첫 포커스는 지금 도전할 카드에 두고 열린 카드가 없는 잠긴 월드는 월드 화살표에 둔다
  useEffect(() => {
    const target = unlocked ? cardsIn(gridRef.current)[now] : previousRef.current
    target?.focus()
  }, [now, unlocked])

  // 방향키로 카드 사이를 옮겨 다니고 Esc로 타이틀로 돌아간다
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleBack()
        return
      }

      const column = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
      const row = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0
      const cards = cardsIn(gridRef.current)
      if ((!column && !row) || cards.length === 0) return

      e.preventDefault()
      const from = cards.indexOf(document.activeElement as HTMLButtonElement)
      const to = from < 0 ? now : nextFocus(cards, from, column || row * columnsOf(cards))
      cards[to]?.focus()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [now])

  return (
    <main className="mx-auto flex h-dvh max-w-[1920px] screen-pad">
      <section className="scroll-area flex min-h-0 flex-1 flex-col gap-6 rounded-[22px] border border-line bg-base-bg panel-pad min-[1700px]:flex-row min-[1700px]:items-center min-[1700px]:gap-12! sm:gap-8">
        <header className="flex items-start gap-4 min-[1700px]:ml-10 min-[1700px]:w-90 min-[1700px]:shrink-0 min-[1700px]:flex-col min-[1700px]:gap-6 narrow:flex-wrap narrow:items-center narrow:gap-x-3 narrow:gap-y-3">
          <Button
            variant="icon"
            onClick={handleBack}
            aria-label={t('select.back')}
            className="min-[1700px]:size-13 narrow:size-8.5"
          >
            ←
          </Button>
          <div className="flex min-w-0 flex-1 flex-col gap-1 min-[1700px]:w-full min-[1700px]:flex-none min-[1700px]:gap-4 narrow:contents">
            {/* 넓은 화면에서는 두 줄이 풀려 왼쪽 기둥 한 줄기로 서서 order로 차례를 정한다 */}
            <span className="flex items-baseline justify-between gap-3 font-mono text-mute min-[1700px]:contents narrow:order-last narrow:w-full narrow:justify-center narrow:gap-4 narrow:[&>*+*]:border-l narrow:[&>*+*]:border-line narrow:[&>*+*]:pl-4">
              <span className="text-[11px] tracking-[0.22em] min-[1700px]:order-1">
                WORLD {world}
              </span>
              <span className="text-xs tracking-[0.15em] whitespace-nowrap min-[1700px]:order-4 narrow:text-[11px]">
                <span className="min-[1700px]:text-[30px] min-[1700px]:text-ink">
                  {totalStars(progress, ids)}
                </span>{' '}
                / {ids.length * 3} ◆
              </span>
            </span>
            <span className="flex items-start gap-1 min-[1700px]:contents narrow:contents">
              <span className="min-w-0 flex-1 text-2xl tracking-tight break-keep min-[1700px]:order-2 min-[1700px]:flex-none min-[1700px]:text-[44px]/[1.2]! sm:text-3xl narrow:truncate narrow:text-xl">
                {t(worldTextKey(world))}
              </span>
              {showArrows ? (
                <span className="flex items-start gap-1 min-[1700px]:order-5 narrow:shrink-0">
                  <Button
                    ref={previousRef}
                    variant="ghost"
                    disabled={index === 0}
                    onClick={handlePrevious}
                    aria-label={t('select.previousWorld')}
                    className="min-[1700px]:size-13 narrow:size-8.5"
                  >
                    ‹
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={!nextOpen}
                    onClick={handleNext}
                    aria-label={t('select.nextWorld')}
                    className="min-[1700px]:size-13 narrow:size-8.5"
                  >
                    ›
                  </Button>
                </span>
              ) : null}
            </span>
            <span className="hidden text-sm break-keep text-mute min-[1700px]:order-3 min-[1700px]:block">
              {t(worldNoteKey(world))}
            </span>
          </div>
        </header>
        <div ref={gridRef} className="stage-grid min-[1700px]:mr-10 min-[1700px]:flex-1">
          {cards.map((card) => (
            <StageCard key={card.id} {...card} onSelect={() => handleSelect(card.id)} />
          ))}
        </div>
      </section>
    </main>
  )
}

export default StageSelectScreen
