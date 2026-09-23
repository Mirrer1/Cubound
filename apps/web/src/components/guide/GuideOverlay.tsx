import { motion, useReducedMotion } from 'motion/react'
import { type MouseEvent, type RefObject, useEffect, useRef, useState } from 'react'

import Button from '@/components/ui/Button'
import { useFocusTrap } from '@/components/ui/useFocusTrap'
import type { Guide } from '@/game/types'
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
const NEAR_SPACE = 240 // 대상 쪽에 놓을 때 필요한 공간 px. 카드 높이와 화면 가장자리 여백
const SIDE_SPACE = 320 // 카드가 들어갈 좌우 최소 공간 px. 카드 300과 가장자리 여백 16
const UNDER_GAP = 12 // under일 때 대상과 카드 사이 px

const PLACES: Record<Place, string> = {
  top: 'inset-x-4 top-4 wide:inset-x-8 wide:top-8',
  under: 'inset-x-4 wide:inset-x-8',
  bottom: 'inset-x-4 bottom-4 wide:inset-x-8 wide:bottom-8',
  left: 'inset-y-4 left-4 w-[300px]',
  right: 'inset-y-4 right-4 w-[300px]',
}

// 위아래가 좁으면 좌우로 비켜 놓아 비추는 대상을 가리지 않는다.
// 다만 헤더에 붙은 요소는 아래 띠로 보내면 화면 반대편이 되어 대상 바로 아래에 놓는다
const placeFor = (hole: Hole, width: number, height: number, element: boolean): Place => {
  const above = hole.top
  const below = height - hole.top - hole.height
  const side = width - hole.left - hole.width >= hole.left ? 'right' : 'left'
  const sideRoom = Math.max(hole.left, width - hole.left - hole.width)
  const vertical = above > below ? 'top' : 'bottom'
  const place = Math.max(above, below) >= CARD_SPACE || sideRoom < SIDE_SPACE ? vertical : side

  return place === 'bottom' && element && above < NEAR_SPACE ? 'under' : place
}

// under는 가로로 띠라서 넓은 화면에서 카드가 가운데로 간다. 대상이 치우쳐 있으면 그쪽으로 붙인다
const alignFor = (hole: Hole, width: number) => {
  const center = hole.left + hole.width / 2
  if (center > width * 0.6) return 'justify-end'
  if (center < width * 0.4) return 'justify-start'
  return 'justify-center'
}

const sameHole = (a: Hole, b: Hole) =>
  a.left === b.left && a.top === b.top && a.width === b.width && a.height === b.height

const stopClick = (e: MouseEvent) => e.stopPropagation()

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

  // 단계마다 넘기기 버튼에 포커스를 둬서 키보드로 이어서 넘길 수 있게 한다
  useEffect(() => {
    nextRef.current?.focus()
  }, [step])

  // 대상은 카메라 이동과 화면 크기 변화로 움직여서 매 프레임 실제 위치를 잰다
  useEffect(() => {
    let frame = 0
    const measure = () => {
      const container = containerRef.current
      const found = container
        ? [...container.querySelectorAll(`[data-guide="${targetName}"]`)]
            .map((el) => el.getBoundingClientRect())
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

  // Enter와 Space로 다음 단계로 넘기고 Esc로 건너뛴다. 카드 안에 포커스가 있으면 버튼이 맡는다
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
        layout
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
          <div className="flex items-center justify-between">
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
