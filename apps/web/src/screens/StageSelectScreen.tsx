import { useEffect, useRef } from 'react'

import Button from '@/components/ui/Button'
import StageCard, { type StageCardState } from '@/components/ui/StageCard'
import { isUnlocked, isWorldUnlocked, totalStars } from '@/game/progress'
import { worldTextKey } from '@/i18n'
import { useText } from '@/i18n/useText'
import { goTo } from '@/platform/route'
import {
  WORLDS,
  isBossStage,
  parseStageId,
  previousWorld,
  stageIdsOf,
  worldUnlockStageId,
} from '@/stages'
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
  const unlocked = isWorldUnlocked(progress, worldUnlockStageId(world))
  const ids = stageIdsOf(world)
  const cards = ids.map((id) => {
    const record = progress.stages[id]
    const state: StageCardState = !unlocked
      ? 'locked'
      : record
        ? 'cleared'
        : isUnlocked(progress, ids, id)
          ? 'open'
          : 'locked'

    return {
      id,
      number: parseStageId(id).stage,
      state,
      stars: record?.stars ?? 0,
      boss: isBossStage(id),
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
      <section className="scroll-area flex min-h-0 flex-1 flex-col gap-6 rounded-[22px] border border-line bg-base-bg panel-pad sm:gap-8">
        <header className="flex items-start gap-4">
          <Button variant="icon" onClick={handleBack} aria-label={t('select.back')}>
            ←
          </Button>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="flex items-baseline justify-between gap-3 font-mono text-mute">
              <span className="text-[11px] tracking-[0.22em]">WORLD {world}</span>
              <span className="text-xs tracking-[0.15em] whitespace-nowrap">
                {totalStars(progress, ids)} / {ids.length * 3} ◆
              </span>
            </span>
            <span className="flex items-start gap-1">
              <span className="min-w-0 flex-1 text-2xl tracking-tight break-keep sm:text-3xl">
                {t(worldTextKey(world))}
              </span>
              {showArrows ? (
                <>
                  <Button
                    ref={previousRef}
                    variant="ghost"
                    disabled={index === 0}
                    onClick={handlePrevious}
                    aria-label={t('select.previousWorld')}
                  >
                    ‹
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={index === WORLDS.length - 1}
                    onClick={handleNext}
                    aria-label={t('select.nextWorld')}
                  >
                    ›
                  </Button>
                </>
              ) : null}
            </span>
            {unlocked ? null : (
              <span className="text-sm break-keep text-mute">
                {t('select.locked', previousWorld(world))}
              </span>
            )}
          </div>
        </header>
        <div
          ref={gridRef}
          className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(5,minmax(0,240px))] sm:justify-center sm:gap-4"
        >
          {cards.map((card) => (
            <StageCard key={card.id} {...card} onSelect={() => handleSelect(card.id)} />
          ))}
        </div>
      </section>
    </main>
  )
}

export default StageSelectScreen
