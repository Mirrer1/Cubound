import BoardBlock from './BoardBlock'
import { TRAM, blend, nightTone } from './view'
import { TILE, blockFaces, isoDelta } from '@/game/iso'

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
  const edge = TRAM.deck / 2
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
  dim?: number | null // 어둠에서 상자처럼 한 색으로 칠할 어둠 값, 막은 발판 모양만큼 비움
}

const BoardTram = ({ x, y, depth, dx, dy, dim = null }: BoardTramProps) => {
  const tone = (color: string) => nightTone(color, dim)
  return (
    <g>
      <polygon
        points={blockFaces(x, y + depth, TILE.width * SHADOW, 0).top}
        style={{ fill: tone('var(--color-tram-shadow)') }}
      />
      <BoardBlock
        x={x}
        y={y + TRAM.drop}
        width={TILE.width * TRAM.skirt}
        depth={depth - TRAM.drop}
        top={tone('var(--color-tram-skirt)')}
        left={tone('var(--color-tram-skirt)')}
        right={tone(blend('var(--color-tram-skirt)', 'white', 0.12))}
      />
      <BoardBlock
        x={x}
        y={y}
        width={TILE.width * TRAM.deck}
        depth={TRAM.thickness}
        top={tone('var(--color-tram-top)')}
        left={tone('var(--color-tram-left)')}
        right={tone('var(--color-tram-right)')}
      />
      <polygon
        points={isoPoints(x, y, noseSpots(dx, dy))}
        style={{ fill: tone('var(--color-tram-nose)') }}
      />
    </g>
  )
}

export default BoardTram
