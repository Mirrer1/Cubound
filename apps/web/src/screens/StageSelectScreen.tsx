import { AnimatePresence, motion } from 'motion/react'
import { type MouseEvent, useEffect, useLayoutEffect, useRef, useState } from 'react'

import GuideOverlay from '@/components/guide/GuideOverlay'
import Button from '@/components/ui/Button'
import ChapterCard from '@/components/ui/ChapterCard'
import ChapterTab from '@/components/ui/ChapterTab'
import StageCard, { type StageCardState } from '@/components/ui/StageCard'
import Toast from '@/components/ui/Toast'
import BackIcon from '@/components/ui/icons/BackIcon'
import ChevronIcon from '@/components/ui/icons/ChevronIcon'
import GuideIcon from '@/components/ui/icons/GuideIcon'
import StarIcon from '@/components/ui/icons/StarIcon'
import { isUnlocked, isWorldUnlocked, totalStars } from '@/game/progress'
import { selectGuides } from '@/game/selectGuide'
import { useText } from '@/hooks/useText'
import { chapterTextKey, sentencesOf, worldNoteKey, worldTextKey } from '@/i18n'
import { localSelectGuideStorage, localWorldStorage } from '@/platform/storage'
import { goTo, hashOf, replaceHash, showingAll } from '@/routes/route'
import {
  CHAPTER_SLOTS,
  type ChapterState,
  STAGES_PER_WORLD,
  WORLDS_PER_CYCLE,
  chapterStageIds,
  chapterStateOf,
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

// 한 줄에 놓인 카드 수, 화면 폭에 따라 달라져 누를 때마다 재는 값
const columnsOf = (cards: HTMLButtonElement[]) =>
  cards.filter((card) => card.offsetTop === cards[0].offsetTop).length

// 잠긴 카드를 건너뛰고 같은 방향으로 이어서 찾는 다음 카드
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
  const sectionRef = useRef<HTMLElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLElement>(null)
  // 보고 있는 가이드 단계와 끝나면 돌아갈 장 고르기 상태, 처음 들어온 때 한 번
  const [guide, setGuide] = useState<{ step: number; back: boolean } | null>(() =>
    localSelectGuideStorage.load() ? null : { step: 0, back: chapters },
  )
  // 준비 중 안내의 장 번호, 사라지는 동안에도 남는 값
  const [soon, setSoon] = useState<{ chapter: number; shown: boolean } | null>(null)
  const t = useText()

  const chapter = cycleOf(world)
  // 한 장 안에서만 움직이는 화살표, 장을 넘는 길은 덩이 하나
  const siblings = worldsOf(chapter)
  const index = siblings.indexOf(world)
  const all = showingAll()
  const unlocked = all || isWorldUnlocked(progress, worldUnlockStageId(world))
  // 아직 열리지 않은 월드는 이름부터 숨김, 들어가 봐야 잠긴 카드뿐인 탓
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

  const chapterCards = Array.from({ length: CHAPTER_SLOTS }, (_, i) => {
    const n = i + 1
    const state = chapterStateOf(progress, n, chapter, all)

    return {
      chapter: n,
      name: state === 'soon' ? '' : t(chapterTextKey(n)),
      stars: state === 'soon' ? 0 : totalStars(progress, chapterStageIds(n)),
      total: WORLDS_PER_CYCLE * STAGES_PER_WORLD * 3,
      state,
    }
  })
  const nowChapter = Math.max(
    0,
    chapterCards.findIndex((card) => card.state === 'now'),
  )
  const firstLocked = cards.findIndex((card) => card.state === 'locked')
  const guides = selectGuides(unlocked, firstLocked >= 0)
  const guiding = guide !== null
  const guideTarget = guide !== null ? guides[guide.step]?.target : undefined
  const guideOnChapters = guideTarget === 'chapterCard'
  const stageGuideOf = (i: number) =>
    unlocked && i === now ? 'stage' : i === firstLocked ? 'locked' : undefined

  const handleBack = () => goTo({ screen: 'title' })
  const handleSelect = (stageId: string) => goTo({ screen: 'play', stageId })
  const handlePrevious = () => goTo({ screen: 'select', world: siblings[index - 1] })
  const handleNext = () => goTo({ screen: 'select', world: siblings[index + 1] })
  const handleChapters = () => goTo({ screen: 'select', world, chapters: !chapters })
  // 같은 장을 다시 고르면 첫 월드가 아닌 보던 월드, 준비 중인 장은 이동 대신 안내, 안내가 떠 있으면 무시
  const handleChapter = (n: number, state: ChapterState) => {
    if (state !== 'soon') {
      goTo({ screen: 'select', world: n === chapter ? world : currentWorldOf(progress, n) })
    } else if (!soon?.shown) {
      setSoon({ chapter: n, shown: true })
    }
  }
  // 남으면 Enter나 Space로 가이드가 다시 열리는 버튼 포커스 해제
  const handleOpenGuide = (e: MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.blur()
    setGuide({ step: 0, back: chapters })
  }
  // 가이드가 바꾼 장 고르기 상태의 되돌림, 방문 기록에 안 남는 주소 덮어쓰기
  const handleCloseGuide = () => {
    if (guide && guide.back !== chapters) {
      replaceHash(hashOf({ screen: 'select', world, chapters: guide.back }))
    }
    setGuide(null)
  }
  const handleNextGuide = () => {
    if (guide && guide.step + 1 < guides.length) setGuide({ ...guide, step: guide.step + 1 })
    else handleCloseGuide()
  }

  // 타이틀로 나갔다 돌아왔을 때 돌아올 보던 월드 기록
  useEffect(() => {
    localWorldStorage.save(all, world)
  }, [all, world])

  // 준비 중 안내가 떠 있는 시간
  useEffect(() => {
    if (!soon?.shown) return
    const timer = setTimeout(() => setSoon({ ...soon, shown: false }), 1800)
    return () => clearTimeout(timer)
  }, [soon])

  // 처음 한 번 띄운 기록
  useEffect(() => {
    if (guiding) localSelectGuideStorage.save()
  }, [guiding])

  // 가이드 단계가 비추는 화면, 장 카드 단계만 장 고르기
  useEffect(() => {
    if (guiding && guideOnChapters !== chapters) {
      replaceHash(hashOf({ screen: 'select', world, chapters: guideOnChapters }))
    }
  }, [guiding, guideOnChapters, chapters, world])

  // 폰 세로처럼 스크롤되는 목록에서 화면 밖에 놓인 가이드 대상
  useEffect(() => {
    if (!guideTarget) return
    panelRef.current
      ?.querySelector(`[data-guide="${guideTarget}"]`)
      ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [guideTarget, chapters])

  // 첫 포커스는 지금 자리, 열린 카드가 없는 잠긴 월드는 월드 화살표, 가이드 중에는 가이드 카드
  useEffect(() => {
    if (guiding) return
    const items = cardsIn(gridRef.current)
    const target = chapters ? items[nowChapter] : unlocked ? items[now] : previousRef.current
    target?.focus()
  }, [now, nowChapter, unlocked, chapters, guiding])

  // 방향키는 카드 사이 이동, Esc는 장 고르기 닫기, 닫혀 있으면 타이틀, 가이드 중에는 가이드 몫
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (guiding) return
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
  }, [now, nowChapter, chapters, world, guiding])

  // 카드 크기 계산에 넘기는 헤더 높이, 그리기 전에 넣어 첫 화면 튐 방지
  useLayoutEffect(() => {
    const section = sectionRef.current
    const header = headerRef.current
    if (!section || !header) return
    const observer = new ResizeObserver(() =>
      section.style.setProperty('--head', `${header.getBoundingClientRect().height}px`),
    )
    observer.observe(header)
    return () => observer.disconnect()
  }, [])

  return (
    <main className="mx-auto flex h-dvh max-w-[1920px] screen-pad select-screen phone-wide:pt-[max(0.5rem,env(safe-area-inset-top))]! phone-wide:pb-[max(0.5rem,env(safe-area-inset-bottom))]!">
      {/* 가이드가 덮는 스크롤 없는 판, 스크롤 영역의 양쪽 스크롤바 자리만큼 어긋남 방지 */}
      <div ref={panelRef} className="relative flex min-h-0 min-w-0 flex-1">
        <section
          ref={sectionRef}
          className="select-frame flex min-h-0 flex-1 flex-col rounded-[1.375rem] border border-line bg-base-bg panel-pad phone-wide:py-3! pad-tall:px-6! pad-wide:py-6! laptop:py-6!"
        >
          {/* 남는 높이를 위 4 : 아래 6으로 나누는 여백, 폰 세로는 제외 */}
          <div className="min-h-0 shrink grow-4 basis-0 phone-tall:hidden monitor:grow-5" />
          <div className="select-block">
            <header ref={headerRef} className="select-head">
              <Button
                variant="tool"
                onClick={handleBack}
                aria-label={t('select.back')}
                className="[grid-area:back] phone-wide:rounded-[0.6rem]"
              >
                <BackIcon />
              </Button>
              <ChapterTab
                chapter={chapter}
                world={world}
                name={t(worldTextKey(world))}
                open={chapters}
                label={t('select.chapters')}
                guide="chapter"
                onClick={handleChapters}
                className="justify-self-stretch [grid-area:box]"
              />
              <span className="hidden text-(length:--desc)/[1.55] break-keep text-mute [grid-area:desc] monitor:block monitor:pl-1">
                {sentencesOf(t(worldNoteKey(world))).map((sentence) => (
                  <span key={sentence} className="monitor:block">
                    {sentence}{' '}
                  </span>
                ))}
              </span>
              {/* 투명 윗선은 가이드가 글자 획 대신 끝의 별 아이콘까지 감싸는 상자 기준 */}
              <span
                data-guide="stars"
                className="-mt-px flex items-baseline gap-1.5 border-t border-transparent whitespace-nowrap [grid-area:stars] phone-tall:mr-1 phone-tall:justify-self-end monitor:gap-[0.5625rem] monitor:pl-1"
              >
                <span className="min-w-[1.15em] text-right text-(length:--star-n)/none font-normal text-ink tabular-nums monitor:min-w-0 monitor:font-mono monitor:tracking-[0.06em]">
                  {totalStars(progress, ids)}
                </span>
                <span className="font-mono text-(length:--star-l) tracking-[0.15em] text-mute">
                  / {ids.length * 3} <StarIcon className="inline-block size-[1em] align-[-0.1em]" />
                </span>
              </span>
              <span className="flex items-center gap-2.5 [grid-area:nav] monitor:-ml-2.5">
                {/* 월드가 하나뿐인 장에서도 남기는 자리, 장을 넘길 때 왼쪽 흔들림 방지 */}
                <span data-guide="worlds" data-guide-pad="2" className="flex gap-1">
                  <Button
                    ref={previousRef}
                    variant="ghost"
                    disabled={index === 0}
                    onClick={handlePrevious}
                    aria-label={t('select.previousWorld')}
                  >
                    <ChevronIcon />
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={!nextOpen}
                    onClick={handleNext}
                    aria-label={t('select.nextWorld')}
                  >
                    <ChevronIcon className="size-[1em] rotate-180" />
                  </Button>
                </span>
                {/* 모니터는 ←와 같은 높이, 장 덩이 오른쪽 끝 */}
                <Button
                  variant="tool"
                  onClick={handleOpenGuide}
                  title={t('play.guide')}
                  className="phone-wide:rounded-[0.6rem] monitor:absolute monitor:top-0 monitor:right-0"
                >
                  <GuideIcon />
                </Button>
              </span>
            </header>
            {/* 스테이지와 장 고르기가 같은 자리, 여닫을 때 헤더 위치 고정 */}
            <div ref={gridRef} className="select-slot phone-tall:scroll-area pad-tall:scroll-area">
              {/* 자리에서 바뀌는 카드, 새 카드가 바로 붙어 포커스가 따라가는 key 교체 */}
              <motion.div
                key={chapters ? 'chapters' : 'stages'}
                className={chapters ? 'select-chapters' : 'select-grid'}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                // 다른 나타남과 같은 시간과 곡선
                transition={{ duration: 0.3, ease: 'easeOut' }}
              >
                {chapters
                  ? chapterCards.map((card, i) => (
                      <ChapterCard
                        key={card.chapter}
                        {...card}
                        soonText={t('select.soon')}
                        guide={i === nowChapter ? 'chapterCard' : undefined}
                        onSelect={() => handleChapter(card.chapter, card.state)}
                      />
                    ))
                  : cards.map((card, i) => (
                      <StageCard
                        key={card.id}
                        {...card}
                        guide={stageGuideOf(i)}
                        starsGuide={i === 0 && card.state !== 'locked' ? 'stars' : undefined}
                        onSelect={() => handleSelect(card.id)}
                      />
                    ))}
              </motion.div>
            </div>
          </div>
          <div className="min-h-0 shrink grow-6 basis-0 phone-tall:hidden monitor:grow-5" />
        </section>
        <AnimatePresence>
          {guide !== null && (
            <GuideOverlay
              guides={guides}
              step={guide.step}
              containerRef={panelRef}
              onNext={handleNextGuide}
              onSkip={handleCloseGuide}
            />
          )}
        </AnimatePresence>
      </div>
      <Toast show={soon?.shown ? String(soon.chapter) : null}>
        <span className="font-mono text-(length:--lab) tracking-[0.2em] text-base-bg/60">
          CHAPTER {soon?.chapter}
        </span>
        {t('select.soonToast')}
      </Toast>
    </main>
  )
}

export default StageSelectScreen
