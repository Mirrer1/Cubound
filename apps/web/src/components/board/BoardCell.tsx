import { type ReactNode, memo } from 'react'

import BoardBlock from './BoardBlock'
import BoardBox from './BoardBox'
import BoardLadder from './BoardLadder'
import { crackThickness } from './frame'
import { blend, checker, darken, dim, shade } from './shade'
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
const QUARTER = { scale: 0.485, depth: 4, rise: 4 }

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
    top: 'var(--color-goal)',
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

// 미끄러져 지나간 자국. 칸보다 작게 그리면 칸 안에 뜬 액자처럼 보인다
const FROST_OPACITY = 0.7

// 승강 발판은 칸 크기의 틀 위에 얹힌 판이다. 틀과 판의 밝기 차이가 기계로 읽힌다
const PLATE = { scale: 0.84, rise: 4, depth: 4 }
// 짝 칸은 판보다 낮은 자리에 면을 한 장 더 얹어 우묵하게 보인다
const DISH = 0.46
const SWITCH_SCALE = 0.66
// 구멍은 같은 크기 판 두 장을 어긋나게 겹쳐 두께를 낸다
const HOLE = { scale: 0.62, wall: 7 }

// 발판 길 칸은 구덩이로 그린다. 바닥은 높이 0 칸의 윗면보다 이만큼 아래다
export const PIT_FLOOR = 11
const RAIL_HALF = 0.13
// 길 끝에서 방향이 뒤집히는 자리에 서는 블록
const STOP = { offset: 0.36, scale: 0.2, depth: 9 }

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

const spotPoints = (x: number, y: number, spots: [number, number][]) =>
  spots
    .map(([u, v]) => {
      const d = isoDelta(u, v)
      return `${x + d.x},${y + d.y}`
    })
    .join(' ')

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

// 구덩이 뒤쪽 벽. 옆 칸 윗면 모서리에서 구덩이 바닥까지 내려온다
const wallPoints = (x: number, y: number, h: number, side: number) => {
  const top = y - h * TILE.layer
  const hw = (TILE.width / 2) * side
  const hh = TILE.height / 2
  return `${x},${top - hh} ${x + hw},${top} ${x + hw},${y + PIT_FLOOR} ${x},${y - hh + PIT_FLOOR}`
}

interface BoardCellProps {
  x: number
  y: number
  h: number
  parity: boolean
  goal: boolean
  filled: boolean
  ice: boolean
  frost: number // 미끄러져 지나간 자국 진하기
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
  warp: boolean
  switchDepth: number
  doorDepth: number
  box: boolean
  rail: string // 이웃한 발판 길 칸 방향을 "x,y"로 이은 값, 빈 값이면 길 칸이 아님
  railNext: boolean // 발판이 다음 수에 들어올 칸
  pitWallLeft: number // 위 칸의 왼면 자리에 서는 벽의 높이, -1이면 벽 없음
  pitWallRight: number // 왼 칸의 오른면 자리에 서는 벽의 높이, -1이면 벽 없음
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
  frost,
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
  warp,
  switchDepth,
  doorDepth,
  box,
  rail,
  railNext,
  pitWallLeft,
  pitWallRight,
  blockOpacity,
  flatLadder,
  leaning,
  children,
}: BoardCellProps) => {
  const icy = ice && !goal && !filled
  // 상자가 메운 칸, 얼음, 발판, 짝 칸, 구멍은 바닥 대신 제 색으로 칠한다
  const surface = goal ? 'hole' : filled ? 'tool' : icy ? 'ice' : lift || warp ? 'machine' : null
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
            x: x + d.x * (1 + split * 0.025),
            y: y + d.y * (1 + split * 0.025) - (lifted ? split * QUARTER.rise : 0),
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
  // 칸 위의 상자도 큐브를 가려서 칸과 같이 흐려진다
  const fade = { opacity: faded ? 0.5 : 1, transition: 'opacity 320ms var(--ease-soft)' }
  const neighbors = rail ? rail.split('|').map((d) => d.split(',').map(Number)) : []
  // 길 끝 칸은 이웃이 하나라 반대쪽으로도 띠를 이어 칸을 채우고, 그 자리가 멈춤 블록 자리다
  const stopAt = neighbors.length === 1 ? [-neighbors[0][0], -neighbors[0][1]] : null
  const rails = stopAt ? [neighbors[0], stopAt] : neighbors
  const stopOffset = stopAt ? isoDelta(STOP.offset * stopAt[0], STOP.offset * stopAt[1]) : null

  return (
    <g>
      {rail !== '' && (
        <g>
          <polygon
            points={blockFaces(x, y + PIT_FLOOR, TILE.width, 0).top}
            style={{ fill: 'var(--color-pit-floor)' }}
          />
          {pitWallLeft >= 0 && (
            <polygon
              points={wallPoints(x, y, pitWallLeft, 1)}
              style={{ fill: 'var(--color-pit-wall-left)' }}
            />
          )}
          {pitWallRight >= 0 && (
            <polygon
              points={wallPoints(x, y, pitWallRight, -1)}
              style={{ fill: 'var(--color-pit-wall-right)' }}
            />
          )}
          {rails.map(([dx, dy]) => (
            <polygon
              key={`${dx},${dy}`}
              points={spotPoints(x, y + PIT_FLOOR, railSpots(dx, dy))}
              style={{ fill: railNext ? 'var(--color-tram-rail-next)' : 'var(--color-tram-rail)' }}
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
        </g>
      )}
      {rail === '' && !hidden && (
        <g style={fade}>
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
                top={split > 0 ? dim(faces.top, 9) : faces.top}
                left={faces.left}
                right={faces.right}
              />
            )}
            {(lift || warp) && (
              <>
                <BoardBlock
                  x={x}
                  y={y - PLATE.rise}
                  width={TILE.width * PLATE.scale}
                  depth={PLATE.depth}
                  top="var(--color-machine-top)"
                  left="var(--color-machine-left)"
                  right="var(--color-machine-right)"
                />
                {warp && (
                  <polygon
                    points={blockFaces(x, y - 1, TILE.width * DISH, 0).top}
                    style={{ fill: 'var(--color-machine-dish)' }}
                  />
                )}
              </>
            )}
            {icy && (
              <polygon
                points={spotPoints(x, y, GLOSS_SPOTS)}
                style={{ fill: 'var(--color-ice-gloss)' }}
              />
            )}
            {frost > 0 && (
              <polygon
                points={blockFaces(x, y, TILE.width, 0).top}
                style={{ fill: 'var(--color-ice-gloss)', opacity: frost * FROST_OPACITY }}
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
            {goal && (
              <>
                <polygon
                  points={blockFaces(x, y + HOLE.wall, TILE.width * HOLE.scale, 0).top}
                  style={{ fill: darken('goal', 16) }}
                />
                <polygon
                  points={blockFaces(x, y + 1, TILE.width * HOLE.scale, 0).top}
                  style={{ fill: darken('goal', 36) }}
                />
              </>
            )}
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
            top="var(--color-machine-frame-top)"
            left="var(--color-machine-frame-left)"
            right="var(--color-machine-frame-right)"
          />
          <BoardBlock
            x={x}
            y={y - doorDepth - PLATE.rise}
            width={TILE.width * PLATE.scale}
            depth={PLATE.depth}
            top="var(--color-machine-top)"
            left="var(--color-machine-left)"
            right="var(--color-machine-right)"
          />
        </>
      )}
      {box && (
        <g style={fade}>
          <BoardBox x={x} y={y - TILE.layer} />
        </g>
      )}
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
