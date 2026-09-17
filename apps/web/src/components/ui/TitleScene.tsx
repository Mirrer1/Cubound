import BoardBlock from '@/components/board/BoardBlock'
import { darken, shade } from '@/components/board/shade'
import { TILE, toScreen } from '@/game/iso'

const HEIGHTS = [
  [0, 0, 1],
  [0, 0, 1],
  [0, 0, 0],
]
const GOAL = { x: 2, y: 0 }
const PLAYER = { x: 0, y: 2 }

interface TitleSceneProps {
  className?: string
  opacity: number
}

const TitleScene = ({ className, opacity }: TitleSceneProps) => {
  // 반투명 대신 배경색을 섞어 흐리게 한다
  const fade = (color: string) =>
    `color-mix(in srgb, ${color}, var(--color-base-bg) ${Math.round((1 - opacity) * 100)}%)`
  const cells = HEIGHTS.flatMap((row, y) => row.map((h, x) => ({ x, y, h }))).sort(
    (a, b) => a.x + a.y - (b.x + b.y),
  )

  return (
    <svg viewBox="-190 -90 380 300" className={className} aria-hidden>
      <g>
        {cells.map(({ x, y, h }) => {
          const screen = toScreen({ x, y }, h)
          const isGoal = x === GOAL.x && y === GOAL.y
          const isPlayer = x === PLAYER.x && y === PLAYER.y

          return (
            <g key={`${x}-${y}`}>
              <BoardBlock
                x={screen.x}
                y={screen.y}
                width={TILE.width}
                depth={h * TILE.layer + TILE.lip}
                top={fade(isGoal ? darken('floor-left', 12) : 'var(--color-floor-top)')}
                left={fade('var(--color-floor-left)')}
                right={fade('var(--color-floor-right)')}
              />
              {isPlayer && (
                <BoardBlock
                  x={screen.x}
                  y={screen.y - TILE.layer}
                  width={TILE.width * (60 / 104)}
                  depth={TILE.layer}
                  top={fade(shade('player', 'top'))}
                  left={fade(shade('player', 'left'))}
                  right={fade(shade('player', 'right'))}
                />
              )}
            </g>
          )
        })}
      </g>
    </svg>
  )
}

export default TitleScene
