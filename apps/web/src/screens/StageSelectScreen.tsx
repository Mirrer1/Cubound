import Button from '@/components/ui/Button'
import StageCard, { type StageCardState } from '@/components/ui/StageCard'
import { isUnlocked, totalStars } from '@/game/progress'
import { worldTextKey } from '@/i18n'
import { useText } from '@/i18n/useText'
import { STAGES, STAGES_PER_WORLD, WORLDS, isBossStage, stageIdsOf } from '@/stages'
import { useGameStore } from '@/store/gameStore'

const WORLD = WORLDS[0]

const StageSelectScreen = () => {
  const progress = useGameStore((s) => s.progress)
  const goTo = useGameStore((s) => s.goTo)
  const play = useGameStore((s) => s.play)
  const t = useText()

  const ids = stageIdsOf(WORLD)
  const cards = ids.map((id, i) => {
    const stage = STAGES[id]
    const record = progress.stages[id]
    const state: StageCardState = record
      ? 'cleared'
      : stage && isUnlocked(progress, ids, id)
        ? 'open'
        : 'locked'

    return {
      id,
      number: i + 1,
      state,
      stars: record?.stars ?? 0,
      boss: isBossStage(id),
    }
  })

  return (
    <main className="mx-auto flex h-dvh max-w-[1920px] screen-pad">
      <section className="scroll-area flex min-h-0 flex-1 flex-col gap-6 rounded-[22px] border border-line bg-base-bg panel-pad sm:gap-8">
        <header className="flex items-start gap-4">
          <Button variant="icon" onClick={() => goTo('title')} aria-label={t('select.back')}>
            ←
          </Button>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="flex items-baseline justify-between gap-3 font-mono text-mute">
              <span className="text-[11px] tracking-[0.22em]">WORLD {WORLD}</span>
              <span className="text-xs tracking-[0.15em] whitespace-nowrap">
                {totalStars(progress, ids)} / {STAGES_PER_WORLD * 3} ◆
              </span>
            </span>
            <span className="text-2xl tracking-tight break-keep sm:text-3xl">
              {t(worldTextKey(WORLD))}
            </span>
          </div>
        </header>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(5,minmax(0,240px))] sm:justify-center sm:gap-4">
          {cards.map((card) => (
            <StageCard key={card.id} {...card} onSelect={() => play(card.id)} />
          ))}
        </div>
      </section>
    </main>
  )
}

export default StageSelectScreen
