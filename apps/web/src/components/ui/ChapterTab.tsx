import { motion } from 'motion/react'

import TriangleIcon from '@/components/ui/icons/TriangleIcon'

interface ChapterTabProps {
  chapter: number
  world: number
  name: string
  open: boolean // 장 고르기가 펼쳐져 있는 상태
  label: string
  className?: string
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
  onClick,
}: ChapterTabProps) => {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-expanded={open}
      className={`flex cursor-pointer flex-col rounded-[1.125rem] p-1 pt-0 text-left transition-soft active:translate-y-[2px] short:flex-row short:items-stretch short:pt-1 ${
        open ? 'bg-ink' : 'bg-line hover:bg-line-strong'
      } ${className}`}
    >
      <span
        className={`flex h-7 items-center justify-between gap-6 px-2.5 pt-0.5 font-mono text-[0.6875rem] font-bold tracking-[0.2em] transition-soft-colors min-[1700px]:h-8.5 min-[1700px]:px-3 min-[1700px]:text-[0.75rem] min-[1700px]:tracking-[0.22em] short:h-auto short:gap-2 short:pt-0 short:pr-3 narrow:h-6.5 narrow:px-2 narrow:pt-1 ${
          open ? 'text-base-bg' : 'text-mute'
        }`}
      >
        CHAPTER {chapter}
        {/* 색이 바뀌는 시간과 곡선 맞춤, transition-soft는 transform만 120ms인 탓 */}
        <motion.span
          className="text-[0.5625rem] min-[1700px]:text-[0.625rem]"
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2, ease: [0.37, 0, 0.63, 1] }}
          aria-hidden="true"
        >
          <TriangleIcon className="block h-[0.56em] w-[1em]" />
        </motion.span>
      </span>
      <span className="flex min-w-0 flex-col gap-0.5 rounded-[0.9375rem] border border-line-strong bg-surface px-3 py-2 min-[1700px]:gap-1.5 min-[1700px]:px-5 min-[1700px]:py-4 short:min-w-0 short:flex-1 short:flex-row short:items-center short:gap-2 short:py-1.5 narrow:gap-0 narrow:px-2.5 narrow:pt-2 narrow:pb-1.5">
        <span className="font-mono text-[0.6875rem] tracking-[0.2em] text-mute min-[1700px]:text-[0.75rem] min-[1700px]:tracking-[0.22em]">
          WORLD {world}
        </span>
        <span className="truncate text-xl tracking-tight min-[1700px]:text-[2rem]/[1.15]! min-[1700px]:whitespace-normal short:text-lg wide:text-2xl narrow:text-lg">
          {name}
        </span>
      </span>
    </button>
  )
}

export default ChapterTab
