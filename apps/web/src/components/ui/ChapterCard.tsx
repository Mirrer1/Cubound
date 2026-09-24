import { shade } from '@/components/board/shade'

export type ChapterCardState = 'locked' | 'open' | 'now'

interface ChapterCardProps {
  chapter: number
  name: string
  range: string // "1–50"
  stars: number
  total: number
  worlds: number[] // 월드마다 모은 별 비율 0~1
  state: ChapterCardState
  onSelect: () => void
}

const LABELS: Record<ChapterCardState, string> = {
  locked: 'LOCKED',
  open: '',
  now: 'NOW',
}

// 그 장의 세계 색으로 칠한 작은 아이소메트릭 조각. 칸 넷이 체크무늬로 놓인다
const PATCH = [
  [0, 0],
  [1, 0],
  [0, 1],
  [1, 1],
] as const

const diamond = (tx: number, ty: number) => {
  const x = (tx - ty) * 26 + 52
  const y = (tx + ty) * 13 + 13
  return `${x},${y - 13} ${x + 26},${y} ${x},${y + 13} ${x - 26},${y}`
}

// 조각 위에 올라선 큐브. 칸 색 둘이 거의 같아서 여기가 눈이 멈추는 자리가 된다
const CUBE = { half: 15, lift: 15 }
const CX = 52
const CY = 39 - CUBE.lift

const ChapterCard = ({
  chapter,
  name,
  range,
  stars,
  total,
  worlds,
  state,
  onSelect,
}: ChapterCardProps) => {
  const locked = state === 'locked'

  return (
    <button
      type="button"
      data-chapter={chapter}
      disabled={locked}
      onClick={onSelect}
      className={`flex cursor-pointer items-center gap-4 rounded-[20px] border p-4 text-left transition-soft-colors disabled:cursor-default wide:flex-col wide:items-stretch wide:gap-3 wide:p-5 ${
        locked
          ? 'border-line bg-locked text-faint'
          : `bg-surface hover:bg-hover ${state === 'now' ? 'border-ink' : 'border-line-strong'}`
      }`}
    >
      <span
        className="flex h-15 w-15 shrink-0 items-center justify-center overflow-hidden rounded-[11px] bg-(--chapter-win) wide:h-[118px] wide:w-full wide:rounded-[13px]"
        style={{ opacity: locked ? 0.45 : 1 }}
      >
        <svg viewBox="0 0 104 52" className="w-[78%]" aria-hidden="true">
          {PATCH.map(([tx, ty]) => (
            <polygon
              key={`${tx}-${ty}`}
              points={diamond(tx, ty)}
              fill={(tx + ty) % 2 === 0 ? 'var(--chapter-a)' : 'var(--chapter-b)'}
            />
          ))}
          <polygon
            points={`${CX},${CY - 7.5} ${CX + CUBE.half},${CY} ${CX},${CY + 7.5} ${CX - CUBE.half},${CY}`}
            fill={shade('player', 'top')}
          />
          <polygon
            points={`${CX - CUBE.half},${CY} ${CX},${CY + 7.5} ${CX},${CY + 7.5 + CUBE.lift} ${CX - CUBE.half},${CY + CUBE.lift}`}
            fill={shade('player', 'left')}
          />
          <polygon
            points={`${CX},${CY + 7.5} ${CX + CUBE.half},${CY} ${CX + CUBE.half},${CY + CUBE.lift} ${CX},${CY + 7.5 + CUBE.lift}`}
            fill={shade('player', 'right')}
          />
        </svg>
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1.5 wide:gap-2.5">
        <span className="flex items-baseline justify-between gap-2 font-mono text-[10px] tracking-[0.18em] wide:text-[11px] wide:tracking-[0.22em]">
          <span className={locked ? '' : 'text-mute'}>
            CHAPTER {chapter} · {range}
          </span>
          <span className={locked ? '' : 'text-faint'}>{LABELS[state]}</span>
        </span>
        <span className="truncate text-lg tracking-tight wide:text-[22px]">{name}</span>
        <span className="flex items-center gap-2">
          <span className="flex flex-1 gap-[3px] wide:gap-1">
            {worlds.map((ratio, i) => (
              <span
                key={i}
                className="h-[3px] flex-1 overflow-hidden rounded-full bg-line wide:h-[5px]"
              >
                <span
                  className="block h-full rounded-full bg-ink transition-soft-colors"
                  style={{ width: `${Math.round(ratio * 100)}%` }}
                />
              </span>
            ))}
          </span>
          <span className="font-mono text-[10px] whitespace-nowrap text-faint wide:text-[11px]">
            {stars} / {total} ◆
          </span>
        </span>
      </span>
    </button>
  )
}

export default ChapterCard
