import { motion, useReducedMotion } from 'motion/react'
import { type MouseEvent, type RefObject, useEffect, useState } from 'react'

import { guideText } from './guideTexts'
import Button from '@/components/ui/Button'
import type { Guide } from '@/game/types'
import { isTouchDevice } from '@/platform/input'

interface GuideOverlayProps {
  guides: Guide[]
  step: number
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

const ELEMENT_PADDING = 8

const sameHole = (a: Hole, b: Hole) =>
  a.left === b.left && a.top === b.top && a.width === b.width && a.height === b.height

const stopClick = (e: MouseEvent) => e.stopPropagation()

const GuideOverlay = ({ guides, step, containerRef, onNext, onSkip }: GuideOverlayProps) => {
  const [measured, setMeasured] = useState<{ hole: Hole; cardOnTop: boolean } | null>(null)
  const reduced = useReducedMotion()
  const guide = guides[step]
  const targetName = typeof guide.target === 'string' ? guide.target : 'cell'
  const isLast = step === guides.length - 1
  const hole = measured?.hole
  const cardOnTop = measured?.cardOnTop ?? false
  const speed = reduced ? 0.35 : 1

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
        const onTop = next.top > base.height - next.top - next.height
        setMeasured((prev) =>
          prev && sameHole(prev.hole, next) && prev.cardOnTop === onTop
            ? prev
            : { hole: next, cardOnTop: onTop },
        )
      }
      frame = requestAnimationFrame(measure)
    }
    frame = requestAnimationFrame(measure)
    return () => cancelAnimationFrame(frame)
  }, [containerRef, targetName])

  // Enter와 Space로 다음 단계로 넘긴다
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' && e.key !== ' ') return
      e.preventDefault()
      if (!e.repeat) onNext()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onNext])

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
        className={`absolute inset-x-4 flex justify-center ${cardOnTop ? 'top-4 sm:top-8' : 'bottom-4 sm:bottom-8'}`}
        transition={{ duration: 0.35 * speed, ease: 'easeInOut' }}
      >
        <motion.div
          className="flex w-full max-w-[420px] cursor-default flex-col gap-4 rounded-[22px] border border-line bg-base-bg p-6 shadow-[0_20px_60px_-20px_rgb(0_0_0/0.18)]"
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
            className="min-h-14 text-lg leading-snug break-keep"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.25 * speed }}
          >
            {guideText(guide.id, isTouchDevice())}
          </motion.p>
          <div className="flex items-center justify-between">
            <button
              type="button"
              className="-ml-2 cursor-pointer rounded-lg px-2 py-1 text-sm text-mute transition-soft hover:bg-hover"
              onClick={onSkip}
            >
              건너뛰기
            </button>
            {isLast ? (
              <Button variant="primary" onClick={onNext}>
                시작
              </Button>
            ) : (
              <Button variant="icon" onClick={onNext} title="다음">
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
