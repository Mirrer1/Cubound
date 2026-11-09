import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { type MouseEvent, type RefObject, useCallback, useEffect, useRef, useState } from 'react'

import Button from '@/components/ui/Button'
import ChevronIcon from '@/components/ui/icons/ChevronIcon'
import type { SelectGuide } from '@/game/selectGuide'
import type { Guide } from '@/game/types'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { guideText, text } from '@/i18n'
import { isTouchDevice } from '@/platform/input'
import { useSettingsStore } from '@/store/settingsStore'

interface GuideOverlayProps {
  guides: (Guide | SelectGuide)[]
  step: number
  limit?: number // 보스 제약 안내 문구의 {n}
  containerRef: RefObject<HTMLElement | null>
  onNext: () => void
  onSkip: () => void
}

type Hole = {
  left: number
  top: number
  width: number
  height: number
  borderRadius: number
}

type Place = 'top' | 'bottom' | 'left' | 'right' | 'beside'

const ELEMENT_PADDING = 8
const CARD_SPACE = 210 // 카드가 들어갈 위아래 최소 공간 px
const SIDE_SPACE = 320 // 카드가 들어갈 좌우 최소 공간 px, 카드 300과 가장자리 여백 16
const GAP = 12 // beside 카드와 대상 사이 px
const STEADY_SPACE = 32 // 위아래 카드의 화면 가장자리 여백 px
const EDGE = 16 // beside 카드와 화면 가장자리 사이 최소 px
const EXIT = 0.1 // 앞 단계 영역과 카드가 꺼지는 초
const APPEAR = 0.2 // 새 영역과 카드가 켜지는 초
const STILL = 80 // 대상이 멈췄다고 보는 ms, 카메라가 옮기는 칸 대상
const NUDGE = 8 // 멈춘 것으로 보는 움직임 px, 카드 등장 연출의 작은 떠오름

// 위아래 자리는 카드 폭 상자라 beside로 옮길 때 보이는 카드 자리에서 출발
const PLACES: Record<Place, string> = {
  top: 'inset-x-0 top-4 mx-auto w-[26.25rem] max-w-[calc(100%-2rem)] wide:top-8',
  bottom: 'inset-x-0 bottom-4 mx-auto w-[26.25rem] max-w-[calc(100%-2rem)] wide:bottom-8',
  left: 'inset-y-4 left-4 w-[18.75rem]',
  right: 'inset-y-4 right-4 w-[18.75rem]',
  beside: 'w-[26.25rem] max-w-[calc(100%-2rem)]',
}

// 대상이 여럿이라 옆에 붙일 수 없을 때 위아래가 좁으면 좌우로 비켜 놓는 자리
const sidePlaceFor = (hole: Hole, width: number, height: number): Place => {
  const above = hole.top
  const below = height - hole.top - hole.height
  const side = width - hole.left - hole.width >= hole.left ? 'right' : 'left'
  const sideRoom = Math.max(hole.left, width - hole.left - hole.width)
  const vertical = above > below ? 'top' : 'bottom'
  return Math.max(above, below) >= CARD_SPACE || sideRoom < SIDE_SPACE ? vertical : side
}

// 직전 자리에 머무는 위아래 가운데 카드, 대상과 겹치면 반대쪽, 둘 다 겹치면 대상 옆
// 대상이 여럿이면 옆 대신 sidePlaceFor 자리
const placeFor = (
  holes: Hole[],
  width: number,
  height: number,
  cardHeight: number,
  previous: Place | undefined,
): Place => {
  const hole = spanOf(holes)
  const fits = {
    top: hole.top >= cardHeight + STEADY_SPACE,
    bottom: hole.top + hole.height <= height - cardHeight - STEADY_SPACE,
  }
  const first = previous === 'top' ? 'top' : 'bottom'
  const second = first === 'top' ? 'bottom' : 'top'
  if (fits[first]) return first
  if (fits[second]) return second
  return holes.length === 1 ? 'beside' : sidePlaceFor(hole, width, height)
}

