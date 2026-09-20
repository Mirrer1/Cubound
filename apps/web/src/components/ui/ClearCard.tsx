import { motion } from 'motion/react'
import { useEffect, useRef } from 'react'

import Button from './Button'
import Stars from './Stars'
import { useFocusTrap } from './useFocusTrap'
import { useText } from '@/i18n/useText'

interface ClearCardProps {
  stageNumber: number
  moves: number
  stars: number
  onNext?: () => void
  onRetry: () => void
  onSelect: () => void
}

const ClearCard = ({ stageNumber, moves, stars, onNext, onRetry, onSelect }: ClearCardProps) => {
  const cardRef = useRef<HTMLDivElement>(null)
  const firstRef = useRef<HTMLButtonElement>(null)
  const t = useText()

  useFocusTrap(cardRef)

  // Enter로 바로 다음 스테이지에 갈 수 있게 포커스를 옮긴다
  useEffect(() => {
    firstRef.current?.focus()
  }, [])

  return (
    <motion.div
      className="absolute inset-0 flex items-end justify-center bg-base-bg/40 backdrop-blur-[2px] short:items-center short:justify-end short:p-4 wide:items-center narrow:items-center narrow:p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.2 } }}
      transition={{ duration: 0.35, delay: 1.3 }}
    >
      <motion.div
        ref={cardRef}
        className="flex w-full flex-col items-center gap-5 rounded-t-[22px] border border-line bg-base-bg p-7 shadow-[0_20px_60px_-20px_rgb(0_0_0/0.18)] short:w-[320px] short:gap-3 short:rounded-[22px] short:p-5 wide:w-[440px] wide:rounded-[22px] wide:p-9 narrow:max-w-[320px] narrow:gap-4 narrow:rounded-[22px] narrow:p-5"
        initial={{ y: 12, scale: 0.98 }}
        animate={{ y: 0, scale: 1 }}
        transition={{ duration: 0.4, delay: 1.3, ease: 'easeOut' }}
      >
        <span className="font-mono text-[11px] tracking-[0.22em] text-mute">
          STAGE {String(stageNumber).padStart(2, '0')} · CLEAR
        </span>
        <Stars count={stars} size={26} />
        <span className="flex items-baseline gap-2">
          <span className="text-5xl font-light tabular-nums short:text-4xl">{moves}</span>
          <span className="font-mono text-[11px] tracking-[0.22em] text-mute">MOVES</span>
        </span>
        <div className="flex w-full flex-col gap-3">
          {onNext && (
            <Button ref={firstRef} variant="primary" className="w-full" onClick={onNext}>
              {t('clear.next')}
            </Button>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Button ref={onNext ? undefined : firstRef} onClick={onRetry}>
              {t('clear.retry')}
            </Button>
            <Button onClick={onSelect}>{t('clear.select')}</Button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

export default ClearCard
