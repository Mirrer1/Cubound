import { SHIMMER_LOOP, bridgeFaces } from './view'
import { useLoop } from '@/hooks/useLoop'

interface BoardShadowProps {
  x: number
  y: number // 다리 윗면 높이의 칸 중심
  axis: 'x' | 'y'
  parity: boolean // 칸마다 번갈아 밝기를 바꾸는 자리
  shown: number // 진하기 0~1
  lit: number // 빛을 받은 몫 0~1, 윗면 밝기 최대 두 배
  under?: string // 밑면(두께, 빛 띠)을 그리지 않을 옆 칸 윗면 경로, 맨 위 층에서 옆 땅 윗면을 덮지 않게
  id?: string
  cut?: string // 통째로 비울 경로(앞에 선 큐브 모양)
}

const BoardShadow = ({
  x,
  y,
  axis,
  parity,
  shown,
  lit,
  under = '',
  id = '',
  cut = '',
}: BoardShadowProps) => {
  const { top, side, glow } = bridgeFaces(x, y, axis)
  const shimmer = useLoop(SHIMMER_LOOP, 3000)

  return (
    <g opacity={shown} clipPath={cut ? `url(#cut-${id})` : undefined}>
      {cut && (
        <clipPath id={`cut-${id}`}>
          <path d={`M${x - 400},${y - 400}h800v800h-800Z ${cut}`} clipRule="evenodd" />
        </clipPath>
      )}
      {under && (
        <clipPath id={`under-${id}`}>
          <path d={`M${x - 400},${y - 400}h800v800h-800Z ${under}`} clipRule="evenodd" />
        </clipPath>
      )}
      <g clipPath={under ? `url(#under-${id})` : undefined}>
        {glow.map(({ points, opacity }) => (
          <polygon
            key={opacity}
            points={points}
            opacity={opacity}
            style={{ fill: 'var(--color-shadow-bridge)' }}
          />
        ))}
        <polygon points={side} opacity={0.3} style={{ fill: 'var(--color-shadow-bridge-side)' }} />
      </g>
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