// 대상 옆에 붙는 카드 자리, 오른쪽에 자리가 없으면 왼쪽, 세로는 대상 가운데
const besideSpot = (
  hole: Hole,
  width: number,
  height: number,
  cardWidth: number,
  cardHeight: number,
) => {
  const right = hole.left + hole.width + GAP
  const left = right + cardWidth <= width - EDGE ? right : hole.left - GAP - cardWidth
  const top = hole.top + hole.height / 2 - cardHeight / 2
  return {
    left: Math.round(Math.min(Math.max(left, EDGE), width - cardWidth - EDGE)),
    top: Math.round(Math.min(Math.max(top, EDGE), height - cardHeight - EDGE)),
  }
}

const sameHole = (a: Hole, b: Hole) =>
  a.left === b.left && a.top === b.top && a.width === b.width && a.height === b.height

// 여러 구멍을 다 담는 범위, 카드 자리를 정하는 기준
const spanOf = (holes: Hole[]) => {
  const left = Math.min(...holes.map((h) => h.left))
  const top = Math.min(...holes.map((h) => h.top))
  const width = Math.max(...holes.map((h) => h.left + h.width)) - left
  const height = Math.max(...holes.map((h) => h.top + h.height)) - top
  return { left, top, width, height, borderRadius: 0 }
}

const rectOf = (h: Hole) => ({
  attrX: h.left,
  attrY: h.top,
  width: h.width,
  height: h.height,
  rx: h.borderRadius,
})

const stopClick = (e: MouseEvent) => e.stopPropagation()

let pen: CanvasRenderingContext2D | null = null

// 버튼이 아닌 테두리 없는 글자 덩이의 획이 닿는 범위, 줄 높이의 빈 자리와 끝 자간 제외
const inkOf = (el: Element) => {
  if (el.tagName === 'BUTTON' || getComputedStyle(el).borderTopWidth !== '0px') return null
  pen ??= document.createElement('canvas').getContext('2d')
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
  let ink: { left: number; top: number; right: number; bottom: number } | null = null
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const range = document.createRange()
    range.selectNodeContents(node)
    const box = range.getBoundingClientRect()
    if (!pen || !node.parentElement || !node.textContent?.trim() || box.width === 0) continue
    const style = getComputedStyle(node.parentElement)
    pen.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
    pen.letterSpacing = style.letterSpacing
    const m = pen.measureText(node.textContent)
    const baseline =
      box.top +
      (box.height - m.fontBoundingBoxAscent - m.fontBoundingBoxDescent) / 2 +
      m.fontBoundingBoxAscent
    const left = box.left - m.actualBoundingBoxLeft
    const right = box.left + m.actualBoundingBoxRight
    const top = baseline - m.actualBoundingBoxAscent
    const bottom = baseline + m.actualBoundingBoxDescent
    ink = ink
      ? {
          left: Math.min(ink.left, left),
          top: Math.min(ink.top, top),
          right: Math.max(ink.right, right),
          bottom: Math.max(ink.bottom, bottom),
        }
      : { left, top, right, bottom }
  }
  return ink && { ...ink, width: ink.right - ink.left, height: ink.bottom - ink.top }
}

