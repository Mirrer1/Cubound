import { type ReactNode, memo } from 'react'

import BoardBlock from './BoardBlock'
import BoardBox from './BoardBox'
import BoardLadder from './BoardLadder'
import { darken, shade, tint } from './shade'
import { TILE, blockFaces, isoDelta } from '@/game/iso'
import type { Direction } from '@/game/types'

const GLOSS = { pull: 0.175, span: 0.2 }
// 무너지는 칸은 윗면이 네 조각으로 갈라져 있고 틈으로 아래 어둠이 비친다. 닳을수록 틈이 벌어진다
const CRACK = { thin: 0.026, thick: 0.075, dim: 28, dimDeep: 64 }

// 갈라지는 자리를 칸마다 어긋나게 둔다. 나란히 놓여도 격자무늬로 보이지 않는다
const CRACK_CENTERS: [number, number][] = [
  [-0.11, 0.07],
  [0.09, -0.13],
  [0.13, 0.11],
  [-0.07, -0.09],
]

// 네 조각. 바깥 윤곽은 그대로 두고 갈라진 자리 쪽 두 변만 틈만큼 물러난다
const crackShards = (x: number, y: number, gap: number, seed: number) => {
  const g = Math.min(gap, 0.3)
  const [ox, oy] = CRACK_CENTERS[seed]
  const l = ox - g
  const r = ox + g
  const u = oy - g
  const d = oy + g
  const quads: [number, number][][] = [
    [
      [-0.5, -0.5],
      [l, -0.5],
      [l, u],
      [-0.5, u],
    ],
    [
      [r, -0.5],
      [0.5, -0.5],
      [0.5, u],
      [r, u],
    ],
    [
      [r, d],
      [0.5, d],
      [0.5, 0.5],
      [r, 0.5],
    ],
    [
      [-0.5, d],
      [l, d],
      [l, 0.5],
      [-0.5, 0.5],
    ],
  ]

  return quads.map((quad) =>
    quad
      .map(([u, v]) => {
        const d = isoDelta(u, v)
        return `${x + d.x},${y + d.y}`
      })
      .join(' '),
  )
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t

// 왼쪽 위 모서리와 나란하게 가운데 쪽으로 당겨 놓은 얼음 윗면의 광택선
const glossLine = (x: number, y: number) => ({
  x1: x - TILE.width * (GLOSS.pull + GLOSS.span),
  y1: y - (TILE.width / 2) * (GLOSS.pull - GLOSS.span),
  x2: x - TILE.width * (GLOSS.pull - GLOSS.span),
  y2: y - (TILE.width / 2) * (GLOSS.pull + GLOSS.span),
})

interface BoardCellProps {
  x: number
  y: number
  h: number
  parity: boolean
  goal: boolean
  filled: boolean
  ice: boolean
  crack: boolean // 무너지는 칸
  crackDepth: number // 금 깊이, 0이면 실금 1이면 굵은 금
  crackSpread: number // 무너지며 조각이 벌어진 정도
  crackSeed: number // 갈라지는 자리를 칸마다 어긋나게 하는 값
  hidden: boolean // 상자가 메우는 중인 칸
  faded: boolean
  entity: 'switch' | 'door' | null
  lift: boolean
  switchDepth: number
  doorDepth: number
  box: boolean
  blockOpacity: number // 칸 블록 투명도
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
  ice,
  crack,
  crackDepth,
  crackSpread,
  crackSeed,
  hidden,
  faded,
  entity,
  lift,
  switchDepth,
  doorDepth,
  box,
  blockOpacity,
  flatLadder,
  leaning,
  children,
}: BoardCellProps) => {
  const floorTop = parity ? darken('floor-top', 2.8) : 'var(--color-floor-top)'
  const icy = ice && !goal && !filled
  // 상자가 메운 칸, 얼음, 발판, 무너지는 칸은 바닥 대신 제 색으로 칠한다
  const surface = filled ? 'tool' : icy ? 'ice' : lift ? 'lift' : crack ? 'crack' : null
  const faces = surface
    ? { top: shade(surface, 'top'), left: shade(surface, 'left'), right: shade(surface, 'right') }
    : { top: floorTop, left: 'var(--color-floor-left)', right: 'var(--color-floor-right)' }
  const stroke = icy
    ? darken('ice', 10)
    : lift
      ? darken('lift', 26)
      : crack
        ? darken('crack', 12)
        : darken('floor-top', 6)
  const gloss = glossLine(x, y)
  const ladders = leaning
    ? leaning.split('|').map((item) => {
        const [direction, opacity] = item.split(':')
        return { direction: direction as Direction, opacity: Number(opacity) }
      })
    : []

  return (
    <g>
      {!hidden && (
        <g style={{ opacity: faded ? 0.5 : 1, transition: 'opacity 320ms var(--ease-soft)' }}>
          <g opacity={blockOpacity}>
            <BoardBlock
              x={x}
              y={y}
              width={TILE.width}
              depth={h * TILE.layer + TILE.lip}
              top={goal ? 'var(--color-goal)' : faces.top}
              left={faces.left}
              right={faces.right}
              stroke={goal ? undefined : stroke}
            />
            {lift && (
              <polygon
                points={blockFaces(x, y, TILE.width * 0.84, 0).top}
                style={{ fill: 'none', stroke: darken('lift', 26), strokeWidth: 1.8 }}
              />
            )}
            {icy && (
              <line
                x1={gloss.x1}
                y1={gloss.y1}
                x2={gloss.x2}
                y2={gloss.y2}
                stroke="var(--color-ice-gloss)"
                strokeWidth={2.2}
                strokeLinecap="round"
              />
            )}
            {crack && (
              <>
                <polygon
                  points={blockFaces(x, y, TILE.width, 0).top}
                  style={{ fill: darken('crack', lerp(CRACK.dim, CRACK.dimDeep, crackDepth)) }}
                />
                {crackShards(
                  x,
                  y,
                  lerp(CRACK.thin, CRACK.thick, crackDepth) + crackSpread,
                  crackSeed,
                ).map((shard, i) => (
                  <polygon key={i} points={shard} style={{ fill: faces.top }} />
                ))}
              </>
            )}
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
