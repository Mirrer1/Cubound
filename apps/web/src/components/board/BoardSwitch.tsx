import BoardBlock from './BoardBlock'
import { PLATE, nightTone, shade, veilMiddle } from './view'
import { TILE } from '@/game/iso'

const SWITCH_SCALE = 0.66

interface BoardSwitchProps {
  x: number
  y: number
  entity: 'switch' | 'door'
  switchDepth: number
  doorDepth: number
  grid?: number[] | null // 어둠 칸의 윗면 빛 지도
}

// 어둠에서 스위치와 문은 상자처럼 칸 가운데 값 한 색, 줄무늬(빛 층)는 바닥만
const BoardSwitch = ({ x, y, entity, switchDepth, doorDepth, grid = null }: BoardSwitchProps) => {
  const dim = grid ? veilMiddle(grid) : null
  return (
    <>
      {entity === 'switch' && (
        <BoardBlock
          x={x}
          y={y - switchDepth}
          width={TILE.width * SWITCH_SCALE}
          depth={switchDepth}
          top={nightTone(shade('tool', 'top'), dim)}
          left={nightTone(shade('tool', 'left'), dim)}
          right={nightTone(shade('tool', 'right'), dim)}
        />
      )}
      {entity === 'door' && (
        <>
          <BoardBlock
            x={x}
            y={y - doorDepth}
            width={TILE.width}
            depth={doorDepth}
            top={nightTone('var(--color-machine-frame-top)', dim)}
            left={nightTone('var(--color-machine-frame-left)', dim)}
            right={nightTone('var(--color-machine-frame-right)', dim)}
          />
          <BoardBlock
            x={x}
            y={y - doorDepth - PLATE.rise}
            width={TILE.width * PLATE.scale}
            depth={PLATE.depth}
            top={nightTone('var(--color-machine-top)', dim)}
            left={nightTone('var(--color-machine-left)', dim)}
            right={nightTone('var(--color-machine-right)', dim)}
          />
        </>
      )}
    </>
  )
}

export default BoardSwitch