const GuideOverlay = ({ guides, step, limit, containerRef, onNext, onSkip }: GuideOverlayProps) => {
  const [measured, setMeasured] = useState<{
    holes: Hole[]
    place: Place
    spot: { left: number; top: number } | null // beside 카드의 자리
    step: number // 잰 단계
    ready: boolean // 대상이 멈춰 영역과 카드를 켤 때
  } | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const nextRef = useRef<HTMLButtonElement>(null)
  // 카드가 다시 그려지는 동안에도 자리 계산에 쓰는 마지막 카드 크기
  const cardSize = useRef({ width: 0, height: 0 })
  const placeRef = useRef<Place>(undefined)
  const reduced = useReducedMotion()
  const language = useSettingsStore((s) => s.language)
  const guide = guides[step]
  const targetName = typeof guide.target === 'string' ? guide.target : 'cell'
  // 판 위 칸을 감싸는 대상, 갑문 두 웅덩이 포함
  const onBoard = targetName === 'cell' || targetName === 'lock'
  const isLast = step === guides.length - 1
  const holes = measured?.holes ?? []
  const place = measured?.place ?? 'bottom'
  const spot = measured?.spot ?? null
  const placeStyle = spot ? { left: spot.left, top: spot.top } : undefined
  const speed = reduced ? 0.35 : 1
  const ready = measured?.step === step && measured.ready
  const holeRects = holes.map(rectOf)

  // 단계마다 다시 그려지는 카드의 넘기기 버튼 포커스
  const focusNext = useCallback((button: HTMLButtonElement | null) => {
    nextRef.current = button
    button?.focus()
  }, [])

  useFocusTrap(cardRef)

  // 키보드로 이어서 넘기는 단계마다의 넘기기 버튼 포커스
  useEffect(() => {
    nextRef.current?.focus()
  }, [step])

  // 카메라 이동과 화면 크기 변화로 움직이는 대상, 매 프레임 재는 실제 위치
  useEffect(() => {
    let frame = 0
    // 한 단계에 한 번 정하는 카드 자리, 나타나며 움직이는 대상 탓의 오락가락 방지
    let placedFor = ''
    let anchor: Hole[] = []
    let changedAt = performance.now()
    let stepReady = false
    const measure = () => {
      const container = containerRef.current
      const found = container
        ? [...container.querySelectorAll(`[data-guide="${targetName}"]`)]
            .map((el) => ({
              r: inkOf(el) ?? el.getBoundingClientRect(),
              // 옆 요소와 닿는 대상의 좁은 여백, data-guide-pad
              pad: Number((el as HTMLElement).dataset.guidePad ?? ELEMENT_PADDING),
            }))
            .filter(({ r }) => r.width > 0)
        : []
      if (container && found.length > 0) {
        const base = container.getBoundingClientRect()
        const next = found.map(({ r, pad }) => {
          const padding = onBoard ? 0 : pad
          return {
            left: r.left - base.left - container.clientLeft - padding,
            top: r.top - base.top - container.clientTop - padding,
            width: r.width + padding * 2,
            height: r.height + padding * 2,
            borderRadius: Math.round(Math.min(onBoard ? 20 : 14, (r.height + padding * 2) * 0.3)),
          }
        })
        if (cardRef.current) {
          cardSize.current = {
            width: cardRef.current.offsetWidth,
            height: cardRef.current.offsetHeight,
          }
        }
        const size = `${base.width}x${base.height}`
        const nextPlace =
          placedFor === size && placeRef.current
            ? placeRef.current
            : placeFor(
                next,
                base.width,
                base.height,
                cardSize.current.height || CARD_SPACE,
                placeRef.current,
              )
        // 카드 크기를 모르는 첫 단계는 카드가 그려질 때까지 다시 정함
        placedFor = cardSize.current.height > 0 ? size : ''
        placeRef.current = nextPlace
        const now = performance.now()
        const moved =
          anchor.length !== next.length ||
          anchor.some(
            (h, i) =>
              Math.abs(h.left - next[i].left) > NUDGE ||
              Math.abs(h.top - next[i].top) > NUDGE ||
              Math.abs(h.width - next[i].width) > NUDGE,
          )
        if (moved) {
          anchor = next
          changedAt = now
        }
        stepReady ||= now - changedAt >= STILL
        const nextReady = stepReady
        const nextSpot =
          nextPlace === 'beside'
            ? besideSpot(
                spanOf(next),
                base.width,
                base.height,
                cardSize.current.width,
                cardSize.current.height,
              )
            : null
        setMeasured((prev) =>
          prev &&
          prev.holes.length === next.length &&
          prev.holes.every((h, i) => sameHole(h, next[i])) &&
          prev.place === nextPlace &&
          prev.spot?.left === nextSpot?.left &&
          prev.spot?.top === nextSpot?.top &&
          prev.step === step &&
          prev.ready === nextReady
            ? prev
            : {
                holes: next,
                place: nextPlace,
                spot: nextSpot,
                step,
                ready: nextReady,
              },
        )
      }
      frame = requestAnimationFrame(measure)
    }
    frame = requestAnimationFrame(measure)
    return () => cancelAnimationFrame(frame)
  }, [containerRef, targetName, onBoard, step])

  // Enter와 Space는 다음 단계, Esc는 건너뛰기, 카드 안에 포커스가 있으면 버튼 몫
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onSkip()
        return
      }
      if (e.key !== 'Enter' && e.key !== ' ') return
      if (cardRef.current?.contains(document.activeElement)) return
      e.preventDefault()
      if (!e.repeat) onNext()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onNext, onSkip])

  return (
    // 나타날 때는 어두운 면만 진해짐, 막 전체 투명도 연출 중 사파리가 영역을 비켜 그리는 탓
    <motion.div
      className="absolute inset-0 z-10 cursor-pointer"
      onClick={onNext}
      exit={{ opacity: 0, transition: { duration: 0.2 * speed } }}
    >
      {holes.length > 0 && (
        <svg className="pointer-events-none absolute inset-0 size-full">
          <mask id="guide-holes">
            <rect width="100%" height="100%" fill="white" />
            {/* 단계마다 앞 영역은 꺼지고 대상이 멈춘 자리에서 새 영역이 켜짐 */}
            <AnimatePresence>
              {ready &&
                holeRects.map((rect, i) => (
                  <motion.rect
                    key={`${step}-${i}`}
                    fill="black"
                    initial={{ ...rect, opacity: 0 }}
                    animate={{ ...rect, opacity: 1 }}
                    exit={{ opacity: 0, transition: { duration: EXIT * speed } }}
                    // 움직이는 대상에 바로 붙는 영역, 켜지고 꺼질 때만 부드럽게
                    transition={{ duration: 0, opacity: { duration: APPEAR * speed } }}
                  />
                ))}
            </AnimatePresence>
          </mask>
          <motion.rect
            width="100%"
            height="100%"
            mask="url(#guide-holes)"
            style={{ fill: 'color-mix(in srgb, var(--color-ink) 55%, transparent)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 * speed, ease: 'easeOut' }}
          />
        </svg>
      )}
      {/* 카드도 영역과 함께 단계마다 꺼졌다가 새 자리에서 켜짐 */}
      <AnimatePresence mode="wait">
        {ready && (
          <motion.div
            key={`${step}-${place}`}
            layout="position"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: EXIT * speed } }}
            className={`absolute flex items-center justify-center ${PLACES[place]}`}
            style={placeStyle}
            transition={{
              duration: 0.35 * speed,
              ease: 'easeInOut',
              opacity: { duration: APPEAR * speed },
            }}
          >
            <motion.div
              ref={cardRef}
              className="flex w-full max-w-[26.25rem] cursor-default flex-col gap-4 rounded-[1.375rem] border border-line bg-base-bg p-6 shadow-[0_20px_60px_-20px_rgb(0_0_0/0.18)] short:gap-3 short:p-4"
              onClick={stopClick}
              initial={{ y: 6, scale: 0.98 }}
              animate={{ y: 0, scale: 1 }}
              transition={{ duration: APPEAR * speed, ease: 'easeOut' }}
            >
              <span className="font-mono text-[0.6875rem] tracking-[0.22em] text-mute">
                GUIDE {step + 1} / {guides.length}
              </span>
              <motion.p
                key={step}
                className="min-h-14 text-lg leading-snug break-keep short:min-h-11 short:text-base"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.25 * speed }}
              >
                {guideText(language, guide.id, isTouchDevice(), limit)}
              </motion.p>
              <div className="flex min-h-14 items-center justify-between">
                <button
                  type="button"
                  className="relative -ml-2 cursor-pointer rounded-lg px-2 py-1 text-sm text-mute transition-soft after:absolute after:-inset-x-1 after:top-1/2 after:h-[max(100%,44px)] after:-translate-y-1/2 hover:bg-hover"
                  onClick={onSkip}
                >
                  {text(language, 'guide.skip')}
                </button>
                {isLast ? (
                  <Button
                    ref={focusNext}
                    variant="primary"
                    className="h-11! rounded-[0.8125rem]! px-6! text-base!"
                    onClick={onNext}
                  >
                    {text(language, 'guide.start')}
                  </Button>
                ) : (
                  <Button
                    ref={focusNext}
                    variant="icon"
                    onClick={onNext}
                    title={text(language, 'guide.next')}
                  >
                    <ChevronIcon className="size-[0.625em] rotate-180" />
                  </Button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export default GuideOverlay
