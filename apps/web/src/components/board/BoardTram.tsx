import BoardBlock from './BoardBlock'
import { blend } from './shade'
import { TILE, blockFaces, isoDelta } from '@/game/iso'

// 칸 크기에 대한 비율. 틀 없이 칸보다 작은 판이라 승강 발판과 구별된다
const DECK = { scale: 0.92, thickness: 9 }
const SKIRT = { scale: 0.62, drop: 6 }
const SHADOW = 0.56
// 진행 방향 모서리에 붙는 범퍼의 폭
const NOSE = 9 / (TILE.width / 2)

const isoPoints = (x: number, y: number, spots: [number, number][]) =>
  spots
    .map(([u, v]) => {
      const d = isoDelta(u, v)
      return `${x + d.x},${y + d.y}`
    })
    .join(' ')

const noseSpots = (dx: number, dy: number): [number, number][] => {
  const edge = DECK.scale / 2
  const inner = edge - NOSE
  return dx !== 0
    ? [
        [inner * dx, -edge],
        [edge * dx, -edge],
        [edge * dx, edge],
        [inner * dx, edge],
      ]
    : [
        [-edge, inner * dy],
        [-edge, edge * dy],
        [edge, edge * dy],
        [edge, inner * dy],
      ]
}

interface BoardTramProps {
  x: number
  y: number // 판 윗면 중심
  depth: number // 판 윗면에서 구덩이 바닥까지 화면 거리
  dx: number // 코가 붙는 모서리 방향
  dy: number
}

const BoardTram = ({ x, y, depth, dx, dy }: BoardTramProps) => {
  return (
    <g>
      <polygon
        points={blockFaces(x, y + depth, TILE.width * SHADOW, 0).top}
        style={{ fill: 'var(--color-tram-shadow)' }}
      />
      <BoardBlock
        x={x}
        y={y + SKIRT.drop}
        width={TILE.width * SKIRT.scale}
        depth={depth - SKIRT.drop}
        top="var(--color-tram-skirt)"
        left="var(--color-tram-skirt)"
        right={blend('var(--color-tram-skirt)', 'white', 0.12)}
      />
      <BoardBlock
        x={x}
        y={y}
        width={TILE.width * DECK.scale}
        depth={DECK.thickness}
        top="var(--color-tram-top)"
        left="var(--color-tram-left)"
        right="var(--color-tram-right)"
      />
      <polygon
        points={isoPoints(x, y, noseSpots(dx, dy))}
        style={{ fill: 'var(--color-tram-nose)' }}
      />
    </g>
  )
}

export default BoardTram
