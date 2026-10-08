import { shade } from '@/components/board/view'

export type ChapterCardState = 'locked' | 'open' | 'now'

interface ChapterCardProps {
  chapter: number
  name: string
  range: string // "1–50"
  stars: number
  total: number
  state: ChapterCardState
  many: boolean // 장이 넷 이상인 장 고르기, 남은 높이에 맞춰 줄이는 카드
  onSelect: () => void
}

const LABELS: Record<ChapterCardState, string> = {
  locked: 'LOCKED',
  open: '',
  now: 'NOW',
}

// 그 장의 세계 색으로 칠한 체크무늬 바닥, 4×4 마름모에서 위아래 모서리 세 칸씩 뺀 모양
const FLOOR = { size: 4, half: 26, flat: 13 }
const CORNERS = ['0,0', '1,0', '0,1', '3,3', '2,3', '3,2']
const PATCH = Array.from({ length: FLOOR.size ** 2 }, (_, i) => [
  i % FLOOR.size,
  Math.floor(i / FLOOR.size),
]).filter(([tx, ty]) => !CORNERS.includes(`${tx},${ty}`))

// 체크무늬 밝은 칸, 바닥이 창 색과 갈리는 대비
const LIGHT = 'color-mix(in srgb, var(--chapter-a), white 45%)'

// 장마다 큐브가 올라선 칸
const SPOTS = [
  [1, 2],
  [2, 0],
  [3, 1],
  [1, 3],
  [2, 2],
  [1, 1],
  [3, 0],
  [2, 1],
]

const CUBE = { half: 17, lift: 17 }

const center = (tx: number, ty: number) => ({
  x: (tx - ty) * FLOOR.half,
  y: (tx + ty) * FLOOR.flat,
})

// 바닥이 위아래 가운데에 오는 그림 틀, 큐브 높이만큼 위아래 같은 여백
const VIEW = (() => {
  const xs = PATCH.map(([tx, ty]) => center(tx, ty).x)
  const ys = PATCH.map(([tx, ty]) => center(tx, ty).y)
  const pad = CUBE.lift + 4
  const left = Math.min(...xs) - FLOOR.half
  const top = Math.min(...ys) - FLOOR.flat - pad
  const width = Math.max(...xs) + FLOOR.half - left
  const height = Math.max(...ys) + FLOOR.flat + pad - top
  return `${left} ${top} ${width} ${height}`
})()

const diamond = (tx: number, ty: number) => {
  const { x, y } = center(tx, ty)
  return `${x},${y - FLOOR.flat} ${x + FLOOR.half},${y} ${x},${y + FLOOR.flat} ${x - FLOOR.half},${y}`
}

const cubeFaces = (chapter: number) => {
  const [tx, ty] = SPOTS[(chapter - 1) % SPOTS.length]
  const { x, y: floor } = center(tx, ty)
  const h = CUBE.half
  const v = (h * FLOOR.flat) / FLOOR.half
  const y = floor - CUBE.lift
  return {
    top: `${x},${y - v} ${x + h},${y} ${x},${y + v} ${x - h},${y}`,
    left: `${x - h},${y} ${x},${y + v} ${x},${y + v + CUBE.lift} ${x - h},${y + CUBE.lift}`,
    right: `${x},${y + v} ${x + h},${y} ${x + h},${y + CUBE.lift} ${x},${y + v + CUBE.lift}`,
  }
}

const ChapterCard = ({
  chapter,
  name,
  range,
  stars,
  total,
  state,
  many,
  onSelect,
}: ChapterCardProps) => {
  const locked = state === 'locked'
  const cube = cubeFaces(chapter)

  return (
    <button
      type="button"
      data-chapter={chapter}
      disabled={locked}
      onClick={onSelect}
      className={`flex cursor-pointer items-center gap-4 rounded-[20px] border ${many ? 'p-2 max-[390px]:gap-3 short:p-2.5 wide:p-2.5' : 'p-4'} text-left transition-soft-colors disabled:cursor-default roomy:flex-col roomy:items-stretch roomy:gap-3 roomy:p-5 ${
        locked
          ? 'border-line bg-locked text-faint'
          : `bg-surface hover:bg-hover ${state === 'now' ? 'border-ink' : 'border-line-strong'}`
      }`}
    >
      <span
        className={`flex h-15 w-15 shrink-0 items-center justify-center overflow-hidden rounded-[11px] bg-(--chapter-win) min-[390px]:w-20 min-[1700px]:aspect-auto! min-[1700px]:min-h-25 min-[1700px]:flex-1 ${many ? 'max-[390px]:size-12 roomy:min-h-0 roomy:flex-1' : 'roomy:aspect-2/1'} roomy:h-auto roomy:w-full roomy:rounded-[13px]`}
        style={{ opacity: locked ? 0.45 : 1 }}
      >
        <svg viewBox={VIEW} className="w-full roomy:h-[92%] roomy:w-[92%]" aria-hidden="true">
          {PATCH.map(([tx, ty]) => (
            <polygon
              key={`${tx}-${ty}`}
              points={diamond(tx, ty)}
              fill={(tx + ty) % 2 === 0 ? 'var(--chapter-a)' : LIGHT}
            />
          ))}
          <polygon points={cube.top} fill={shade('player', 'top')} />
          <polygon points={cube.left} fill={shade('player', 'left')} />
          <polygon points={cube.right} fill={shade('player', 'right')} />
        </svg>
      </span>
      <span
        className={`flex min-w-0 flex-1 flex-col ${many ? 'gap-px short:gap-1 wide:gap-1 roomy:flex-none' : 'gap-1.5'} min-[1700px]:flex-none roomy:gap-2.5`}
      >
        <span
          className={
            many
              ? 'flex items-baseline justify-between gap-2 font-mono text-[10px] tracking-[0.18em] max-[390px]:gap-1 max-[390px]:tracking-[0.12em] roomy:text-[11px] roomy:tracking-[0.22em]'
              : 'flex items-baseline justify-between gap-2 font-mono text-[10px] tracking-[0.18em] roomy:text-[11px] roomy:tracking-[0.22em]'
          }
        >
          <span className={locked ? '' : 'text-mute'}>
            CHAPTER {chapter} · {range}
          </span>
          <span className={locked ? '' : 'text-faint'}>{LABELS[state]}</span>
        </span>
        <span className="truncate text-lg tracking-tight roomy:text-[22px]">{name}</span>
        <span className="flex items-center gap-2">
          <span className="h-[3px] flex-1 overflow-hidden rounded-full bg-line roomy:h-[5px]">
            <span
              className="block h-full rounded-full bg-ink transition-soft-colors"
              style={{ width: `${total === 0 ? 0 : Math.round((stars / total) * 100)}%` }}
            />
          </span>
          <span className="font-mono text-[10px] whitespace-nowrap text-faint roomy:text-[11px]">
            {stars} / {total} ◆
          </span>
        </span>
      </span>
    </button>
  )
}

export default ChapterCard
