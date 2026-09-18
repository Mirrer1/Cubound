import { motion } from 'motion/react'

import Stars from './Stars'

export type StageCardState = 'locked' | 'open' | 'cleared'

interface StageCardProps {
  number: number
  state: StageCardState
  stars: number
  boss: boolean
  bossHint?: string
  index: number
  onSelect: () => void
}

const LABELS: Record<StageCardState, string> = {
  locked: 'LOCKED',
  open: 'NOW',
  cleared: 'CLEAR',
}

const TONES: Record<StageCardState, string> = {
  locked: 'border-line bg-locked text-faint',
  open: 'border-ink bg-surface',
  cleared: 'border-line-strong bg-surface',
}

const StageCard = ({ number, state, stars, boss, bossHint, index, onSelect }: StageCardProps) => {
  const locked = state === 'locked'
  const tone = boss ? 'border-ink bg-ink text-base-bg' : TONES[state]

  return (
    <motion.button
      type="button"
      disabled={locked}
      onClick={onSelect}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.04 }}
      className={`@container flex cursor-pointer flex-col justify-between rounded-[18px] border p-4 text-left transition-soft-colors disabled:cursor-default sm:aspect-square sm:p-5 ${tone} ${boss ? 'col-span-2 sm:col-span-1' : 'aspect-[3/2]'} ${locked ? '' : boss ? 'hover:bg-ink/90' : 'hover:bg-hover'}`}
    >
      <span className="flex justify-between gap-2 font-mono text-[11px] tracking-[0.2em]">
        {boss ? (
          <span className="text-tool">BOSS</span>
        ) : (
          <span className={locked ? '' : 'text-mute'}>{LABELS[state]}</span>
        )}
        {boss && (
          <span className={`@max-[6.25rem]:hidden ${locked ? 'text-mute' : 'text-faint'}`}>
            {LABELS[state]}
          </span>
        )}
      </span>
      <span className="flex items-center justify-center gap-4 sm:flex-col">
        <span className={`text-4xl font-light sm:text-5xl ${locked && !boss ? 'text-faint' : ''}`}>
          {String(number).padStart(2, '0')}
        </span>
        {boss && bossHint && <span className="text-sm sm:hidden">{bossHint}</span>}
      </span>
      <span className="flex justify-center">
        <Stars count={stars} tone={boss ? 'dark' : 'light'} />
      </span>
    </motion.button>
  )
}

export default StageCard
