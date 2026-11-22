import BoardBlock from './BoardBlock'
import { PLATE, nightTone, veilMiddle } from './view'
import { TILE, blockFaces } from '@/game/iso'

// 판보다 낮은 자리에 한 장 더 얹어 우묵한 짝 칸의 면
const DISH = 0.46

interface BoardPlateProps {
  x: number
  y: number
  warp: boolean
  grid?: number[] | null // 어둠 칸의 윗면 빛 지도
}

// 어둠에서 짝 칸과 엘리베이터 판은 상자처럼 칸 가운데 값 한 색, 줄무늬(빛 층)는 바닥만
const BoardPlate = ({ x, y, warp, grid = null }: BoardPlateProps) => {
  const dim = grid ? veilMiddle(grid) : null
  return (
    <>
      <BoardBlock
        x={x}
        y={y - PLATE.rise}
        width={TILE.width * PLATE.scale}
        depth={PLATE.depth}
        top={nightTone('var(--color-machine-top)', dim)}
        left={nightTone('var(--color-machine-left)', dim)}
        right={nightTone('var(--color-machine-right)', dim)}
      />
      {warp && (
        <polygon
          points={blockFaces(x, y - 1, TILE.width * DISH, 0).top}
          style={{ fill: nightTone('var(--color-machine-dish)', dim) }}
        />
      )}
    </>
  )
}

export default BoardPlate
