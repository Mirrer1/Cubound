import type { ComponentProps } from 'react'

import BoardBlock from './BoardBlock'
import BoardVine from './BoardVine'
import type { VineKind } from './frame'
import { PIT_FLOOR, STOP, clamp01, railLayout, spotPoints } from './view'
import { TILE, blockFaces } from '@/game/iso'

const RAIL_HALF = 0.13

// 덩굴 판은 처음 이만큼 차오르는 동안 나타난다
const VINE_PLATE_FADE = 0.6

// 칸 가운데에서 (dx, dy) 쪽 모서리까지 가는 레일 띠
const railSpots = (dx: number, dy: number): [number, number][] =>
  dx !== 0
    ? [
        [-RAIL_HALF * dx, -RAIL_HALF],
        [dx / 2, -RAIL_HALF],
        [dx / 2, RAIL_HALF],
        [-RAIL_HALF * dx, RAIL_HALF],
      ]
    : [
        [-RAIL_HALF, -RAIL_HALF * dy],
        [-RAIL_HALF, dy / 2],
        [RAIL_HALF, dy / 2],
        [RAIL_HALF, -RAIL_HALF * dy],
      ]

// 구덩이 뒤쪽 벽. 땅 높이에서 구덩이 바닥까지만 칠하고 그 위는 옆 칸이 제 면으로 그린다
const wallPoints = (x: number, y: number, side: number) => {
  const top = y
  const hw = (TILE.width / 2) * side
  const hh = TILE.height / 2
  return `${x},${top - hh} ${x + hw},${top} ${x + hw},${y + PIT_FLOOR} ${x},${y - hh + PIT_FLOOR}`
}

interface BoardPitProps {
  x: number
  y: number
  rail: string // 이웃한 발판 길 칸 방향을 "x,y"로 이은 값, 빈 값이면 길 칸이 아님
  railNext: boolean // 발판이 다음 수에 들어올 칸
  pitWallLeft: number // 0 이상이면 위 칸 쪽에 구덩이 벽을 세우고 -1이면 벽 없음
  pitWallRight: number // 0 이상이면 왼 칸 쪽에 구덩이 벽을 세우고 -1이면 벽 없음
  vine: VineKind | null // 덩굴 뿌리나 길 칸
  grownVine: boolean
  vineRise: number // 판이 구덩이에서 차오른 정도
  vineProps: Omit<ComponentProps<typeof BoardVine>, 'layer' | 'kind'>
  faces: { top: string; left: string; right: string }
}

const BoardPit = ({
  x,
  y,
  rail,
  railNext,
  pitWallLeft,
  pitWallRight,
  vine,
  grownVine,
  vineRise,
  vineProps,
  faces,
}: BoardPitProps) => {
  const plateSink = (1 - vineRise) * PIT_FLOOR
  const { rails, stopOffset } = railLayout(rail)

  return (
    <g>
      <polygon
        points={blockFaces(x, y + PIT_FLOOR, TILE.width, 0).top}
        style={{ fill: 'var(--color-pit-floor)' }}
      />
      {pitWallLeft >= 0 && (
        <polygon points={wallPoints(x, y, 1)} style={{ fill: 'var(--color-pit-wall-left)' }} />
      )}
      {pitWallRight >= 0 && (
        <polygon points={wallPoints(x, y, -1)} style={{ fill: 'var(--color-pit-wall-right)' }} />
      )}
      {rails.map(([dx, dy]) => (
        <polygon
          key={`${dx},${dy}`}
          points={spotPoints(x, y + PIT_FLOOR, railSpots(dx, dy))}
          style={{
            fill: railNext ? 'var(--color-tram-rail-next)' : 'var(--color-tram-rail)',
            transition: 'fill 200ms var(--ease-soft)',
          }}
        />
      ))}
      {stopOffset && (
        <BoardBlock
          x={x + stopOffset.x}
          y={y + PIT_FLOOR + stopOffset.y - STOP.depth}
          width={TILE.width * STOP.scale}
          depth={STOP.depth}
          top="var(--color-tram-stop-top)"
          left="var(--color-tram-stop-left)"
          right="var(--color-tram-stop-right)"
        />
      )}
      {vine && (
        <>
          <BoardVine layer="pit" kind={vine} {...vineProps} />
          {grownVine && (
            <g opacity={clamp01(vineRise / VINE_PLATE_FADE)}>
              <BoardBlock
                x={x}
                y={y + plateSink}
                width={TILE.width}
                depth={TILE.lip - plateSink}
                top={faces.top}
                left={faces.left}
                right={faces.right}
              />
            </g>
          )}
          <BoardVine layer="top" kind={vine} {...vineProps} />
        </>
      )}
    </g>
  )
}

export default BoardPit
