import { type ReactNode, memo } from 'react'

import BoardBlock from './BoardBlock'
import BoardBox from './BoardBox'
import BoardLadder from './BoardLadder'
import { crackThickness } from './frame'
import { blend, checker, darken, dim, shade, tint } from './shade'
import { TILE, blockFaces, isoDelta } from '@/game/iso'
import type { Direction } from '@/game/types'

// 왼쪽 위 모서리와 나란하게 누운 얼음 윗면의 광택 면
const GLOSS_SPOTS: [number, number][] = [
  [-0.38, -0.04],
  [-0.04, -0.38],
  [0.04, -0.3],
  [-0.3, 0.04],
]

// 닳으면 칸이 네 조각으로 갈라지고 밟힌 만큼 조각이 들린다. 들리는 자리는 칸마다 어긋난다
const QUARTERS: [number, number][] = [
  [-0.25, -0.25],
  [0.25, -0.25],
  [0.25, 0.25],
  [-0.25, 0.25],
]
const QUARTER = { scale: 0.44, depth: 5, rise: 7 }

// 무너질 때만 네 조각으로 갈라진다. 가만히 있을 때 갈라 두면 칸이 붙었을 때 줄눈처럼 보인다
const SHARDS: [number, number][] = [
  [-0.25, -0.25],
  [0.25, -0.25],
  [0.25, 0.25],
  [-0.25, 0.25],
]
const SHARD = { scale: 0.46, away: 0.72, sink: [0, 7, 3, 10], thin: 5 }

const SURFACES = {
  hole: {
    top: 'var(--color-hole-rim)',
    left: 'var(--color-floor-left)',
    right: 'var(--color-floor-right)',
  },
  tool: { top: shade('tool', 'top'), left: shade('tool', 'left'), right: shade('tool', 'right') },
  ice: {
    top: 'var(--color-ice)',
    left: 'var(--color-ice-left)',
    right: 'var(--color-ice-right)',
  },
  machine: {
    top: 'var(--color-machine-frame-top)',
    left: 'var(--color-machine-frame-left)',
    right: 'var(--color-machine-frame-right)',
  },
}

// 승강 발판은 칸 크기의 틀 위에 얹힌 판이다
const PLATE = { scale: 0.84, rise: 4, depth: 4 }
const SWITCH_SCALE = 0.66
// 구멍은 테두리 안쪽으로 판 두 장이 차례로 내려간다
const HOLE = [
  { scale: 0.64, drop: 3 },
  { scale: 0.52, drop: 12 },
]

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

const spotPoints = (x: number, y: number, spots: [number, number][]) =>
  spots
    .map(([u, v]) => {
      const d = isoDelta(u, v)
      return `${x + d.x},${y + d.y}`
    })
    .join(' ')

