import BoardBlock from './BoardBlock'
import type { StoneFrame } from './frame'
import {
  COLLAR,
  CUBE,
  ICE,
  LOCKED,
  STONE,
  type StoneTone,
  WATER,
  blend,
  frostWidth,
  icePlate,
  ringPath,
  shade,
  stoneSteps,
} from './view'
import { TILE, blockFaces } from '@/game/iso'
import type { Direction } from '@/game/types'

const REFLECT = { fill: 'var(--color-water-reflect)' }

const TONE: Record<StoneTone, string> = {
  base: 'var(--color-ice-stone-top)',
  mid: 'var(--color-ice-stone-mid)',
  peak: 'var(--color-ice-stone-peak)',
}

type BoardIceStoneProps =
  | {
      part: 'plate'
      x: number
      y: number // 언 판 윗면 중심
      cover: number
      from: Direction
    }
  | ({ part: 'stone' } & Pick<
      StoneFrame,
      'x' | 'y' | 'scale' | 'cut' | 'slab' | 'bare' | 'frost' | 'opacity' | 'wake' | 'ring'
    >)
  | {
      part: 'boat'
      x: number
      y: number // 언 판 윗면 중심
      lock: number // 얼어붙은 정도
    }

const BoardIceStone = (props: BoardIceStoneProps) => {
  const plate = props.part === 'plate' ? icePlate(props.x, props.y, props.cover, props.from) : null

  return props.part === 'plate' ? (
    plate && (
      <>
        <polygon points={plate.left} style={{ fill: 'var(--color-ice-left)' }} />
        <polygon points={plate.right} style={{ fill: 'var(--color-ice-right)' }} />
        <polygon points={plate.top} style={{ fill: 'var(--color-ice-frozen)' }} />
      </>
    )
  ) : props.part === 'boat' ? (
    <>
      {props.lock < 1 && (
        <polygon
          points={blockFaces(props.x, props.y + ICE.slab, TILE.width * CUBE * COLLAR, 0).top}
          style={REFLECT}
          opacity={1 - props.lock}
        />
      )}
      {props.lock > 0 && (
        <g opacity={props.lock}>
          <polygon
            points={blockFaces(props.x, props.y, TILE.width * CUBE * LOCKED.crack, 0).top}
            style={{ fill: blend('var(--color-ice)', 'var(--color-ice-left)', 0.45) }}
          />
          <polygon
            points={blockFaces(props.x, props.y, TILE.width * CUBE * LOCKED.rim, 0).top}
            style={{ fill: 'var(--color-ice-gloss)' }}
          />
        </g>
      )}
      <BoardBlock
        x={props.x}
        y={props.y - ICE.below - (WATER.lip - ICE.below - LOCKED.shown) * props.lock}
        width={TILE.width * CUBE}
        depth={WATER.lip - (WATER.lip - LOCKED.shown) * props.lock}
        top={shade('tool', 'top')}
        left={shade('tool', 'left')}
        right={shade('tool', 'right')}
      />
    </>
  ) : (
    <g opacity={props.opacity}>
      {props.wake.map((w) => (
        <polygon
          key={w.width}
          points={blockFaces(w.x, w.y, w.width, 0).top}
          style={REFLECT}
          opacity={w.opacity}
        />
      ))}
      {props.ring && (
        <path
          d={ringPath(props.ring.x, props.ring.y, props.ring.size)}
          fillRule="evenodd"
          style={REFLECT}
          opacity={props.ring.opacity}
        />
      )}
      {props.frost > 0 && (
        <polygon
          points={blockFaces(props.x, props.y, TILE.width * frostWidth(props.frost), 0).top}
          style={{ fill: blend('var(--color-floor-top)', 'var(--color-ice)', 0.55) }}
          opacity={props.frost}
        />
      )}
      {props.slab > 0 && (
        <>
          {!props.bare && (
            <BoardBlock
              x={props.x}
              y={props.y}
              width={TILE.width * props.slab}
              depth={ICE.slab}
              top="var(--color-ice-frozen)"
              left="var(--color-ice-left)"
              right="var(--color-ice-right)"
            />
          )}
          <polygon
            points={
              blockFaces(
                props.x,
                props.y,
                TILE.width * (STONE.steps[0].width * props.scale + STONE.line),
                0,
              ).top
            }
            style={{ fill: blend('var(--color-ice)', 'var(--color-ice-left)', 0.7) }}
            opacity={Math.min(1, props.slab)}
          />
        </>
      )}
      {stoneSteps(props.x, props.y, props.cut, props.scale).map((step) => (
        <BoardBlock
          key={step.tone}
          x={step.x}
          y={step.y}
          width={step.width}
          depth={step.depth}
          top={TONE[step.tone]}
          left="var(--color-ice-stone-left)"
          right="var(--color-ice-stone-right)"
        />
      ))}
    </g>
  )
}

export default BoardIceStone
