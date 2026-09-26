import { darken } from '@/components/board/shade'

const Logo = () => {
  return (
    <h1
      className="flex items-center text-6xl font-light tracking-tight sm:text-8xl"
      aria-label="Cubound"
    >
      Cub
      {/* items-center는 위로 솟는 글자까지 포함해 맞춘다. 소문자 몸통 가운데로 내려 준다 */}
      <svg
        viewBox="0 0 60 30"
        className="mx-[0.04em] h-[0.34em] w-[0.68em] translate-y-[0.11em]"
        aria-hidden
      >
        <polygon points="30,0 60,15 30,30 0,15" style={{ fill: 'var(--color-goal)' }} />
        <polygon points="30,7 45,15 30,23 15,15" style={{ fill: darken('goal', 36) }} />
      </svg>
      und
    </h1>
  )
}

export default Logo
