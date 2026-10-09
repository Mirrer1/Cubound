import { useEffect, useMemo, useRef } from 'react'

import { AMBIENT, type AmbientKind, type AmbientShape, MUD, ambientLoops } from './view'
import { TILE, blockFaces } from '@/game/iso'
import { useLoop } from '@/hooks/useLoop'

const LIGHT = { fill: 'var(--color-amb-light)' }
const MUD_FILL = { fill: 'var(--color-amb-mud)' }

// 짝 칸 틀 빛 테 두께 px, 칸 폭 배수 테 폭을 비스듬한 변에 수직으로 잰 값
const RIM_STROKE = ((TILE.width * AMBIENT.warp.rim) / 2) * Math.sin(Math.atan(0.5))

// 큐브가 옆 칸에 온 나비가 날아가는 ms, 찬 김이 옅어지는 ms
const FLEE = 600
const FADE = 300

interface AmbientPieceProps {
  shape: AmbientShape
  x: number
  y: number
  keyframes: Keyframe[]
  cycle: number
  delay: number
}

const AmbientPiece = ({ shape, x, y, keyframes, cycle, delay }: AmbientPieceProps) => {
  const loop = useLoop(keyframes, cycle, delay)
  const { dish, ring, rim } = AMBIENT.warp
  const { wing, height } = AMBIENT.butterfly
  const mudY = y + MUD.drop
  const origin = { transformOrigin: `${x}px ${y}px` }
  const mudOrigin = { transformOrigin: `${x}px ${mudY}px` }

  return shape === 'mote' ? (
    <circle ref={loop} cx={x} cy={y} r={AMBIENT.mote.size} opacity={0} style={LIGHT} />
  ) : shape === 'dish' ? (
    <polygon
      ref={loop}
      points={blockFaces(x, y - 1, TILE.width * dish, 0).top}
      opacity={0}
      style={LIGHT}
    />
  ) : shape === 'ring' ? (
    <polygon
      ref={loop}
      points={blockFaces(x, y, TILE.width * (ring - rim / 2), 0).top}
      opacity={0}
      fill="none"
      stroke="var(--color-amb-light)"
      strokeWidth={RIM_STROKE}
      vectorEffect="non-scaling-stroke"
      style={origin}
    />
  ) : shape === 'bubble' ? (
    <circle
      ref={loop}
      cx={x}
      cy={mudY}
      r={AMBIENT.bubble.size}
      opacity={0}
      style={{ ...MUD_FILL, ...mudOrigin }}
    />
  ) : shape === 'disk' ? (
    <ellipse
      ref={loop}
      cx={x}
      cy={mudY}
      rx={AMBIENT.bubble.disk}
      ry={AMBIENT.bubble.disk / 2}
      opacity={0}
      style={{ ...MUD_FILL, ...mudOrigin }}
    />
  ) : shape === 'spore' ? (
    <circle
      ref={loop}
      cx={x}
      cy={y}
      r={AMBIENT.spore.size}
      opacity={0}
      style={{ fill: 'var(--color-amb-spore)' }}
    />
  ) : shape === 'dust' ? (
    <polygon
      ref={loop}
      points={blockFaces(x, y, TILE.width * AMBIENT.ash.dust, 0).top}
      opacity={0}
      style={{ fill: 'var(--color-amb-ash-dust)', ...origin }}
    />
  ) : shape === 'flake' ? (
    <ellipse
      ref={loop}
      cx={x}
      cy={y}
      rx={AMBIENT.ash.flake.rx}
      ry={AMBIENT.ash.flake.ry}
      opacity={0}
      style={{ fill: 'var(--color-amb-ash)', ...origin }}
    />
  ) : shape === 'smoke' ? (
    <ellipse
      ref={loop}
      cx={x}
      cy={y}
      rx={AMBIENT.emberSmoke.rx}
      ry={AMBIENT.emberSmoke.ry}
      opacity={0}
      style={{ fill: 'var(--color-amb-ember-smoke)', ...origin }}
    />
  ) : shape === 'wisp' || shape === 'sheetLeft' || shape === 'sheetRight' ? (
    <ellipse
      ref={loop}
      cx={x}
      cy={y}
      rx={shape === 'wisp' ? AMBIENT.mist.wisp.rx : AMBIENT.mist.sheet.rx}
      ry={shape === 'wisp' ? AMBIENT.mist.wisp.ry : AMBIENT.mist.sheet.ry}
      opacity={0}
      style={{ fill: 'var(--color-amb-mist)', ...origin }}
    />
  ) : (
    <ellipse
      ref={loop}
      cx={shape === 'wingLeft' ? x - wing : x + wing}
      cy={y}
      rx={wing}
      ry={height}
      opacity={0}
      style={{
        fill: shape === 'wingLeft' ? 'var(--color-amb-wing)' : 'var(--color-amb-wing-2)',
        ...origin,
      }}
    />
  )
}

interface BoardAmbientProps {
  kind: AmbientKind
  x: number
  y: number // 칸 윗면 중심
  at: number // 바퀴 안에서 시작하는 ms
  cycle: number
  leave: boolean // 거두는 때
}

const BoardAmbient = ({ kind, x, y, at, cycle, leave }: BoardAmbientProps) => {
  const loops = useMemo(() => ambientLoops(kind, cycle), [kind, cycle])
  const group = useRef<SVGGElement>(null)
  const fled = useRef(false)

  // 왼쪽 위로 날아가는 나비, 옅어지는 찬 김과 불씨 칸 연기
  useEffect(() => {
    if (
      (kind !== 'butterfly' && kind !== 'mist' && kind !== 'emberSmoke') ||
      !leave ||
      fled.current ||
      !group.current
    )
      return
    fled.current = true
    group.current.animate(
      kind === 'butterfly'
        ? [
            { opacity: 1, transform: 'translate(0px, 0px)' },
            { opacity: 0, transform: 'translate(-34px, -25px)' },
          ]
        : [{ opacity: 1 }, { opacity: 0 }],
      { duration: kind === 'butterfly' ? FLEE : FADE, easing: 'ease-in', fill: 'forwards' },
    )
  }, [kind, leave])

  return (
    <g ref={group}>
      {loops.map((loop, i) => (
        <AmbientPiece
          key={i}
          shape={loop.shape}
          x={x}
          y={y}
          keyframes={loop.keyframes}
          cycle={cycle}
          delay={at + loop.delay}
        />
      ))}
    </g>
  )
}

export default BoardAmbient
