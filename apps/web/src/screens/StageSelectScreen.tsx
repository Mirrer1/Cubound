import Button from '@/components/ui/Button'
import StageCard, { type StageCardState } from '@/components/ui/StageCard'
import { isUnlocked, totalStars } from '@/game/progress'
import { moveLimit } from '@/game/solver'
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
      bossHint: stage?.best ? t('select.bossHint', moveLimit(stage.best)) : undefined,
    }
  })

  return (
    <main className="flex h-dvh p-4 sm:p-8">
      <section className="scroll-area flex min-h-0 flex-1 flex-col gap-6 rounded-[22px] border border-line bg-base-bg p-5 sm:gap-8 sm:p-9">
        <header className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <Button variant="icon" onClick={() => goTo('title')} aria-label={t('select.back')}>
              ←
            </Button>
            <div className="flex flex-col gap-1">
              <span className="font-mono text-[11px] tracking-[0.22em] text-mute">
                WORLD {WORLD}
              </span>
              <span className="text-2xl tracking-tight sm:text-3xl">{t(worldTextKey(WORLD))}</span>
            </div>
          </div>
          <span className="flex items-center gap-1.5 pt-1 font-mono text-xs tracking-[0.15em] text-mute">
            {totalStars(progress, ids)} / {STAGES_PER_WORLD * 3} ◆
          </span>
        </header>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5 sm:gap-4">
          {cards.map((card, i) => (
            <StageCard key={card.id} {...card} index={i} onSelect={() => play(card.id)} />
          ))}
        </div>
      </section>
    </main>
  )
}

export default StageSelectScreen
