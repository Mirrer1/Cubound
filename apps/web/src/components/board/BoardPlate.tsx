import BoardBlock from './BoardBlock'
import { PLATE } from './view'
import { TILE, blockFaces } from '@/game/iso'

// 판보다 낮은 자리에 한 장 더 얹어 우묵한 짝 칸의 면
const DISH = 0.46

interface BoardPlateProps {
  x: number
  y: number
  warp: boolean
}

const BoardPlate = ({ x, y, warp }: BoardPlateProps) => (
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
)

export default BoardPlate
