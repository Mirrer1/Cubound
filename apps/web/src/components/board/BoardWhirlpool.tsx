import BoardWater from './BoardWater'
import type { WhirlBoxFrame } from './frame'
import {
  BOWL,
  BOWL_SHAPES,
  cellMatrix,
  ghostWidths,
  lanePoints,
  ringPath,
  surfaceRise,
} from './view'
import { TILE, blockFaces } from '@/game/iso'

const REFLECT = { fill: 'var(--color-water-reflect)' }

type BoardWhirlpoolProps =
  | {
      part: 'eye' | 'ghost'
      x: number
      y: number // 물 바닥 칸 윗면 중심
      depth: number // 물 깊이 층 수
      opacity: number
    }
  | {
      part: 'lane'
      x: number
      y: number
      depth: number
      axis: 'x' | 'y'
      opacity: number
    }
  | ({ part: 'boat' } & WhirlBoxFrame)

const BoardWhirlpool = (props: BoardWhirlpoolProps) => {
  const surface = props.part === 'boat' ? props.y : props.y - surfaceRise(props.depth)
  const lane = props.part === 'lane' ? lanePoints(props.x, surface, props.axis) : null

  return props.part === 'boat' ? (
    <>
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
      <g opacity={props.opacity}>
        <BoardWater part="box" x={props.x} y={props.y} shown={props.shown} />
      </g>
    </>
  ) : props.part === 'eye' ? (
    <g opacity={props.opacity}>
      <polygon
        points={blockFaces(props.x, surface, TILE.width * BOWL.plate, 0).top}
        style={{ fill: 'var(--color-water-1)' }}
      />
      <g transform={cellMatrix(props.x, surface)}>
        <g className="whirl-spin">
          {BOWL_SHAPES.map((shape) => (
            <polygon key={shape.points} points={shape.points} style={{ fill: shape.fill }} />
          ))}
        </g>
      </g>
    </g>
  ) : props.part === 'ghost' ? (
    <g opacity={props.opacity}>
      <polygon
        points={blockFaces(props.x, surface, ghostWidths.outer, 0).top}
        style={{ fill: 'var(--color-whirl-plug-ghost)' }}
      />
      <polygon
        points={blockFaces(props.x, surface, ghostWidths.inner, 0).top}
        style={{ fill: 'var(--color-whirl-plug-ghost-inner)' }}
      />
    </g>
  ) : (
    lane && (
      <g opacity={props.opacity}>
        <polygon points={lane.band} style={{ fill: 'var(--color-whirl-pull)' }} />
        <polygon points={lane.edge} style={{ fill: 'var(--color-whirl-pull-edge)' }} />
      </g>
    )
  )
}

export default BoardWhirlpool
