import type { CSSProperties, ReactNode } from 'react'

import BoardBlock from './BoardBlock'
import BoardBox from './BoardBox'
import { Embers, Flicker, Pool } from './BoardFire'
import {
  BOX_ASH,
  BRAZIER,
  BRAZIER_COALS,
  BRAZIER_CORES,
  CUBE,
  CUBE_HEAT,
  DIP_LOOP,
  DIP_MS,
  boxBurn,
  boxHeat,
  boxHeatBands,
  boxTone,
  fireStyle,
  glowOf,
  isoPoint,
  lumpTops,
  wallCrumble,
} from './view'
import { TILE, blockFaces } from '@/game/iso'
import { useLoop } from '@/hooks/useLoop'

const HOT = { fill: 'var(--color-heat-hot)' }
const CORE = { fill: 'var(--color-heat-core)' }

const plate = (x: number, y: number, scale: number) => blockFaces(x, y, TILE.width * scale, 0).top

const spark = (x: number, y: number, size: number) =>
  `${x},${y - size} ${x + size * 0.7},${y} ${x},${y + size} ${x - size * 0.7},${y}`

interface BowlProps {
  part: 'bowl'
  x: number
  y: number // 칸 윗면 중심
  flash: number
  covered: number
}

interface CubePoolProps {
  part: 'cubePool'
  x: number
  y: number // 큐브가 선 바닥 중심
  strength: number
  dip: number
}

interface CubeGlowProps {
  part: 'cubeGlow'
  x: number
  y: number // 큐브 윗면 중심
  bands: { points: string; opacity: number }[]
  strength: number
  dip: number
  spark: number
  last: number
}

interface BoxProps {
  part: 'box'
  x: number
  y: number // 상자 윗면 중심
  hint: number
  burn: number // 타는 진행도, -1이면 타지 않는 상자
}

type BoardBrazierProps = BowlProps | CubePoolProps | CubeGlowProps | BoxProps

interface DipProps {
  amp: number
  children: ReactNode
}

// 남은 수 1에서 약해졌다 돌아오는 큐브 빛
const Dip = ({ amp, children }: DipProps) => {
  const loop = useLoop(DIP_LOOP, DIP_MS)

  return (
    <g ref={loop} className="flame-dip" style={{ '--dip-amp': amp } as CSSProperties}>
      {children}
    </g>
  )
}

const Bowl = ({ x, y, flash, covered }: Omit<BowlProps, 'part'>) => {
  const top = y - BRAZIER.height
  const coal = top - 1

  return (
    <g>
      <Flicker opacity={1}>
        <Pool x={x} y={y} scale={1.6} opacity={0.16} />
      </Flicker>
      <BoardBlock
        x={x}
        y={top}
        width={TILE.width * BRAZIER.bowl}
        depth={BRAZIER.height}
        top="var(--color-stove-top)"
        left="var(--color-stove-left)"
        right="var(--color-stove-right)"
      />
      <polygon points={plate(x, top, BRAZIER.bed)} style={{ fill: 'var(--color-stove-coal)' }} />
      {BRAZIER_COALS.map(([u, v, s]) => {
        const p = isoPoint(x, top, u, v, 1)
        return <polygon key={`${u}-${v}`} points={plate(p.x, p.y, s)} style={HOT} />
      })}
      {BRAZIER_CORES.map(([u, v, s]) => {
        const p = isoPoint(x, top, u, v, 1.5)
        return <polygon key={`${u}-${v}`} points={plate(p.x, p.y, s)} style={CORE} />
      })}
      <Flicker opacity={1}>
        <Pool x={x} y={coal} scale={0.62} opacity={0.3} core />
      </Flicker>
      {flash > 0 && <Pool x={x} y={coal} scale={1.1} opacity={0.22 * flash} core />}
      {covered < 1 && (
        <Embers x={x} y={coal} count={4} top={BRAZIER.rise} every={450} opacity={1 - covered} />
      )}
    </g>
  )
}

