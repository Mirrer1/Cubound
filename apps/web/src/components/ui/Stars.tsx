import StarIcon from '@/components/ui/icons/StarIcon'
import { useText } from '@/hooks/useText'

interface StarsProps {
  count: number
  size?: number // 넘기지 않으면 className의 글자 크기
  tone?: 'light' | 'dark'
  className?: string
}

const Stars = ({ count, size, tone = 'light', className = '' }: StarsProps) => {
  const t = useText()
  const filled = tone === 'light' ? 'text-ink' : 'text-base-bg'
  const empty = tone === 'light' ? 'text-line-strong' : 'text-mute'

  return (
    <span
      className={`flex items-center gap-[0.4em] text-[0.75rem] ${className}`}
      style={size === undefined ? undefined : { fontSize: size }}
      aria-label={t('stars.label', count)}
    >
      {[0, 1, 2].map((i) => (
        <StarIcon
          key={i}
          empty={i >= count}
          className={`size-[1em] ${i < count ? filled : empty}`}
        />
      ))}
    </span>
  )
}

export default Stars
