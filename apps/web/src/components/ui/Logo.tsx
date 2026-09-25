import { darken } from '@/components/board/shade'

const Logo = () => {
  return (
    <h1
      className="flex items-center text-6xl font-light tracking-tight sm:text-8xl"
      aria-label="Cubound"
    >
      Cub
      {/* 세로선이 아래로 뻗어 viewBox가 길어지므로 마름모가 글자 가운데에 남도록 내려 준다 */}
      <svg
        viewBox="0 0 60 54"
        className="mx-[0.04em] h-[0.61em] w-[0.68em] translate-y-[0.136em]"
        aria-hidden
      >
        <polygon points="30,0 60,15 30,30 0,15" style={{ fill: 'var(--color-goal)' }} />
        <polygon points="30,7 45,15 30,23 15,15" style={{ fill: darken('goal', 36) }} />
        <g stroke="var(--color-goal)" strokeWidth="2.5">
          <line x1="1.5" y1="15" x2="1.5" y2="37" />
          <line x1="58.5" y1="15" x2="58.5" y2="37" />
          {/* 마름모 끝점은 폭이 0이라 잘록해 보인다. 안쪽 넓은 자리에서부터 긋는다 */}
          <line x1="30" y1="25" x2="30" y2="52" />
        </g>
      </svg>
      und
    </h1>
  )
}

export default Logo
