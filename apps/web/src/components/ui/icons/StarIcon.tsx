interface StarIconProps {
  empty?: boolean // 테두리만 그린 빈 별
  className?: string
}

const StarIcon = ({ empty = false, className = 'size-[1em]' }: StarIconProps) => (
  <svg viewBox="0 0 10 10" className={className} aria-hidden>
    <polygon
      points="5,0.5 9.5,5 5,9.5 0.5,5"
      fill={empty ? 'none' : 'currentColor'}
      stroke={empty ? 'currentColor' : undefined}
      strokeWidth={empty ? 0.8 : undefined}
    />
  </svg>
)

export default StarIcon
