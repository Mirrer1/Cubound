import { useText } from '@/i18n/useText'

interface StarsProps {
  count: number
  size?: number // 넘기지 않으면 className의 글자 크기를 따른다
  tone?: 'light' | 'dark'
  className?: string
}

const Stars = ({ count, size, tone = 'light', className = '' }: StarsProps) => {
  const t = useText()
  const filled = tone === 'light' ? 'var(--color-ink)' : 'var(--color-base-bg)'
  const empty = tone === 'light' ? 'var(--color-line-strong)' : 'var(--color-mute)'

  return (
    <span
      className={`flex items-center gap-[0.4em] text-[12px] ${className}`}
      style={size === undefined ? undefined : { fontSize: size }}
      aria-label={t('stars.label', count)}
    >
      {[0, 1, 2].map((i) => (
        <svg key={i} viewBox="0 0 10 10" className="size-[1em]">
          <polygon
            points="5,0.5 9.5,5 5,9.5 0.5,5"
            style={i < count ? { fill: filled } : { fill: 'none', stroke: empty, strokeWidth: 0.8 }}
          />
        </svg>
      ))}
    </span>
  )
}

export default Stars