interface BoardCellProps {
  x: number
  y: number
  h: number
  parity: boolean
  goal: boolean
  filled: boolean
  ice: boolean
  crack: boolean // 무너지는 칸
  crackStage: number // 닳은 단계 0~2
  crackBroken: number // 네 조각으로 갈라져 벌어진 정도
  crackFall: number // 무너지며 아래로 내려간 화면 거리
  crackShadow: number // 무너진 자리에 깔리는 그림자 진하기
  crackSeed: number // 자국 자리를 칸마다 어긋나게 하는 값
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
  crackStage,
  crackBroken,
  crackFall,
  crackShadow,
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
  const icy = ice && !goal && !filled
  // 상자가 메운 칸, 얼음, 발판, 구멍은 바닥 대신 제 색으로 칠한다
  const surface = goal ? 'hole' : filled ? 'tool' : icy ? 'ice' : lift ? 'machine' : null
  // 닳은 단계 사이에서는 앞뒤 단계 색을 섞는다
  const worn = Math.min(1, Math.floor(crackStage))
  const crackFace = (face: string) =>
    blend(
      `var(--color-crack-${face}-${worn})`,
      `var(--color-crack-${face}-${worn + 1})`,
      crackStage - worn,
    )
  const plain = surface
    ? SURFACES[surface]
    : crack
      ? { top: crackFace('top'), left: crackFace('left'), right: crackFace('right') }
      : {
          top: parity ? 'var(--color-floor-top-alt)' : 'var(--color-floor-top)',
          left: 'var(--color-floor-left)',
          right: 'var(--color-floor-right)',
        }
  // 바닥은 제 색 토큰이 둘이라 이미 번갈아 있고 구멍은 한 칸뿐이다
  const evenOdd = crack || (surface !== null && surface !== 'hole')
  const faces = evenOdd ? { ...plain, top: checker(plain.top, parity) } : plain
  const depth = crack ? crackThickness(crackStage) + h * TILE.layer : h * TILE.layer + TILE.lip
  // 갈라짐은 한 번 밟은 뒤부터다. 무너지는 중에는 조각이 따로 날아간다
  const split = crack && crackBroken === 0 ? clamp01(crackStage) : 0
  const quarters =
    split > 0
      ? QUARTERS.map(([u, v], i) => {
          const d = isoDelta(u, v)
          const lifted = (i - crackSeed + 4) % 4 < Math.round(crackStage)
          return {
            key: i,
            x: x + d.x * (1 + split * 0.08),
            y: y + d.y * (1 + split * 0.08) - (lifted ? split * QUARTER.rise : 0),
          }
        })
      : []
  const shards =
    crackBroken > 0
      ? SHARDS.map(([u, v], i) => {
          const d = isoDelta(u, v)
          const away = 1 + crackBroken * SHARD.away
          return {
            key: i,
            x: x + d.x * away,
            y: y + d.y * away + crackBroken * SHARD.sink[i],
            depth: Math.max(SHARD.thin, depth - crackBroken * (depth - SHARD.thin)),
          }
        })
      : []
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
          {crackShadow > 0 && (
            <polygon
              points={blockFaces(x, y - crackFall, TILE.width, 0).top}
              style={{ fill: 'var(--color-crack-shadow)', opacity: crackShadow }}
            />
          )}
          <g opacity={blockOpacity}>
            {shards.length > 0 ? (
              shards.map((shard) => (
                <BoardBlock
                  key={shard.key}
                  x={shard.x}
                  y={shard.y}
                  width={TILE.width * SHARD.scale}
                  depth={shard.depth}
                  top={faces.top}
                  left={faces.left}
                  right={faces.right}
                />
              ))
            ) : (
              <BoardBlock
                x={x}
                y={y}
                width={TILE.width}
                depth={depth}
                top={split > 0 ? dim(faces.top, 18) : faces.top}
                left={faces.left}
                right={faces.right}
              />
            )}
            {lift && (
              <BoardBlock
                x={x}
                y={y - PLATE.rise}
                width={TILE.width * PLATE.scale}
                depth={PLATE.depth}
                top="var(--color-machine-top)"
                left="var(--color-machine-left)"
                right="var(--color-machine-right)"
              />
            )}
            {icy && (
              <polygon
                points={spotPoints(x, y, GLOSS_SPOTS)}
                style={{ fill: 'var(--color-ice-gloss)' }}
              />
            )}
            {quarters.map((quarter) => (
              <BoardBlock
                key={quarter.key}
                x={quarter.x}
                y={quarter.y}
                width={TILE.width * QUARTER.scale}
                depth={QUARTER.depth}
                top={faces.top}
                left={faces.left}
                right={faces.right}
              />
            ))}
            {goal &&
              HOLE.map(({ scale, drop }, i) => (
                <polygon
                  key={scale}
                  points={blockFaces(x, y + drop, TILE.width * scale, 0).top}
                  style={{ fill: i === 0 ? 'var(--color-goal)' : darken('goal', 30) }}
                />
              ))}
          </g>
        </g>
      )}
      {entity === 'switch' && (
        <BoardBlock
          x={x}
          y={y - switchDepth}
          width={TILE.width * SWITCH_SCALE}
          depth={switchDepth}
          top={shade('tool', 'top')}
          left={shade('tool', 'left')}
          right={shade('tool', 'right')}
        />
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
