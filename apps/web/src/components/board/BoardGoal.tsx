import { blend, darken, waterTone } from './view'
import { TILE, blockFaces } from '@/game/iso'

interface BoardGoalProps {
  x: number
  y: number // 칸 윗면 중심
  top: string // 골 칸 윗면 색
  sunk: number // 물에 잠긴 정도 0~1
  depth: number // 그 칸의 물 깊이 층
  film: number // 위에 덮이는 수면 막 진하기 0~1
}

// tint는 물에 잠긴 골에 짙은 물빛이 드는 몫, filmOpacity는 수면 막 진하기
const HOLE = { scale: 0.62, wall: 7, tint: 0.6, filmOpacity: 0.45 }

const BoardGoal = ({ x, y, top, sunk, depth, film }: BoardGoalProps) => {
  const tint = HOLE.tint * sunk

  return (
    <>
      {sunk > 0 && (
        <polygon
          points={blockFaces(x, y, TILE.width, 0).top}
          style={{ fill: blend(top, 'var(--color-water-2)', tint) }}
        />
      )}
      <polygon
        points={blockFaces(x, y + HOLE.wall, TILE.width * HOLE.scale, 0).top}
        style={{ fill: blend(darken('goal', 16), 'var(--color-water-2)', tint) }}
      />
      <polygon
        points={blockFaces(x, y + 1, TILE.width * HOLE.scale, 0).top}
        style={{ fill: blend(darken('goal', 36), 'var(--color-water-3)', tint) }}
      />
      {sunk > 0 && (
        <polygon
          points={blockFaces(x, y, TILE.width, 0).top}
          style={{ fill: waterTone(depth) }}
          opacity={HOLE.filmOpacity * film}
        />
      )}
    </>
  )
}

export default BoardGoal
