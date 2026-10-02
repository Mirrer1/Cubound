import BoardBlock from './BoardBlock'
import { COLLAR, CUBE, bankPoints, shade, surfaceRise, waterTone } from './view'
import { TILE, blockFaces } from '@/game/iso'

// 고리 테 폭, 칸 폭 배수
const RING_WIDTH = 0.07

const REFLECT = { fill: 'var(--color-water-reflect)' }

type BoardWaterProps =
  | {
      part: 'surface'
      x: number
      y: number // 물 바닥 칸 윗면 중심
      depth: number // 물 깊이 층 수
      bankX: boolean
      bankY: boolean
      sideLeft: boolean
      sideRight: boolean
      ring: number // 퍼지는 고리 크기, 0이면 고리 없음
      ringOpacity: number
    }
  | {
      part: 'box'
      x: number
      y: number // 상자 윗면 중심
      shown: number // 수면 위로 보이는 높이 px
    }

const BoardWater = (props: BoardWaterProps) => {
  const { x } = props
  const rise = props.part === 'surface' ? surfaceRise(props.depth) : 0
  const surface = props.y - rise
  const tone = props.part === 'surface' ? waterTone(props.depth) : ''

  return props.part === 'box' ? (
    <>
      {props.shown < TILE.layer && (
        <polygon
          points={blockFaces(x, props.y + props.shown, TILE.width * CUBE * COLLAR, 0).top}
          style={REFLECT}
        />
      )}
      <BoardBlock
        x={x}
        y={props.y}
        width={TILE.width * CUBE}
        depth={props.shown}
        top={shade('tool', 'top')}
        left={shade('tool', 'left')}
        right={shade('tool', 'right')}
      />
    </>
  ) : (
    <>
      <BoardBlock
        x={x}
        y={surface}
        width={TILE.width}
        depth={rise}
        top={tone}
        left={props.sideLeft ? 'var(--color-water-left)' : 'none'}
        right={props.sideRight ? 'var(--color-water-right)' : 'none'}
      />
      {props.bankX && <polygon points={bankPoints(x, surface, 'x')} style={REFLECT} />}
      {props.bankY && <polygon points={bankPoints(x, surface, 'y')} style={REFLECT} />}
      {props.ring > 0 && (
        <g opacity={props.ringOpacity}>
          <polygon
            points={blockFaces(x, surface, TILE.width * props.ring, 0).top}
            style={REFLECT}
          />
          <polygon
            points={blockFaces(x, surface, TILE.width * (props.ring - RING_WIDTH), 0).top}
            style={{ fill: tone }}
          />
        </g>
      )}
    </>
  )
}

export default BoardWater
