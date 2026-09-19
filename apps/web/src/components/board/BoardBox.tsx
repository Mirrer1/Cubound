import BoardBlock from './BoardBlock'
import { CUBE } from './cube'
import { darken, shade } from './shade'
import { TILE, blockFaces } from '@/game/iso'

interface BoardBoxProps {
  x: number
  y: number // 상자 윗면 중심
}

const BoardBox = ({ x, y }: BoardBoxProps) => {
  return (
    <>
      <BoardBlock
        x={x}
        y={y}
        width={TILE.width * CUBE}
        depth={TILE.layer}
        top={shade('tool', 'top')}
        left={shade('tool', 'left')}
        right={shade('tool', 'right')}
      />
      <polygon
        points={blockFaces(x, y, TILE.width * CUBE * 0.52, 0).top}
        style={{ fill: darken('tool', 13) }}
      />
    </>
  )
}

export default BoardBox
