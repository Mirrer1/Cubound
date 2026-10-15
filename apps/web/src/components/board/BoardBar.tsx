import { Pool } from './BoardFire'
import { type BarPiece, barTone, flatLook } from './view'
import { useLoop } from '@/hooks/useLoop'

// 달궈진 채 기다리는 막대의 아주 약한 숨쉬기
const BREATH: Keyframe[] = [{ opacity: 1 }, { opacity: 0.25 }, { opacity: 1 }]
const BREATH_MS = 2400

// 기다리는 동안 숨쉬기 아래에 깔리는 빛
const WAIT_HEAT = 0.8

interface BoardBarProps {
  piece: BarPiece
  opacity: number
  heat: number
  waiting: boolean
}

const BoardBar = ({ piece, opacity, heat, waiting }: BoardBarProps) => {
  const breath = useLoop(BREATH, BREATH_MS)
  const flats = piece.flats.map(flatLook)
  const under = waiting ? heat * WAIT_HEAT : heat

  return (
    <g opacity={opacity}>
      {flats.map((look, i) => (
        <polygon
          key={i}
          points={piece.flats[i].points}
          opacity={look.opacity}
          style={{ fill: look.fill }}
        />
      ))}
      {piece.pool && heat > 0 && (
        <Pool x={piece.pool.x} y={piece.pool.y} scale={0.95} opacity={0.1 * heat} />
      )}
      {piece.faces.map((face, i) => (
        <polygon key={i} points={face.points} style={{ fill: barTone(face, under) }} />
      ))}
      {waiting && heat > 0 && (
        <g ref={breath}>
          {piece.faces.map((face, i) => (
            <polygon key={i} points={face.points} style={{ fill: barTone(face, heat) }} />
          ))}
        </g>
      )}
    </g>
  )
}

export default BoardBar
