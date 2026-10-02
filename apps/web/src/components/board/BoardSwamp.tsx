import BoardBlock from './BoardBlock'
import { MUD, darken } from './view'
import { TILE, blockFaces, isoDelta } from '@/game/iso'

// 진흙 위에 앉은 낮은 덩이, 자리는 칸 가운데에서 잰 칸 단위 거리
const LUMP = { scale: 0.09, depth: 2.5 }
const LUMP_SPOTS: [number, number][] = [
  [-0.2, 0.14],
  [0.17, -0.12],
  [0.06, 0.22],
]

// 안쪽 마름모의 뒤 모서리에서 진흙 면까지 내려오는 늪 우묵면의 뒤쪽 두 벽
const mudWallPoints = (x: number, y: number, side: number) => {
  const hw = ((TILE.width * MUD.scale) / 2) * side
  const hh = (TILE.height * MUD.scale) / 2
  return `${x - hw},${y} ${x},${y - hh} ${x},${y - hh + MUD.drop} ${x - hw},${y + MUD.drop}`
}

interface BoardSwampProps {
  x: number
  y: number
  mudY: number
  swamp: boolean
  swampFilled: number // 상자가 가라앉아 메워진 정도 0~1
  swampDeep: number // 잠긴 정도 0~1, 0이면 잠긴 것 없는 칸
  collar: number
}

const BoardSwamp = ({ x, y, mudY, swamp, swampFilled, swampDeep, collar }: BoardSwampProps) => (
  <>
    {swamp && (
      <g opacity={1 - swampFilled}>
        <polygon points={mudWallPoints(x, y, 1)} style={{ fill: 'var(--color-swamp-wall-left)' }} />
        <polygon points={mudWallPoints(x, y, -1)} style={{ fill: darken('swamp-wall-left', 10) }} />
        <polygon
          points={blockFaces(x, mudY, TILE.width * MUD.scale, 0).top}
          style={{ fill: 'var(--color-swamp-mud)' }}
        />
        <g opacity={1 - swampDeep}>
          {LUMP_SPOTS.map(([u, v]) => {
            const d = isoDelta(u, v)
            return (
              <BoardBlock
                key={`${u},${v}`}
                x={x + d.x}
                y={mudY + d.y - LUMP.depth}
                width={TILE.width * LUMP.scale}
                depth={LUMP.depth}
                top="var(--color-swamp-lump)"
                left={darken('swamp-lump', 18)}
                right={darken('swamp-lump', 8)}
              />
            )
          })}
        </g>
        {collar > 0 && (
          <polygon
            points={blockFaces(x, mudY, TILE.width * collar, 0).top}
            style={{ fill: 'var(--color-swamp-collar)' }}
          />
        )}
      </g>
    )}
    {swampFilled > 0 && (
      <g opacity={swampFilled}>
        <polygon
          points={blockFaces(x, y, TILE.width * MUD.scale, 0).top}
          style={{ fill: 'var(--color-swamp-filled)' }}
        />
      </g>
    )}
  </>
)

export default BoardSwamp
