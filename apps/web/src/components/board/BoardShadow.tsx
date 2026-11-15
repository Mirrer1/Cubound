import { SHIMMER_LOOP, bridgeFaces } from './view'
import { useLoop } from '@/hooks/useLoop'

interface BoardShadowProps {
  x: number
  y: number // 다리 윗면 높이의 칸 중심
  axis: 'x' | 'y'
  parity: boolean // 칸마다 번갈아 밝기를 바꾸는 자리
  shown: number // 진하기 0~1
  lit: number // 빛을 받은 몫 0~1, 윗면 밝기 최대 두 배
}

const BoardShadow = ({ x, y, axis, parity, shown, lit }: BoardShadowProps) => {
  const { top, side, glow } = bridgeFaces(x, y, axis)
  const shimmer = useLoop(SHIMMER_LOOP, 3000)

  return (
    <g opacity={shown}>
      {glow.map(({ points, opacity }) => (
        <polygon
          key={opacity}
          points={points}
          opacity={opacity}
          style={{ fill: 'var(--color-shadow-bridge)' }}
        />
      ))}
      <polygon points={side} opacity={0.3} style={{ fill: 'var(--color-shadow-bridge-side)' }} />
      <g ref={shimmer}>
        <polygon
          points={top}
          opacity={(parity ? 0.3 : 0.17) * (1 + lit)}
          style={{ fill: 'var(--color-shadow-bridge)' }}
        />
      </g>
    </g>
  )
}

export default BoardShadow
