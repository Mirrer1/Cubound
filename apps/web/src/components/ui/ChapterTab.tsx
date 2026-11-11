import { motion } from 'motion/react'

import TriangleIcon from '@/components/ui/icons/TriangleIcon'

interface ChapterTabProps {
  chapter: number
  world: number
  name: string
  open: boolean // 장 고르기가 펼쳐져 있는 상태
  label: string
  className?: string
  guide?: string // 스텝 가이드가 비추는 data-guide 이름
  onClick: () => void
}

// 월드 카드 뒤에 한 겹 더 보이는 장 판, "이 월드는 저 장 안"이라는 겹친 모양
const ChapterTab = ({
  chapter,
  world,
  name,
  open,
  label,
  className = '',
  guide,
  onClick,
}: ChapterTabProps) => {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-expanded={open}
      data-guide={guide}
      className={`flex min-w-0 cursor-pointer flex-col rounded-[1.125rem] p-1 pt-0 text-left transition-soft active:translate-y-[2px] short:flex-row short:items-stretch short:pt-1 pad-tall:flex-row pad-tall:items-stretch pad-tall:pt-1 pad-wide:flex-row pad-wide:items-stretch pad-wide:pt-1 laptop:flex-row laptop:items-stretch laptop:pt-1 ${
        open
          ? 'bg-ink'
          : 'bg-[color-mix(in_srgb,var(--color-locked),var(--color-line))] hover:bg-[color-mix(in_srgb,var(--color-locked)_20%,var(--color-line-strong))]'
      } ${className}`}
    >
      <span
        className={`flex h-7 items-center justify-between gap-6 px-2.5 pt-0.5 font-mono text-[0.6875rem] font-bold tracking-[0.2em] transition-soft-colors short:h-auto short:gap-2 short:pt-0 short:pr-3 narrow:h-7.5 narrow:px-2 narrow:pt-0 pad-tall:h-auto pad-tall:gap-2 pad-tall:pt-0 pad-tall:pr-3 pad-wide:h-auto pad-wide:gap-2 pad-wide:pt-0 pad-wide:pr-3 laptop:h-auto laptop:gap-2 laptop:pt-0 laptop:pr-3 monitor:h-8.5 monitor:px-3 monitor:text-[0.75rem] monitor:tracking-[0.22em] ${
          open ? 'text-base-bg' : 'text-mute'
        }`}
      >
        CHAPTER {chapter}
        {/* 색이 바뀌는 시간과 곡선 맞춤, transition-soft는 transform만 120ms인 탓 */}
        <motion.span
          className="text-[0.5625rem] monitor:text-[0.625rem]"
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2, ease: [0.37, 0, 0.63, 1] }}
          aria-hidden="true"
        >
          <TriangleIcon className="block h-[0.56em] w-[1em]" />
        </motion.span>
      </span>
      <span className="flex min-w-0 flex-col gap-0.5 rounded-[0.9375rem] border border-line-strong bg-surface px-3 py-2 short:min-w-0 short:flex-1 short:flex-row short:items-center short:gap-2 short:py-1.5 narrow:gap-0 narrow:px-2.5 narrow:pt-2 narrow:pb-1.5 phone-tall:flex-row phone-tall:items-baseline phone-tall:gap-2.5! phone-tall:py-2.5! phone-wide:py-0.5! pad-tall:flex-1 pad-tall:flex-row pad-tall:items-center pad-tall:gap-3.5! pad-tall:py-2! pad-tall:max-[60rem]:py-1! pad-wide:flex-1 pad-wide:flex-row pad-wide:items-center pad-wide:gap-3.5! pad-wide:py-1! laptop:flex-1 laptop:flex-row laptop:items-center laptop:gap-3.5! laptop:py-1! monitor:gap-1.5 monitor:px-5 monitor:py-4">
        <span className="font-mono text-[0.6875rem] tracking-[0.2em] text-mute monitor:text-[0.75rem] monitor:tracking-[0.22em]">
          WORLD {world}
        </span>
        <span className="truncate text-xl tracking-tight short:text-lg wide:text-2xl narrow:text-lg phone-wide:text-base! pad-tall:text-xl! pad-tall:max-[60rem]:text-lg! pad-wide:text-lg! laptop:text-lg! monitor:text-[1.75rem]/[1.15]! monitor:whitespace-normal">
          {name}
        </span>
      </span>
    </button>
  )
}

export default ChapterTab
