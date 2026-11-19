import BoardBlock from './BoardBlock'
import { CUBE, shade } from './view'
import { TILE } from '@/game/iso'

interface BoardBoxProps {
  x: number
  y: number // 상자 윗면 중심
  dim?: number | null // 어둠 칸에서 덮개 대신 색을 칠할 칸 어둠 값, --veil과 곱함
}

// 어둠 칸의 상자는 덮개 대신 색을 직접 어둡게, 덮개는 테두리가 반쯤 덮여 밝게 샘
const night = (color: string, dim: number | null) =>
  dim === null
    ? color
    : `color-mix(in srgb, var(--color-night) calc(var(--veil) * ${dim * 100}%), ${color})`

const BoardBox = ({ x, y, dim = null }: BoardBoxProps) => {
  return (
    <BoardBlock
      x={x}
      y={y}
      width={TILE.width * CUBE}
      depth={TILE.layer}
      top={night(shade('tool', 'top'), dim)}
      left={night(shade('tool', 'left'), dim)}
      right={night(shade('tool', 'right'), dim)}
    />
  )
}

export default BoardBox
