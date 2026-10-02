import BoardBlock from './BoardBlock'
import { PLATE, shade } from './view'
import { TILE } from '@/game/iso'

const SWITCH_SCALE = 0.66

interface BoardSwitchProps {
  x: number
  y: number
  entity: 'switch' | 'door'
  switchDepth: number
  doorDepth: number
}

const BoardSwitch = ({ x, y, entity, switchDepth, doorDepth }: BoardSwitchProps) => (
  <>
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
  </>
)

export default BoardSwitch
