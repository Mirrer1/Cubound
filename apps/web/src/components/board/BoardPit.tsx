import type { ComponentProps } from 'react'

import BoardBlock from './BoardBlock'
import BoardVine from './BoardVine'
import type { VineKind } from './frame'
import { PIT_FLOOR, STOP, clamp01, nightTone, railLayout, spotPoints } from './view'
import { TILE, blockFaces } from '@/game/iso'
import { useFade } from '@/hooks/useFade'

const RAIL_HALF = 0.13

// 어둠에서 구덩이 안을 칸 밝기에서 까만색 쪽으로 더 어둡게 하는 몫
const PIT_SHADE = 0.6

// 덩굴 판이 나타나는 처음 차오름 몫
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

// 땅 높이에서 구덩이 바닥까지만 칠하는 뒤쪽 벽, 그 위는 옆 칸의 제 면
const wallPoints = (x: number, y: number, side: number) => {
  const top = y
  const hw = (TILE.width / 2) * side
  const hh = TILE.height / 2
  return `${x},${top - hh} ${x + hw},${top} ${x + hw},${y + PIT_FLOOR} ${x},${y - hh + PIT_FLOOR}`
}

interface BoardPitProps {
  x: number
  y: number
  rail: string // 이웃한 발판 길 칸 방향을 "x,y"로 이은 값, 빈 값이면 길이 아닌 칸
  railNext: boolean // 발판이 다음 수에 들어올 칸
  pitWallLeft: number // 0 이상이면 위 칸 쪽에 세우는 구덩이 벽, -1이면 벽 없는 칸
  pitWallRight: number // 0 이상이면 왼 칸 쪽에 세우는 구덩이 벽, -1이면 벽 없는 칸
  pitWallLeftShown: number
  pitWallRightShown: number
  vine: VineKind | null // 덩굴 뿌리나 길 칸
  grownVine: boolean
  vineRise: number // 판이 구덩이에서 차오른 정도
  vineProps: Omit<ComponentProps<typeof BoardVine>, 'layer' | 'kind'>
  faces: { top: string; left: string; right: string }
  dim?: number | null // 어둠에서 발판 길 칸을 상자처럼 한 색으로 칠할 어둠 값
}

const BoardPit = ({
  x,
  y,
  rail,
  railNext,
  pitWallLeft,
  pitWallRight,
  pitWallLeftShown,
  pitWallRightShown,
  vine,
  grownVine,
  vineRise,
  vineProps,
  faces,
  dim = null,
}: BoardPitProps) => {
  // 어둠의 발판 길 칸은 막 대신 직접 칠함, 막은 전환 중 칸 둘레로 잘려 구덩이 테두리가 가늘게 하얗게 샘
  const tone = (color: string) => nightTone(color, dim)
  // 구덩이 안(바닥과 벽)은 바닥보다 빛이 덜 닿게 더 어둡게, 칸 밝기 그대로면 구멍이 아니라 회색 덩어리처럼 보임
  const deep = (color: string) =>
    nightTone(color, dim === null ? null : dim + (1 - dim) * PIT_SHADE)
  const nextFade = useFade(railNext ? 1 : 0, 200)
  const plateSink = (1 - vineRise) * PIT_FLOOR
  const { rails, stopOffset } = railLayout(rail)

  return (
    <g>
      <polygon
        points={blockFaces(x, y + PIT_FLOOR, TILE.width, 0).top}
        style={{ fill: deep('var(--color-pit-floor)') }}
      />
      {pitWallLeft >= 0 && (
        <polygon
          points={wallPoints(x, y, 1)}
          style={{ fill: deep('var(--color-pit-wall-left)'), opacity: pitWallLeftShown }}
        />
      )}
      {pitWallRight >= 0 && (
        <polygon
          points={wallPoints(x, y, -1)}
          style={{ fill: deep('var(--color-pit-wall-right)'), opacity: pitWallRightShown }}
        />
      )}
      {rails.map(([dx, dy]) => (
        <polygon
          key={`${dx},${dy}`}
          points={spotPoints(x, y + PIT_FLOOR, railSpots(dx, dy))}
          style={{ fill: tone('var(--color-tram-rail)') }}
        />
      ))}
      {/* 발판이 다음에 들어올 칸의 밝은 레일, 위에 겹쳐 투명도만 Web Animation으로 바꿈
          CSS 전환은 발판이 미끄러지며 칸 그리는 순서가 바뀌면 끊겨 밝은 레일이 엉뚱한 칸에 잠깐 남음 */}
      <g ref={nextFade} opacity={railNext ? 1 : 0}>
        {rails.map(([dx, dy]) => (
          <polygon
            key={`${dx},${dy}`}
            points={spotPoints(x, y + PIT_FLOOR, railSpots(dx, dy))}
            style={{ fill: tone('var(--color-tram-rail-next)') }}
          />
        ))}
      </g>
      {stopOffset && (
        <BoardBlock
          x={x + stopOffset.x}
          y={y + PIT_FLOOR + stopOffset.y - STOP.depth}
          width={TILE.width * STOP.scale}
          depth={STOP.depth}
          top={tone('var(--color-tram-stop-top)')}
          left={tone('var(--color-tram-stop-left)')}
          right={tone('var(--color-tram-stop-right)')}
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
