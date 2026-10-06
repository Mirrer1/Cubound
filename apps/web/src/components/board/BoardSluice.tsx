import BoardBlock from './BoardBlock'
import { TAP, blend, channelPoints, shade, tapParts } from './view'
import { TILE, blockFaces } from '@/game/iso'
import { useLoop } from '@/hooks/useLoop'

type BoardSluiceProps =
  | {
      part: 'plate'
      x: number
      y: number // 칸 윗면 중심
      depth: number // 판 두께 px
      open: number // 꼭지가 열린 정도 0~1
    }
  | {
      part: 'tap'
      x: number
      y: number
      open: number // 꼭지가 열린 정도 0~1
      turn: number // 바퀴가 돈 정도 0~1
    }
  | {
      part: 'channel'
      x: number
      y: number
      axis: 'x' | 'y'
      flow: number // 홈에 물이 흐르는 정도 0~1
    }

const TOOL = {
  top: shade('tool', 'top'),
  left: shade('tool', 'left'),
  right: shade('tool', 'right'),
}

// 물줄기 안을 흘러내리는 물방울과 떨어진 자리에 퍼지는 고리
const DRIP: Keyframe[] = [
  { transform: 'translateY(0px)', opacity: 0 },
  { opacity: 1, offset: 0.2 },
  { transform: `translateY(${TAP.streamTop - TAP.drip}px)`, opacity: 0 },
]
const SPLASH: Keyframe[] = [
  { transform: 'scale(0.3)', opacity: 0.9 },
  { transform: 'scale(1)', opacity: 0 },
]

const BoardSluice = (props: BoardSluiceProps) => {
  const { x, y } = props
  const tap = props.part === 'tap' ? tapParts(x, y, props.open, props.turn) : null
  const drip = useLoop(DRIP, TAP.dripCycle)
  const splash = useLoop(SPLASH, TAP.dripCycle * 2)
  const channel = props.part === 'channel' ? channelPoints(x, y, props.axis) : null
  const drop = props.part === 'plate' ? TAP.poolDrop * (1 - props.open) : 0

  return (
    <>
      {props.part === 'plate' && (
        <>
          <polygon
            points={blockFaces(x, y, TILE.width * TAP.pool, 0).top}
            style={{ fill: 'var(--color-water-2)' }}
          />
          <polygon
            points={
              blockFaces(
                x,
                y + drop,
                TILE.width * TAP.pool * (1 - TAP.poolRim * (1 - props.open)),
                0,
              ).top
            }
            style={{
              fill: blend('var(--color-water-1)', 'var(--color-water-reflect)', 0.5 * props.open),
            }}
          />
          <BoardBlock
            x={x}
            y={y + drop - props.depth}
            width={TILE.width * TAP.plate}
            depth={props.depth}
            {...TOOL}
          />
        </>
      )}
      {props.part === 'tap' && tap && (
        <>
          <g opacity={props.open}>
            <polygon points={tap.puddle} style={{ fill: 'var(--color-level-stream)' }} />
            <polygon points={tap.puddleInner} style={{ fill: 'var(--color-level-puddle-inner)' }} />
          </g>
          <BoardBlock {...tap.post} {...TOOL} />
          <polygon points={tap.spout} style={{ fill: TOOL.right }} />
          <g opacity={props.open}>
            <polygon points={tap.stream} style={{ fill: 'var(--color-level-stream)' }} />
            <polygon points={tap.streamCore} style={{ fill: 'var(--color-water-reflect)' }} />
            <polygon ref={drip} points={tap.drip} style={{ fill: 'var(--color-water-reflect)' }} />
            <polygon
              ref={splash}
              points={tap.puddleInner}
              style={{
                fill: 'none',
                stroke: 'var(--color-water-reflect)',
                strokeWidth: 0.8,
                transformOrigin: `${tap.mouth.x}px ${tap.mouth.y}px`,
              }}
            />
          </g>
          <BoardBlock {...tap.wheel} {...TOOL} />
          <g opacity={props.open}>
            <BoardBlock
              {...tap.wheel}
              depth={0}
              top="var(--color-level-wheel-open)"
              left="none"
              right="none"
            />
          </g>
          <polygon points={tap.slot} opacity={1 - props.open} style={{ fill: TOOL.left }} />
          <polygon
            points={tap.slot}
            opacity={props.open}
            style={{ fill: 'var(--color-level-wheel-slot)' }}
          />
        </>
      )}
      {props.part === 'channel' && channel && (
        <>
          <polygon points={channel.groove} style={{ fill: 'var(--color-lock-channel)' }} />
          <g opacity={props.flow}>
            <polygon points={channel.groove} style={{ fill: 'var(--color-lock-channel-flow)' }} />
            <polygon points={channel.flow} style={{ fill: 'var(--color-water-reflect)' }} />
          </g>
        </>
      )}
    </>
  )
}

export default BoardSluice