const Box = ({ x, y, hint, burn }: Omit<BoxProps, 'part'>) => {
  const { heat, crumble } = boxBurn(burn)
  const look = boxHeat(hint, heat)
  const tone = boxTone(heat)
  const wall = wallCrumble(crumble)
  const glow = glowOf(heat)
  const bottom = y + TILE.layer
  const ash = lumpTops(
    x,
    bottom,
    BOX_ASH.map((l) => ({ ...l, height: l.height * (1 - 0.6 * wall.sink) })),
  )
  const style = fireStyle(false)

  return (
    <g>
      {look.poolOpacity > 0 && (
        <g opacity={wall.pile}>
          <Flicker opacity={1}>
            <Pool x={x} y={bottom} scale={look.pool} opacity={look.poolOpacity} />
          </Flicker>
        </g>
      )}
      {wall.pile > 0 && (
        <g opacity={wall.pile}>
          {heat > 0 ? (
            <BoardBlock
              x={x}
              y={y}
              width={TILE.width * CUBE}
              depth={TILE.layer}
              top={tone.top}
              left={tone.left}
              right={tone.right}
            />
          ) : (
            <BoardBox x={x} y={y} />
          )}
          {look.bandOpacity > 0 &&
            boxHeatBands(x, y, look.band).map((band, i) => (
              <polygon
                key={i}
                points={band.points}
                opacity={band.opacity * look.bandOpacity}
                style={HOT}
              />
            ))}
          {glow > 0 && (
            <Flicker opacity={glow}>
              <polygon points={plate(x, y, CUBE * 0.62)} opacity={0.7} style={HOT} />
              <polygon points={plate(x, y, CUBE * 0.34)} opacity={0.8} style={CORE} />
            </Flicker>
          )}
        </g>
      )}
      {wall.lumps > 0 && (
        <g opacity={wall.lumps}>
          {ash.map((l, i) => (
            <g key={i}>
              <BoardBlock
                x={l.top.x}
                y={l.top.y}
                width={TILE.width * l.scale}
                depth={l.height}
                top={l.ember ? 'var(--color-heat-top)' : 'var(--color-ash-top)'}
                left={l.ember ? 'var(--color-heat-left)' : 'var(--color-ash-left)'}
                right={l.ember ? 'var(--color-heat-right)' : 'var(--color-ash-right)'}
              />
              {l.ember && (
                <polygon
                  points={plate(l.top.x, l.top.y, l.scale * 0.42)}
                  opacity={0.55 * (1 - wall.sink)}
                  style={HOT}
                />
              )}
            </g>
          ))}
        </g>
      )}
      {glow > 0 && (
        <Embers
          x={x}
          y={wall.pile > 0 ? y : bottom - 10}
          count={2}
          top={style.rise}
          every={style.every}
          opacity={glow * (1 - crumble)}
        />
      )}
    </g>
  )
}

const BoardBrazier = (props: BoardBrazierProps) =>
  props.part === 'bowl' ? (
    <Bowl x={props.x} y={props.y} flash={props.flash} covered={props.covered} />
  ) : props.part === 'box' ? (
    <Box x={props.x} y={props.y} hint={props.hint} burn={props.burn} />
  ) : props.part === 'cubePool' ? (
    <Dip amp={props.dip}>
      <Pool
        x={props.x}
        y={props.y}
        scale={CUBE_HEAT.pool + CUBE_HEAT.poolGrow * props.strength}
        opacity={CUBE_HEAT.poolOpacity * props.strength}
      />
    </Dip>
  ) : (
    <g>
      <Dip amp={props.dip}>
        <Flicker opacity={CUBE_HEAT.bandOpacity * props.strength}>
          {props.bands.map((band, i) => (
            <polygon key={i} points={band.points} opacity={band.opacity} style={HOT} />
          ))}
        </Flicker>
      </Dip>
      {props.spark > 0 && (
        <Embers
          x={props.x}
          y={props.y}
          count={1}
          top={10}
          every={fireStyle(false).every}
          opacity={props.spark}
        />
      )}
      {props.last > 0 && (
        <polygon points={spark(props.x, props.y - 8, 1.4)} opacity={0.7 * props.last} style={HOT} />
      )}
    </g>
  )

export default BoardBrazier
