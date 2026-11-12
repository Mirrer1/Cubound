import { shade } from '@/components/board/view'
import StarIcon from '@/components/ui/icons/StarIcon'
import type { ChapterState } from '@/stages'

interface ChapterCardProps {
  chapter: number
  name: string // 준비 중인 장은 빈 글자
  stars: number
  total: number
  state: ChapterState
  soonText: string
  guide?: string // 스텝 가이드가 비추는 data-guide 이름
  onSelect: () => void
}

const LABELS: Record<ChapterState, string> = {
  soon: '',
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

// 세로 화면은 그림이 왼쪽에 선 가로 카드, 가로 화면과 태블릿 세로는 그림이 위에 선 세로 카드
const ChapterCard = ({
  chapter,
  name,
  stars,
  total,
  state,
  soonText,
  guide,
  onSelect,
}: ChapterCardProps) => {
  const locked = state === 'locked'
  const soon = state === 'soon'
  const blur = soon ? 'blur-[3px]' : ''
  const cube = cubeFaces(chapter)

  return (
    <button
      type="button"
      data-chapter={chapter}
      data-guide={guide}
      disabled={locked}
      onClick={onSelect}
      className={`relative flex cursor-pointer items-center gap-4 overflow-hidden rounded-[1.25rem] border px-2 py-3 text-left transition-soft-colors disabled:cursor-default max-[390px]:gap-3 landscape:flex-col landscape:items-stretch landscape:gap-3 short:p-2.5 landscape:wide:p-5 landscape:wide:@max-[65.5rem]:p-3! phone-wide:justify-center pad-tall:flex-col pad-tall:items-stretch pad-tall:gap-2 pad-tall:p-2.5 pad-tall:max-[60rem]:gap-1.5 pad-tall:max-[60rem]:p-2 pad-wide:gap-2! pad-wide:p-3.5! laptop:gap-2! laptop:p-3.5! ${
        locked
          ? 'border-line bg-locked text-faint'
          : `bg-surface ${soon ? 'border-line' : 'hover:bg-[color-mix(in_srgb,var(--chapter-win)_45%,var(--color-surface))]'} ${state === 'now' ? 'border-[color-mix(in_srgb,var(--chapter-win),var(--color-ink)_30%)]' : soon ? '' : 'border-line-strong'}`
      }`}
    >
      <span
        className={`flex h-22 w-24 shrink-0 items-center justify-center overflow-hidden rounded-[0.6875rem] bg-(--chapter-win) max-[390px]:size-18 landscape:h-auto landscape:min-h-0 landscape:w-full landscape:flex-1 landscape:rounded-[0.8125rem] portrait:short:h-15 portrait:short:w-20 phone-wide:hidden pad-tall:h-auto pad-tall:min-h-0 pad-tall:w-full pad-tall:flex-1 pad-tall:rounded-[0.8125rem] ${blur}`}
        style={{ opacity: locked ? 0.45 : 1 }}
      >
        <svg
          viewBox={VIEW}
          className="w-full landscape:h-[92%] landscape:w-[92%] pad-tall:h-[92%] pad-tall:w-[92%]"
          aria-hidden="true"
        >
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
        className={`flex min-w-0 flex-1 flex-col gap-1.5 landscape:flex-none short:gap-1 landscape:wide:gap-2.5 pad-tall:flex-none pad-tall:gap-1 pad-wide:gap-1.5! laptop:gap-1.5! ${blur}`}
      >
        <span className="flex items-baseline justify-between gap-2 font-mono text-label tracking-[0.12em] whitespace-nowrap max-[390px]:gap-1 landscape:tracking-[0.22em] landscape:@max-[65.5rem]:text-[0.6875rem]! landscape:@max-[65.5rem]:tracking-[0.08em]! short:gap-1 short:tracking-[0.04em] pad-tall:gap-1 pad-tall:text-[0.6875rem] pad-tall:tracking-[0.12em] pad-tall:max-[60rem]:text-[0.59375rem] pad-tall:max-[60rem]:tracking-[0.08em] pad-wide:text-[0.65625rem]!">
          <span className={locked ? '' : 'text-mute'}>CHAPTER {chapter}</span>
          <span className={locked ? '' : `text-mute ${state === 'now' ? 'font-bold' : ''}`}>
            {LABELS[state]}
          </span>
        </span>
        {soon ? (
          <span className="flex h-7 items-center landscape:h-[1.875rem]">
            <span className="block h-3.5 w-[62%] rounded-full bg-line" />
          </span>
        ) : (
          <span className="truncate text-xl tracking-tight short:text-lg landscape:wide:text-[1.375rem] phone-wide:text-base! pad-tall:text-lg pad-tall:max-[60rem]:text-[0.90625rem] pad-wide:text-[1.0625rem]! laptop:text-lg!">
            {name}
          </span>
        )}
        <span className="flex items-center gap-2">
          <span className="h-[3px] flex-1 overflow-hidden rounded-full bg-line landscape:h-[5px]">
            <span
              className="block h-full rounded-full bg-ink transition-soft-colors"
              style={{ width: `${total === 0 ? 0 : Math.round((stars / total) * 100)}%` }}
            />
          </span>
          <span className="font-mono text-label whitespace-nowrap text-mute phone-wide:hidden pad-tall:text-[0.6875rem] pad-tall:max-[60rem]:text-[0.59375rem] pad-wide:text-[0.6875rem]">
            {stars} / {total} <StarIcon className="inline-block size-[1em] align-[-0.1em]" />
          </span>
        </span>
      </span>
      {soon && (
        <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-surface/50">
          <span className="font-mono text-label tracking-[0.24em] whitespace-nowrap">
            COMING SOON
          </span>
          <span className="text-[0.9375rem] whitespace-nowrap text-mute short:text-[0.875rem]">
            {soonText}
          </span>
        </span>
      )}
    </button>
  )
}

export default ChapterCard
