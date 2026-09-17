import { type ReactNode, memo } from 'react'

import BoardBlock from './BoardBlock'
import BoardBox from './BoardBox'
import BoardLadder from './BoardLadder'
import { darken, shade, tint } from './shade'
import { TILE, blockFaces } from '@/game/iso'
import type { Direction } from '@/game/types'

interface BoardCellProps {
  x: number
  y: number
  h: number
  parity: boolean
  goal: boolean
  filled: boolean
  hidden: boolean // 상자가 메우는 중인 칸
  faded: boolean
  entity: 'switch' | 'door' | null
  switchDepth: number
  doorDepth: number
  box: boolean
  flatLadder: number // 투명도, 0이면 없음
  leaning: string // "방향:투명도"를 |로 이은 값
  children?: ReactNode
}

const BoardCell = ({
  x,
  y,
  h,
  parity,
  goal,
  filled,
  hidden,
  faded,
  entity,
  switchDepth,
  doorDepth,
  box,
  flatLadder,
  leaning,
  children,
}: BoardCellProps) => {
  const floorTop = parity ? darken('floor-top', 2.8) : 'var(--color-floor-top)'
  const ladders = leaning
    ? leaning.split('|').map((item) => {
        const [direction, opacity] = item.split(':')
        return { direction: direction as Direction, opacity: Number(opacity) }
      })
    : []

  return (
    <g>
      {!hidden && (
        <g style={{ opacity: faded ? 0.35 : 1, transition: 'opacity 320ms var(--ease-soft)' }}>
          <BoardBlock
            x={x}
            y={y}
            width={TILE.width}
            depth={h * TILE.layer + TILE.lip}
            top={goal ? 'var(--color-goal)' : filled ? shade('tool', 'top') : floorTop}
            left={filled ? shade('tool', 'left') : 'var(--color-floor-left)'}
            right={filled ? shade('tool', 'right') : 'var(--color-floor-right)'}
            stroke={goal ? undefined : darken('floor-top', 6)}
          />
          {goal && (
            <>
              <polygon
                points={blockFaces(x, y + 7, TILE.width * 0.62, 0).top}
                style={{ fill: darken('goal', 16) }}
              />
              <polygon
                points={blockFaces(x, y + 1, TILE.width * 0.62, 0).top}
                style={{ fill: darken('goal', 36) }}
              />
            </>
          )}
        </g>
      )}
      {entity === 'switch' && (
        <>
          <polygon
            points={blockFaces(x, y, TILE.width * 0.78, 0).top}
            style={{ fill: 'none', stroke: 'var(--color-floor-left)', strokeWidth: 1 }}
          />
          <BoardBlock
            x={x}
            y={y - switchDepth}
            width={TILE.width * (56 / 104)}
            depth={switchDepth}
            top={shade('tool', 'top')}
            left={shade('tool', 'left')}
            right={shade('tool', 'right')}
          />
        </>
      )}
      {entity === 'door' && (
        <>
          <BoardBlock
            x={x}
            y={y - doorDepth}
            width={TILE.width}
            depth={doorDepth}
            top={tint('var(--color-door)', 22)}
            left={tint(darken('door', 20), 16)}
            right={tint(darken('door', 10), 18)}
          />
          <polygon
            points={blockFaces(x, y - doorDepth, TILE.width * 0.46, 0).top}
            style={{ fill: shade('tool', 'top'), opacity: 0.9 }}
          />
        </>
      )}
      {box && <BoardBox x={x} y={y - TILE.layer} />}
      {flatLadder > 0 && (
        <g opacity={flatLadder}>
          <BoardLadder x={x} y={y} />
        </g>
      )}
      {ladders.map(({ direction, opacity }) => (
        <g key={direction} opacity={opacity}>
          <BoardLadder x={x} y={y} direction={direction} />
        </g>
      ))}
      {children}
    </g>
  )
}

// 연출 중에도 바뀌지 않은 칸은 다시 그리지 않는다
export default memo(BoardCell)
