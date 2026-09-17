interface StarsProps {
  count: number
  size?: number
  tone?: 'light' | 'dark'
}

const Stars = ({ count, size = 12, tone = 'light' }: StarsProps) => {
  const filled = tone === 'light' ? 'var(--color-ink)' : 'var(--color-base-bg)'
  const empty = tone === 'light' ? 'var(--color-line-strong)' : 'var(--color-mute)'

  return (
    <span
      className="flex items-center gap-[0.4em]"
      style={{ fontSize: size }}
      aria-label={`별 ${count}개`}
    >
      {[0, 1, 2].map((i) => (
        <svg key={i} viewBox="0 0 10 10" width={size} height={size}>
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
