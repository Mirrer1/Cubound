import { useMemo } from 'react'

import BoardBlock from './BoardBlock'
import BoardTether from './BoardTether'
import {
  COLLAR,
  CUBE,
  IDLE_RIPPLE,
  bankPoints,
  rippleLoop,
  shade,
  surfaceRise,
  waterTone,
} from './view'
import { TILE, blockFaces, isoDelta } from '@/game/iso'
import { useLoop } from '@/hooks/useLoop'

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
      idle: number // 잔물결 차례, -1이면 안 이는 칸
      idleCycle: number // 한 칸의 잔물결 한 바퀴 ms
      range: number // 갈 수 있는 범위 칸의 큐브가 탄 정도, -1이면 범위 밖
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
  const idle = props.part === 'surface' ? props.idle : -1
  const cycle = props.part === 'surface' ? props.idleCycle : IDLE_RIPPLE.life * 2
  const outer = useMemo(() => rippleLoop(cycle, false), [cycle])
  const inner = useMemo(() => rippleLoop(cycle, true), [cycle])
  const delay = Math.max(0, idle) * IDLE_RIPPLE.gap
  const outerRipple = useLoop(outer, cycle, delay)
  const innerRipple = useLoop(inner, cycle, delay)
  const spot = isoDelta(IDLE_RIPPLE.at.u, IDLE_RIPPLE.at.v)
  const rx = x + spot.x
  const ry = surface + spot.y
  const origin = { transformOrigin: `${rx}px ${ry}px` }

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
      {props.range >= 0 && <BoardTether part="range" x={x} y={surface} active={props.range} />}
      {idle >= 0 && (
        <>
          <polygon
            ref={outerRipple}
            opacity={0}
            points={blockFaces(rx, ry, TILE.width * IDLE_RIPPLE.to, 0).top}
            style={{ ...REFLECT, ...origin }}
          />
          <polygon
            ref={innerRipple}
            opacity={0}
            points={blockFaces(rx, ry, TILE.width * (IDLE_RIPPLE.to - IDLE_RIPPLE.width), 0).top}
            style={{ fill: tone, ...origin }}
          />
        </>
      )}
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
