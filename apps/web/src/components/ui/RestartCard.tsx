import { motion } from 'motion/react'
import { useEffect, useRef } from 'react'

import Button from './Button'
import { useFocusTrap } from './useFocusTrap'
import { useText } from '@/i18n/useText'

interface RestartCardProps {
  onKeep: () => void
  onRestart: () => void
}

const RestartCard = ({ onKeep, onRestart }: RestartCardProps) => {
  const cardRef = useRef<HTMLDivElement>(null)
  const keepRef = useRef<HTMLButtonElement>(null)
  const t = useText()

  useFocusTrap(cardRef)

  // 빗맞아 연달아 눌러도 진행이 날아가지 않게 계속하기에 포커스를 둔다
  useEffect(() => {
    keepRef.current?.focus()
  }, [])

  return (
    <motion.div
      className="absolute inset-0 z-10 flex items-center justify-center bg-ink/25 p-4 backdrop-blur-[2px]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.15 } }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
    >
      <motion.div
        ref={cardRef}
        className="flex w-full max-w-[360px] flex-col gap-6 rounded-[22px] border border-line bg-base-bg p-7 shadow-[0_20px_60px_-20px_rgb(0_0_0/0.18)] short:gap-4 short:p-5"
        initial={{ y: 8, scale: 0.98 }}
        animate={{ y: 0, scale: 1 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
      >
        <p className="text-lg leading-snug break-keep">{t('play.restartAsk')}</p>
        <div className="grid grid-cols-2 gap-3">
          <Button ref={keepRef} strong onClick={onKeep}>
            {t('play.restartKeep')}
          </Button>
          <Button onClick={onRestart}>{t('play.restartGo')}</Button>
        </div>
      </motion.div>
    </motion.div>
  )
}

export default RestartCard
