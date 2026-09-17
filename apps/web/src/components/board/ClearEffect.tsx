import { motion } from 'motion/react'

import BoardBlock from './BoardBlock'
import { CUBE } from './cube'
import { shade } from './shade'
import { TILE, blockFaces } from '@/game/iso'

const PARTICLES = [
  { dx: -22, rise: 64, token: 'player' },
  { dx: 14, rise: 82, token: 'tool' },
  { dx: -6, rise: 96, token: 'player' },
  { dx: 26, rise: 58, token: 'tool' },
  { dx: -30, rise: 76, token: 'tool' },
  { dx: 4, rise: 70, token: 'player' },
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
  const origin = { transformOrigin: `${x}px ${y}px`, transformBox: 'view-box' as const }

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
        style={{ ...origin, fill: 'none', stroke: 'var(--color-player)', strokeWidth: 1.4 }}
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: [0, 0.9, 0], scale: [0.6, 1.9] }}
        transition={{ duration: 0.9, delay: 0.3, ease: 'easeOut' }}
      />
      {PARTICLES.map(({ dx, rise, token }, i) => (
        <motion.polygon
          key={i}
          points={blockFaces(x + dx, y, 9, 0).top}
          style={{ fill: shade(token, 'top') }}
          initial={{ opacity: 0, y: 0 }}
          animate={{ opacity: [0, 1, 0], y: -rise }}
          transition={{ duration: 0.8, delay: 0.5 + i * 0.05, ease: 'easeOut' }}
        />
      ))}
    </g>
  )
}

export default ClearEffect
