import BoardBlock from './BoardBlock'
import { darken, shade } from './shade'
import { TILE, blockFaces, toScreen } from '@/game/iso'
import type { GameState, Point } from '@/game/types'

const MARGIN = 40
const CUBE_WIDTH = TILE.width * (60 / 104)

interface BoardProps {
  game: GameState
}

const Board = ({ game }: BoardProps) => {
  const { stage, heights, boxes, player } = game
  const at = (list: Point[], x: number, y: number) => list.some((p) => p.x === x && p.y === y)

  const cells = heights
    .flatMap((row, y) =>
      row.map((h, x) => {
        const screen = toScreen({ x, y }, h)
        return { x, y, h, sx: screen.x, sy: screen.y }
      }),
    )
    .filter((cell) => cell.h >= 0)
    .sort((a, b) => a.x + a.y - (b.x + b.y))

  const xs = cells.flatMap((c) => [c.sx - TILE.width / 2, c.sx + TILE.width / 2])
  const ys = cells.flatMap((c) => [
    c.sy - TILE.height / 2 - TILE.layer * 2,
    c.sy + TILE.height / 2 + c.h * TILE.layer + TILE.lip,
  ])
  const minX = Math.min(...xs) - MARGIN
  const minY = Math.min(...ys) - MARGIN
  const viewBox = `${minX} ${minY} ${Math.max(...xs) - minX + MARGIN} ${Math.max(...ys) - minY + MARGIN}`

  return (
    <svg viewBox={viewBox} className="h-full w-full">
      {cells.map((cell) => {
        const isGoal = cell.x === stage.goal.x && cell.y === stage.goal.y
        const isFilled = stage.heights[cell.y][cell.x] < 0
        const hasBox = at(boxes, cell.x, cell.y)
        const hasPlayer = cell.x === player.x && cell.y === player.y && !game.cleared
        const floorTop =
          (cell.x + cell.y) % 2 === 1 ? darken('floor-top', 2.8) : 'var(--color-floor-top)'
        const boxY = cell.sy - TILE.layer

        return (
          <g key={`${cell.x}-${cell.y}`}>
            <BoardBlock
              x={cell.sx}
              y={cell.sy}
              width={TILE.width}
              depth={cell.h * TILE.layer + TILE.lip}
              top={isGoal ? 'var(--color-goal)' : isFilled ? shade('tool', 'top') : floorTop}
              left={isFilled ? shade('tool', 'left') : 'var(--color-floor-left)'}
              right={isFilled ? shade('tool', 'right') : 'var(--color-floor-right)'}
              stroke={isGoal ? undefined : darken('floor-top', 6)}
            />
            {isGoal && (
              <>
                <polygon
                  points={blockFaces(cell.sx, cell.sy + 7, TILE.width * 0.62, 0).top}
                  style={{ fill: darken('goal', 16) }}
                />
                <polygon
                  points={blockFaces(cell.sx, cell.sy + 1, TILE.width * 0.62, 0).top}
                  style={{ fill: darken('goal', 36) }}
                />
              </>
            )}
            {hasBox && (
              <>
                <BoardBlock
                  x={cell.sx}
                  y={boxY}
                  width={CUBE_WIDTH}
                  depth={TILE.layer}
                  top={shade('tool', 'top')}
                  left={shade('tool', 'left')}
                  right={shade('tool', 'right')}
                />
                <polygon
                  points={blockFaces(cell.sx, boxY, TILE.width * 0.44, 0).top}
                  style={{ fill: 'none', stroke: darken('tool', 34), strokeWidth: 1.1 }}
                />
              </>
            )}
            {hasPlayer && (
              <BoardBlock
                x={cell.sx}
                y={cell.sy - TILE.layer * (hasBox ? 2 : 1)}
                width={CUBE_WIDTH}
                depth={TILE.layer}
                top={shade('player', 'top')}
                left={shade('player', 'left')}
                right={shade('player', 'right')}
              />
            )}
          </g>
        )
      })}
    </svg>
  )
}

export default Board
