import BoardBlock from './BoardBlock'
import { darken, shade } from './shade'
import { TILE, blockFaces, toScreen } from '@/game/iso'
import type { GameState } from '@/game/types'

const MARGIN = 40
const PLAYER_WIDTH = TILE.width * (60 / 104)

interface BoardProps {
  game: GameState
}

const Board = ({ game }: BoardProps) => {
  const { stage, player } = game
  const cells = stage.heights
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
    c.sy - TILE.height / 2 - TILE.layer,
    c.sy + TILE.height / 2 + c.h * TILE.layer + TILE.lip,
  ])
  const minX = Math.min(...xs) - MARGIN
  const minY = Math.min(...ys) - MARGIN
  const viewBox = `${minX} ${minY} ${Math.max(...xs) - minX + MARGIN} ${Math.max(...ys) - minY + MARGIN}`

  return (
    <svg viewBox={viewBox} className="h-full w-full">
      {cells.map((cell) => {
        const isGoal = cell.x === stage.goal.x && cell.y === stage.goal.y
        const isPlayer = cell.x === player.x && cell.y === player.y
        const depth = cell.h * TILE.layer + TILE.lip
        const parity = (cell.x + cell.y) % 2 === 1

        return (
          <g key={`${cell.x}-${cell.y}`}>
            <BoardBlock
              x={cell.sx}
              y={cell.sy}
              width={TILE.width}
              depth={depth}
              top={
                isGoal
                  ? 'var(--color-goal)'
                  : parity
                    ? darken('floor-top', 2.8)
                    : 'var(--color-floor-top)'
              }
              left="var(--color-floor-left)"
              right="var(--color-floor-right)"
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
            {isPlayer && !game.cleared && (
              <BoardBlock
                x={cell.sx}
                y={cell.sy - TILE.layer}
                width={PLAYER_WIDTH}
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
