import { Embers, Flicker, Pool } from './BoardFire'
import { fireStyle } from './view'
import { TILE, blockFaces } from '@/game/iso'
import { useFade } from '@/hooks/useFade'

const HOT = { fill: 'var(--color-heat-hot)' }
const CORE = { fill: 'var(--color-heat-core)' }

const STYLE = fireStyle(false)

const plate = (x: number, y: number, scale: number) => blockFaces(x, y, TILE.width * scale, 0).top

interface BoardTrailProps {
  part: 'floor' | 'flame' // 땅에 고이는 빛, 칸 위 불 판과 불티
  x: number
  y: number // 칸 윗면 중심
  flame: number
  pool: number
  lit: boolean
}

// 꼬리 불 켜짐과 꺼짐 시간(ms), 이동 0.24초보다 긴 값
const LIGHT = 500
const OUT = 400

// 꼬리 불이 켜질 때 퍼지기 시작하고 꺼질 때 줄어드는 크기 비
const SPREAD = 0.5

// 꺼지지 않는 불이 지나간 칸의 꼬리 불
const BoardTrail = ({ part, x, y, flame, pool, lit }: BoardTrailProps) => {
  const opacity = lit ? 1 : 0
  const fadeRef = useFade(opacity, lit ? LIGHT : OUT, 0, SPREAD)

  return (
    <g ref={fadeRef} opacity={opacity} style={{ transformOrigin: `${x}px ${y}px` }}>
      {part === 'floor' ? (
        <Flicker opacity={flame}>
          <Pool x={x} y={y} scale={STYLE.pool * pool} opacity={STYLE.poolOpacity * STYLE.inner} />
        </Flicker>
      ) : (
        <>
          <Flicker opacity={flame}>
            <polygon points={plate(x, y, 0.62 * pool)} opacity={0.75 * STYLE.inner} style={HOT} />
            <polygon points={plate(x, y, 0.34 * pool)} opacity={0.85 * STYLE.inner} style={CORE} />
            <Pool x={x} y={y} scale={0.7 * pool} opacity={0.35} core />
          </Flicker>
          <Embers
            x={x}
            y={y}
            count={STYLE.count}
            top={STYLE.rise}
            every={STYLE.every}
            opacity={flame}
          />
        </>
      )}
    </g>
  )
}

export default BoardTrail
