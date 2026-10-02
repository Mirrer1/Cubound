import BoardBlock from './BoardBlock'
import { mushroomPose } from './frame'
import { capColors } from './view'
import { TILE, blockFaces } from '@/game/iso'

// 버섯은 짧은 대 위에 넓은 갓을 얹고 머리 판을 하나 더 올린 모양이다. 모습은 frame이 정한다
const STEM_SCALE = 0.2
const CROWN_SCALE = 0.6
// 대 밑에 깔리는 바닥 자국
const MUSHROOM_SHADOW = 0.4

interface BoardMushroomProps {
  x: number
  y: number
  press: number // 갓이 눌린 정도. -1은 펴짐, 0은 평소, 2는 큐브가 올라섬
  wither: number // 시든 정도 0~1
}

const BoardMushroom = ({ x, y, press, wither }: BoardMushroomProps) => {
  const cap = mushroomPose(press, wither)
  const capColor = capColors(wither)

  return (
    <>
      <polygon
        points={blockFaces(x, y, TILE.width * MUSHROOM_SHADOW, 0).top}
        style={{ fill: 'var(--color-mushroom-shadow)' }}
      />
      <BoardBlock
        x={x}
        y={y - cap.stem}
        width={TILE.width * STEM_SCALE}
        depth={cap.stem}
        top={capColor.stem}
        left="var(--color-mushroom-stem-left)"
        right="var(--color-mushroom-stem-right)"
      />
      <BoardBlock
        x={x}
        y={y - cap.stem - cap.thick}
        width={TILE.width * cap.cap}
        depth={cap.thick}
        top={capColor.top}
        left={capColor.left}
        right={capColor.right}
      />
      {cap.crown > 0 && (
        <BoardBlock
          x={x}
          y={y - cap.stem - cap.thick - cap.crown}
          width={TILE.width * cap.cap * CROWN_SCALE}
          depth={cap.crown}
          top={capColor.crown}
          left={capColor.left}
          right={capColor.right}
        />
      )}
    </>
  )
}

export default BoardMushroom
