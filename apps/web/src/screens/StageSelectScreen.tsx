import { motion } from 'motion/react'
import { useEffect, useRef } from 'react'

import Button from '@/components/ui/Button'
import ChapterCard, { type ChapterCardState } from '@/components/ui/ChapterCard'
import ChapterTab from '@/components/ui/ChapterTab'
import StageCard, { type StageCardState } from '@/components/ui/StageCard'
import { isUnlocked, isWorldUnlocked, totalStars } from '@/game/progress'
import { chapterTextKey, worldNoteKey, worldTextKey } from '@/i18n'
import { useText } from '@/i18n/useText'
import { goTo, showingAll } from '@/platform/route'
import { localWorldStorage } from '@/platform/storage'
import {
  CHAPTERS,
  STAGES_PER_WORLD,
  WORLDS_PER_CYCLE,
  chapterStageIds,
  chapterUnlockStageId,
  currentWorldOf,
  cycleOf,
  isBossStage,
  parseStageId,
  stageIdsOf,
  worldUnlockStageId,
  worldsOf,
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
  chapters: boolean // 목록 자리에 장 고르기가 펼쳐진 상태
}

const StageSelectScreen = ({ world, chapters }: StageSelectScreenProps) => {
  const progress = useGameStore((s) => s.progress)
  const gridRef = useRef<HTMLDivElement>(null)
  const previousRef = useRef<HTMLButtonElement>(null)
  const t = useText()

  const chapter = cycleOf(world)
  // 화살표는 한 장 안에서만 움직인다. 장을 넘는 길은 덩이 하나로 모은다
  const siblings = worldsOf(chapter)
  const index = siblings.indexOf(world)
  const all = showingAll()
  const unlocked = all || isWorldUnlocked(progress, worldUnlockStageId(world))
  // 아직 열리지 않은 월드는 들어가 봐야 잠긴 카드뿐이라 이름부터 미리 보여주지 않는다
  const next = siblings[index + 1]
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

  const chapterCards = CHAPTERS.map((n) => {
    const ids = chapterStageIds(n)
    const open = all || isWorldUnlocked(progress, chapterUnlockStageId(n))
    const state: ChapterCardState = !open ? 'locked' : n === chapter ? 'now' : 'open'
    const first = (n - 1) * WORLDS_PER_CYCLE * STAGES_PER_WORLD + 1

    return {
      chapter: n,
      name: t(chapterTextKey(n)),
      range: `${first}–${first + WORLDS_PER_CYCLE * STAGES_PER_WORLD - 1}`,
      stars: totalStars(progress, ids),
      total: ids.length * 3,
      // 만들지 않은 월드도 칸을 차지해 장의 크기가 같아 보인다
      worlds: Array.from({ length: WORLDS_PER_CYCLE }, (_, i) => {
        const w = worldsOf(n)[i]
        if (w === undefined) return 0
        const wid = stageIdsOf(w)
        return wid.length === 0 ? 0 : totalStars(progress, wid) / (wid.length * 3)
      }),
      state,
    }
  })
  const nowChapter = Math.max(
    0,
    chapterCards.findIndex((card) => card.state === 'now'),
  )

  const handleBack = () => goTo({ screen: 'title' })
  const handleSelect = (stageId: string) => goTo({ screen: 'play', stageId })
  const handlePrevious = () => goTo({ screen: 'select', world: siblings[index - 1] })
  const handleNext = () => goTo({ screen: 'select', world: siblings[index + 1] })
  const handleChapters = () => goTo({ screen: 'select', world, chapters: !chapters })
  // 같은 장을 다시 고르면 보던 월드로 돌아간다. 첫 월드로 튕기지 않는다
  const handleChapter = (n: number) =>
    goTo({ screen: 'select', world: n === chapter ? world : currentWorldOf(progress, n) })

  // 타이틀로 나갔다 돌아왔을 때 보던 월드로 오도록 적어 둔다
  useEffect(() => {
    localWorldStorage.save(all, world)
  }, [all, world])

  // 첫 포커스는 지금 자리에 둔다. 열린 카드가 없는 잠긴 월드는 월드 화살표에 둔다
  useEffect(() => {
    const items = cardsIn(gridRef.current)
    const target = chapters ? items[nowChapter] : unlocked ? items[now] : previousRef.current
    target?.focus()
  }, [now, nowChapter, unlocked, chapters])

  // 방향키로 카드 사이를 옮겨 다닌다. Esc는 장 고르기를 닫고, 닫혀 있으면 타이틀로 간다
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (chapters) goTo({ screen: 'select', world })
        else handleBack()
        return
      }

      const column = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
      const row = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0
      const cards = cardsIn(gridRef.current)
      if ((!column && !row) || cards.length === 0) return

      e.preventDefault()
      const from = cards.indexOf(document.activeElement as HTMLButtonElement)
      const start = chapters ? nowChapter : now
      const to = from < 0 ? start : nextFocus(cards, from, column || row * columnsOf(cards))
      cards[to]?.focus()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [now, nowChapter, chapters, world])

  return (
    <main className="mx-auto flex h-dvh max-w-[1920px] screen-pad">
      <section className="scroll-area flex min-h-0 flex-1 flex-col gap-6 rounded-[22px] border border-line bg-base-bg panel-pad min-[1700px]:flex-row min-[1700px]:items-center min-[1700px]:gap-12! wide:gap-8">
        {/* 폰은 윗줄에 ←·별·화살표를 몰고 아랫줄 전체를 장 덩이로 쓴다. order로 차례를 정한다 */}
        <header className="mx-auto flex w-full max-w-content flex-wrap items-center gap-x-4 gap-y-2.5 min-[1700px]:mx-0 min-[1700px]:ml-10 min-[1700px]:w-90 min-[1700px]:max-w-none min-[1700px]:shrink-0 min-[1700px]:flex-col min-[1700px]:items-start min-[1700px]:gap-6 narrow:gap-x-3">
          <Button
            variant="icon"
            onClick={handleBack}
            aria-label={t('select.back')}
            className="min-[1700px]:size-13 narrow:size-8.5"
          >
            ←
          </Button>
          <ChapterTab
            chapter={chapter}
            world={world}
            name={t(worldTextKey(world))}
            open={chapters}
            label={t('select.chapters')}
            onClick={handleChapters}
            className="max-w-full min-w-0 min-[1700px]:order-1 min-[1700px]:w-full! min-[1700px]:grow-0! min-[1700px]:basis-auto! short:max-w-125 short:grow short:basis-0 wide:max-w-125 wide:grow wide:basis-0 narrow:order-last narrow:w-full"
          />
          <span className="ml-auto font-mono text-xs tracking-[0.15em] whitespace-nowrap text-mute min-[1700px]:order-3 min-[1700px]:ml-0 narrow:text-[11px]">
            <span className="min-[1700px]:text-[30px] min-[1700px]:text-ink">
              {totalStars(progress, ids)}
            </span>{' '}
            / {ids.length * 3} ◆
          </span>
          {/* 월드가 하나뿐인 장에서도 자리를 비우지 않는다. 장을 넘길 때 왼쪽이 흔들리지 않게 */}
          <span className="flex items-center gap-1 min-[1700px]:order-4">
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
          <span className="hidden text-sm break-keep text-mute min-[1700px]:order-2 min-[1700px]:block">
            {t(worldNoteKey(world))}
          </span>
        </header>
        <div
          ref={gridRef}
          className="grid-box mx-auto min-h-0 w-full max-w-content flex-1 min-[1700px]:mx-0 min-[1700px]:mr-10 min-[1700px]:max-w-none narrow:flex-none"
        >
          {/* 카드가 자리에서 바뀐다. key로 갈아 끼워야 새 카드가 바로 붙어 포커스가 따라간다 */}
          <motion.div
            key={chapters ? 'chapters' : 'stages'}
            className={chapters ? 'chapter-grid' : 'stage-grid'}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            // 다른 나타남과 같은 시간과 곡선을 쓴다
            transition={{ duration: 0.3, ease: 'easeOut' }}
          >
            {chapters
              ? chapterCards.map((card) => (
                  <ChapterCard
                    key={card.chapter}
                    {...card}
                    onSelect={() => handleChapter(card.chapter)}
                  />
                ))
              : cards.map((card) => (
                  <StageCard key={card.id} {...card} onSelect={() => handleSelect(card.id)} />
                ))}
          </motion.div>
        </div>
      </section>
    </main>
  )
}

export default StageSelectScreen
