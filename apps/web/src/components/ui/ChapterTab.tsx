import { motion } from 'motion/react'

interface ChapterTabProps {
  chapter: number
  world: number
  name: string
  open: boolean // 장 고르기가 펼쳐져 있는 상태
  label: string
  className?: string
  onClick: () => void
}

// 월드 카드 뒤에 장 판이 한 겹 더 보인다. 겹친 모양이 "이 월드는 저 장 안에 있다"를 말한다
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
      className={`flex cursor-pointer flex-col rounded-[18px] p-1 pt-0 text-left transition-soft active:translate-y-[2px] ${
        open ? 'bg-ink' : 'bg-line hover:bg-line-strong'
      } ${className}`}
    >
      <span
        className={`flex h-6.5 items-center justify-between gap-6 px-2.5 font-mono text-[10px] tracking-[0.2em] transition-soft-colors min-[1700px]:h-8 min-[1700px]:px-3 min-[1700px]:text-[11px] min-[1700px]:tracking-[0.22em] narrow:h-5.5 narrow:px-2 ${
          open ? 'text-base-bg' : 'text-mute'
        }`}
      >
        CHAPTER {chapter}
        {/* 색이 바뀌는 시간과 곡선을 맞춘다. transition-soft는 transform만 120ms라 따로 준다 */}
        <motion.span
          className="text-[9px] min-[1700px]:text-[10px]"
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2, ease: [0.37, 0, 0.63, 1] }}
          aria-hidden="true"
        >
          ▲
        </motion.span>
      </span>
      <span className="flex min-w-0 flex-col gap-0.5 rounded-[15px] border border-line-strong bg-surface px-3 py-2 min-[1700px]:gap-1.5 min-[1700px]:px-5 min-[1700px]:py-4 narrow:gap-0 narrow:px-2.5 narrow:py-1.5">
        <span className="font-mono text-[10px] tracking-[0.2em] text-mute min-[1700px]:text-[11px] min-[1700px]:tracking-[0.22em]">
          WORLD {world}
        </span>
        <span className="truncate text-xl tracking-tight min-[1700px]:text-[40px]/[1.15]! min-[1700px]:whitespace-normal wide:text-2xl narrow:text-lg">
          {name}
        </span>
      </span>
    </button>
  )
}

export default ChapterTab
