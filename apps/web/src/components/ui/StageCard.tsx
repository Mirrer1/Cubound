import Stars from './Stars'

export type StageCardState = 'locked' | 'open' | 'cleared'

interface StageCardProps {
  number: number
  state: StageCardState
  stars: number
  boss: boolean
  bestMoves?: number // 깨지 않은 판은 빈 값
  guide?: string // 스텝 가이드가 비추는 data-guide 이름
  starsGuide?: string // 별 줄에 붙는 data-guide 이름
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

const StageCard = ({
  number,
  state,
  stars,
  boss,
  bestMoves,
  guide,
  starsGuide,
  onSelect,
}: StageCardProps) => {
  const locked = state === 'locked'
  const tone = boss ? 'border-ink bg-ink text-base-bg' : TONES[state]
  // 금색은 보스, 잠긴 보통 카드는 카드 전체 색
  const labelTone = boss ? 'text-tool' : locked ? '' : 'text-mute'

  return (
    <div className="@container phone-wide:h-full">
      <button
        type="button"
        data-guide={guide}
        disabled={locked}
        onClick={onSelect}
        className={`flex aspect-square w-full cursor-pointer flex-col justify-between rounded-[1.125rem] border p-4 text-left transition-soft-colors disabled:cursor-default short:p-2 wide:p-5 phone-wide:aspect-auto phone-wide:h-full pad-tall:aspect-[5/6] pad-tall:p-3 pad-tall:max-[60rem]:aspect-[3/4] monitor:aspect-[8/9] ${tone} ${locked ? '' : boss ? 'hover:bg-ink/90' : 'hover:bg-hover'}`}
      >
        <span className="flex justify-between gap-2 font-mono text-[0.6875rem] tracking-[0.2em] short:text-[0.5625rem] pad-tall:text-[clamp(0.5625rem,6.6cqi,0.6875rem)] monitor:text-[0.75rem]">
          <span className={`${labelTone} ${state === 'cleared' ? 'font-bold' : ''}`}>
            {LABELS[state]}
          </span>
          {/* 라벨이 들어갈 자리가 있을 때만 보이는 기록, 작은 카드에 숫자만 남으면 뜻이 안 읽히는 탓 */}
          {bestMoves !== undefined && (
            <span className={`hidden monitor:inline ${boss ? 'text-base-bg/60' : 'text-mute'}`}>
              MOVES<span className="ml-1">{String(bestMoves).padStart(2, '0')}</span>
            </span>
          )}
        </span>
        <span className="flex items-center justify-center">
          <span
            className={`text-4xl font-light short:text-3xl wide:text-5xl pad-tall:text-[26cqi]! monitor:text-[26cqi]/none! ${locked && !boss ? 'text-faint' : ''}`}
          >
            {String(number).padStart(2, '0')}
          </span>
        </span>
        <span className="flex justify-center">
          <Stars
            count={stars}
            tone={boss ? 'dark' : 'light'}
            guide={starsGuide}
            className="short:text-[0.5625rem] pad-tall:text-[clamp(0.625rem,7.2cqi,0.75rem)] monitor:text-[0.9375rem]"
          />
        </span>
      </button>
    </div>
  )
}

export default StageCard
