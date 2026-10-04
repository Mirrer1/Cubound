import { motion, useReducedMotion } from 'motion/react'
import { type MouseEvent, type RefObject, useEffect, useRef, useState } from 'react'

import Button from '@/components/ui/Button'
import type { Guide } from '@/game/types'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { guideText, text } from '@/i18n'
import { isTouchDevice } from '@/platform/input'
import { useSettingsStore } from '@/store/settingsStore'

interface GuideOverlayProps {
  guides: Guide[]
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

type Place = 'top' | 'under' | 'bottom' | 'left' | 'right'

const ELEMENT_PADDING = 8
const CARD_SPACE = 210 // 카드가 들어갈 위아래 최소 공간 px
const NEAR_SPACE = 240 // 대상 쪽에 놓을 때 필요한 공간 px, 카드 높이와 화면 가장자리 여백
const SIDE_SPACE = 320 // 카드가 들어갈 좌우 최소 공간 px, 카드 300과 가장자리 여백 16
const UNDER_GAP = 12 // under일 때 대상과 카드 사이 px

const PLACES: Record<Place, string> = {
  top: 'inset-x-4 top-4 wide:inset-x-8 wide:top-8',
  under: 'inset-x-4 wide:inset-x-8',
  bottom: 'inset-x-4 bottom-4 wide:inset-x-8 wide:bottom-8',
  left: 'inset-y-4 left-4 w-[300px]',
  right: 'inset-y-4 right-4 w-[300px]',
}

// 위아래가 좁으면 대상을 가리지 않게 좌우로 비켜 놓는 자리
// 헤더에 붙은 요소는 예외, 아래 띠가 화면 반대편이라 대상 바로 아래
const placeFor = (hole: Hole, width: number, height: number, element: boolean): Place => {
  const above = hole.top
  const below = height - hole.top - hole.height
  const side = width - hole.left - hole.width >= hole.left ? 'right' : 'left'
  const sideRoom = Math.max(hole.left, width - hole.left - hole.width)
  const vertical = above > below ? 'top' : 'bottom'
  const place = Math.max(above, below) >= CARD_SPACE || sideRoom < SIDE_SPACE ? vertical : side

  return place === 'bottom' && element && above < NEAR_SPACE ? 'under' : place
}

// 가로 띠인 under의 카드 정렬, 대상이 치우쳐 있으면 그쪽
const alignFor = (hole: Hole, width: number) => {
  const center = hole.left + hole.width / 2
  if (center > width * 0.6) return 'justify-end'
  if (center < width * 0.4) return 'justify-start'
  return 'justify-center'
}

const sameHole = (a: Hole, b: Hole) =>
  a.left === b.left && a.top === b.top && a.width === b.width && a.height === b.height

const stopClick = (e: MouseEvent) => e.stopPropagation()

let pen: CanvasRenderingContext2D | null = null

// 테두리 없는 글자 덩이의 획이 닿는 범위, 줄 높이의 빈 자리와 끝 자간 제외
const inkOf = (el: Element) => {
  if (getComputedStyle(el).borderTopWidth !== '0px') return null
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
  const [measured, setMeasured] = useState<{ hole: Hole; place: Place; align: string } | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const nextRef = useRef<HTMLButtonElement>(null)
  const reduced = useReducedMotion()
  const language = useSettingsStore((s) => s.language)
  const guide = guides[step]
  const targetName = typeof guide.target === 'string' ? guide.target : 'cell'
  const isLast = step === guides.length - 1
  const hole = measured?.hole
  const place = measured?.place ?? 'bottom'
  const align = measured?.align ?? 'justify-center'
  const speed = reduced ? 0.35 : 1

  useFocusTrap(cardRef)

  // 키보드로 이어서 넘기는 단계마다의 넘기기 버튼 포커스
  useEffect(() => {
    nextRef.current?.focus()
  }, [step])

  // 카메라 이동과 화면 크기 변화로 움직이는 대상, 매 프레임 재는 실제 위치
  useEffect(() => {
    let frame = 0
    const measure = () => {
      const container = containerRef.current
      const found = container
        ? [...container.querySelectorAll(`[data-guide="${targetName}"]`)]
            .map((el) => inkOf(el) ?? el.getBoundingClientRect())
            .find((r) => r.width > 0)
        : undefined
      if (container && found) {
        const base = container.getBoundingClientRect()
        const padding = targetName === 'cell' ? 0 : ELEMENT_PADDING
        const next = {
          left: Math.round(found.left - base.left - padding),
          top: Math.round(found.top - base.top - padding),
          width: Math.round(found.width + padding * 2),
          height: Math.round(found.height + padding * 2),
          borderRadius: targetName === 'cell' ? 28 : 18,
        }
        const nextPlace = placeFor(next, base.width, base.height, targetName !== 'cell')
        const nextAlign = alignFor(next, base.width)
        setMeasured((prev) =>
          prev && sameHole(prev.hole, next) && prev.place === nextPlace && prev.align === nextAlign
            ? prev
            : { hole: next, place: nextPlace, align: nextAlign },
        )
      }
      frame = requestAnimationFrame(measure)
    }
    frame = requestAnimationFrame(measure)
    return () => cancelAnimationFrame(frame)
  }, [containerRef, targetName])

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
    <motion.div
      className="absolute inset-0 z-10 cursor-pointer"
      onClick={onNext}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.2 * speed } }}
      transition={{ duration: 0.3 * speed, ease: 'easeOut' }}
    >
      {hole && (
        <motion.div
          className="pointer-events-none absolute"
          style={{
            boxShadow: '0 0 0 200vmax color-mix(in srgb, var(--color-ink) 55%, transparent)',
          }}
          initial={hole}
          animate={hole}
          transition={{ type: 'spring', bounce: 0, duration: 0.5 * speed }}
        />
      )}
      <motion.div
        layout="position"
        className={`absolute flex items-center ${place === 'under' && hole ? align : 'justify-center'} ${PLACES[place]}`}
        style={place === 'under' && hole ? { top: hole.top + hole.height + UNDER_GAP } : undefined}
        transition={{ duration: 0.35 * speed, ease: 'easeInOut' }}
      >
        <motion.div
          ref={cardRef}
          className="flex w-full max-w-[420px] cursor-default flex-col gap-4 rounded-[22px] border border-line bg-base-bg p-6 shadow-[0_20px_60px_-20px_rgb(0_0_0/0.18)] short:gap-3 short:p-4"
          onClick={stopClick}
          initial={{ y: 6, scale: 0.98 }}
          animate={{ y: 0, scale: 1 }}
          transition={{ duration: 0.3 * speed, ease: 'easeOut' }}
        >
          <span className="font-mono text-[11px] tracking-[0.22em] text-mute">
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
              className="relative -ml-2 cursor-pointer rounded-lg px-2 py-1 text-sm text-mute transition-soft after:absolute after:-inset-x-1 after:-inset-y-2.5 hover:bg-hover"
              onClick={onSkip}
            >
              {text(language, 'guide.skip')}
            </button>
            {isLast ? (
              <Button ref={nextRef} variant="primary" onClick={onNext}>
                {text(language, 'guide.start')}
              </Button>
            ) : (
              <Button
                ref={nextRef}
                variant="icon"
                onClick={onNext}
                title={text(language, 'guide.next')}
              >
                &gt;
              </Button>
            )}
          </div>
        </motion.div>
      </motion.div>
    </motion.div>
  )
}

export default GuideOverlay
