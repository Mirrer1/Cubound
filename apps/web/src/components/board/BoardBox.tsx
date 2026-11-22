import BoardBlock from './BoardBlock'
import { CUBE, nightTone, shade } from './view'
import { TILE } from '@/game/iso'

interface BoardBoxProps {
  x: number
  y: number // 상자 윗면 중심
  dim?: number | null // 어둠 칸에서 덮개 대신 색을 칠할 칸 어둠 값, --veil과 곱함
}

const BoardBox = ({ x, y, dim = null }: BoardBoxProps) => {
  return (
    <BoardBlock
      x={x}
      y={y}
      width={TILE.width * CUBE}
      depth={TILE.layer}
      top={nightTone(shade('tool', 'top'), dim)}
      left={nightTone(shade('tool', 'left'), dim)}
      right={nightTone(shade('tool', 'right'), dim)}
    />
  )
}

export default BoardBox
