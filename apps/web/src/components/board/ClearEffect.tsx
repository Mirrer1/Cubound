import { motion } from 'motion/react'

import BoardBlock from './BoardBlock'
import { CUBE } from './cube'
import { shade } from './shade'
import { TILE, blockFaces } from '@/game/iso'

const PARTICLE_SIZE = 15

const PARTICLES = [
  { dx: -34, rise: 78, token: 'player' },
  { dx: 22, rise: 104, token: 'tool' },
  { dx: -10, rise: 122, token: 'player' },
  { dx: 40, rise: 72, token: 'tool' },
  { dx: -46, rise: 96, token: 'tool' },
  { dx: 6, rise: 88, token: 'player' },
  { dx: 30, rise: 112, token: 'player' },
  { dx: -22, rise: 66, token: 'tool' },
  { dx: 14, rise: 92, token: 'tool' },
]

interface ClearEffectProps {
  x: number
  y: number // 구멍 윗면 중심
}

const ClearEffect = ({ x, y }: ClearEffectProps) => {
  const hw = TILE.width / 2
  const hh = TILE.width / 4
  // 구멍 아래로 들어간 부분을 가린다
  const clip = `${x - 4000},${y} ${x - hw},${y} ${x},${y + hh} ${x + hw},${y} ${x + 4000},${y} ${x + 4000},${y - 4000} ${x - 4000},${y - 4000}`
  // 고리는 제 자리에서 커져야 해서 자기 영역 한가운데를 기준으로 삼는다
  const origin = { transformBox: 'fill-box' as const, transformOrigin: 'center' }

  return (
    <g>
      <clipPath id="goal-clip">
        <polygon points={clip} />
      </clipPath>
      <g clipPath="url(#goal-clip)">
        <motion.g
          initial={{ y: 0 }}
          animate={{ y: TILE.layer + hh }}
          transition={{ duration: 0.75, ease: 'easeIn' }}
        >
          <BoardBlock
            x={x}
            y={y - TILE.layer}
            width={TILE.width * CUBE}
            depth={TILE.layer}
            top={shade('player', 'top')}
            left={shade('player', 'left')}
            right={shade('player', 'right')}
          />
        </motion.g>
      </g>
      <motion.polygon
        points={blockFaces(x, y, TILE.width * 0.62, 0).top}
        style={{ ...origin, fill: 'none', stroke: 'var(--color-player)', strokeWidth: 2.4 }}
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: [0, 1, 0], scale: [0.6, 2.2] }}
        transition={{ duration: 0.9, delay: 0.3, ease: 'easeOut' }}
      />
      {PARTICLES.map(({ dx, rise, token }, i) => (
        <motion.polygon
          key={i}
          points={blockFaces(x + dx, y, PARTICLE_SIZE, 0).top}
          style={{ fill: shade(token, 'top') }}
          initial={{ opacity: 0, y: 0 }}
          animate={{ opacity: [0, 1, 1, 0], y: -rise }}
          transition={{ duration: 1.1, delay: 0.5 + i * 0.04, ease: 'easeOut' }}
        />
      ))}
    </g>
  )
}

export default ClearEffect
