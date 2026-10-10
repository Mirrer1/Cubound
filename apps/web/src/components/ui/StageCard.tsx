import Stars from './Stars'

export type StageCardState = 'locked' | 'open' | 'cleared'

interface StageCardProps {
  number: number
  state: StageCardState
  stars: number
  boss: boolean
  bestMoves?: number // 깨지 않은 판은 빈 값
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

const StageCard = ({ number, state, stars, boss, bestMoves, onSelect }: StageCardProps) => {
  const locked = state === 'locked'
  const tone = boss ? 'border-ink bg-ink text-base-bg' : TONES[state]
  // 금색은 보스, 잠긴 보통 카드는 카드 전체 색
  const labelTone = boss ? 'text-tool' : locked ? '' : 'text-mute'

  return (
    <div className="@container">
      <button
        type="button"
        disabled={locked}
        onClick={onSelect}
        className={`flex aspect-square w-full cursor-pointer flex-col justify-between rounded-[1.125rem] border p-4 text-left transition-soft-colors disabled:cursor-default short:p-2 wide:p-5 tablet:portrait:p-3 ${tone} ${locked ? '' : boss ? 'hover:bg-ink/90' : 'hover:bg-hover'}`}
      >
        <span className="flex justify-between gap-2 font-mono text-[0.6875rem] tracking-[0.2em] min-[1700px]:text-[0.75rem] short:text-[0.5625rem]">
          <span className={`${labelTone} ${state === 'cleared' ? 'font-bold' : ''}`}>
            {LABELS[state]}
          </span>
          {/* 라벨이 들어갈 자리가 있을 때만 보이는 기록, 작은 카드에 숫자만 남으면 뜻이 안 읽히는 탓 */}
          {bestMoves !== undefined && (
            <span
              className={`hidden min-[1700px]:inline ${boss ? 'text-base-bg/60' : 'text-mute'}`}
            >
              MOVES<span className="ml-1">{String(bestMoves).padStart(2, '0')}</span>
            </span>
          )}
        </span>
        <span className="flex items-center justify-center">
          <span
            className={`text-4xl font-light min-[1700px]:text-[26cqi]/none! short:text-3xl wide:text-5xl tablet:portrait:text-[26cqi]! ${locked && !boss ? 'text-faint' : ''}`}
          >
            {String(number).padStart(2, '0')}
          </span>
        </span>
        <span className="flex justify-center">
          <Stars
            count={stars}
            tone={boss ? 'dark' : 'light'}
            className="min-[1700px]:text-[0.9375rem] short:text-[0.5625rem]"
          />
        </span>
      </button>
    </div>
  )
}

export default StageCard
