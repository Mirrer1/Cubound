import { type ReactNode, useMemo } from 'react'

import BoardBlock from './BoardBlock'
import type { FireLook } from './frame'
import {
  ASH_LUMPS,
  ASH_MARK,
  CHAR_WALL,
  EMBER_LIFE,
  EMBER_SPOTS,
  FLICKER,
  FLICKER_MS,
  blend,
  bridgePieces,
  charTone,
  emberKeyframes,
  fireStyle,
  glowOf,
  isoPoint,
  logQuads,
  lumpTops,
  pileLumps,
  wallCrumble,
} from './view'
import { TILE, blockFaces } from '@/game/iso'
import { useLoop } from '@/hooks/useLoop'

const HOT = { fill: 'var(--color-heat-hot)' }
const CORE = { fill: 'var(--color-heat-core)' }

// 바닥에 고이는 빛 세 겹의 크기와 진하기 비
const POOL = [
  [1, 0.35],
  [0.74, 0.6],
  [0.5, 1],
]

// 불씨 칸 돌 테와 재 바닥, 숯 한 덩이 칸 폭 배수와 높이 px
const SPARK = { rim: 0.6, bed: 0.48, glow: 0.34, coal: 0.2, coalHeight: 4, pool: 1.05, rise: 9 }

const plate = (x: number, y: number, scale: number) => blockFaces(x, y, TILE.width * scale, 0).top

const ashFaces = (ember: boolean) =>
  ember
    ? {
        top: 'var(--color-heat-top)',
        left: 'var(--color-heat-left)',
        right: 'var(--color-heat-right)',
      }
    : {
        top: 'var(--color-ash-top)',
        left: 'var(--color-ash-left)',
        right: 'var(--color-ash-right)',
      }

interface EmberProps {
  x: number
  y: number
  i: number
  top: number
  cycle: number
  every: number
}

const Ember = ({ x, y, i, top, cycle, every }: EmberProps) => {
  const keyframes = useMemo(() => emberKeyframes(top, cycle), [top, cycle])
  const loop = useLoop(keyframes, cycle, i * every)
  const size = i % 2 ? 1.2 : 1.5

  return (
    <polygon
      ref={loop}
      points={`${x},${y - size} ${x + size * 0.7},${y} ${x},${y + size} ${x - size * 0.7},${y}`}
      opacity={0}
      style={i % 2 ? HOT : CORE}
    />
  )
}

interface EmbersProps {
  x: number
  y: number // 불티가 나는 면 가운데
  count: number
  top: number
  every: number
  opacity: number
}

// 드문드문 오르는 작은 불티, 움직임 줄이기 설정은 제외
const Embers = ({ x, y, count, top, every, opacity }: EmbersProps) => {
  const cycle = Math.max(count * every, EMBER_LIFE + 100)
  const spots = EMBER_SPOTS.slice(0, count).map(([u, v]) => isoPoint(x, y, u, v, 3))

  return (
    <g opacity={opacity}>
      {spots.map((p, i) => (
        <Ember key={i} x={p.x} y={p.y} i={i} top={top} cycle={cycle} every={every} />
      ))}
    </g>
  )
}

interface FlickerProps {
  opacity: number
  children: ReactNode
}

// 2.4초 주기로 일렁이는 빛, 진하기는 바깥 묶음 몫
const Flicker = ({ opacity, children }: FlickerProps) => {
  const loop = useLoop(FLICKER, FLICKER_MS)

  return (
    <g opacity={opacity}>
      <g ref={loop}>{children}</g>
    </g>
  )
}

interface PoolProps {
  x: number
  y: number
  scale: number
  opacity: number
  core?: boolean
}

const Pool = ({ x, y, scale, opacity, core = false }: PoolProps) => (
  <g opacity={opacity}>
    {POOL.map(([k, a]) => (
      <polygon key={k} points={plate(x, y, scale * k)} opacity={a} style={core ? CORE : HOT} />
    ))}
  </g>
)

interface BoardFireProps extends Omit<FireLook, 'kind'> {
  part: 'floor' | 'pile' // 땅 높이의 그림, 칸 위에 선 숯 벽
  kind: NonNullable<FireLook['kind']>
  x: number
  y: number // 칸 윗면 중심
  parity: boolean
}

const BoardFire = ({
  part,
  kind,
  x,
  y,
  parity,
  heat,
  lit,
  stand,
  crumble,
  mark,
  boss,
}: BoardFireProps) => {
  const tone = charTone(heat)
  const glow = glowOf(heat)
  const style = fireStyle(boss)
  const inner = Math.min(1, style.inner)
  const burning = glow * (1 - crumble)
  const wall = wallCrumble(crumble)
  const bridge = bridgePieces(crumble)
  const lumps = lumpTops(x, y, pileLumps(parity))
  const ashLumps = lumpTops(
    x,
    y,
    ASH_LUMPS.map((l) => ({ ...l, height: l.height * (1 - 0.6 * wall.sink) })),
  )
  const pieces = lumpTops(x, y + bridge.drop, bridge.pieces)
  const logs = logQuads(x, y, parity)
  const floorTop = parity ? 'var(--color-floor-top-alt)' : 'var(--color-floor-top)'
  const pileTop = y - CHAR_WALL.height

  return part === 'pile' ? (
    <g>
      {stand > 0 && wall.pile > 0 && (
        <g opacity={stand * wall.pile}>
          {lumps.map((l, i) => (
            <BoardBlock
              key={i}
              x={l.top.x}
              y={l.top.y}
              width={TILE.width * l.scale}
              depth={l.height}
              top={i > 0 ? tone.hi : tone.top}
              left={tone.left}
              right={tone.right}
            />
          ))}
          {glow > 0 && (
            <Flicker opacity={glow}>
              {lumps.map((l, i) => (
                <g key={i}>
                  <polygon
                    points={plate(l.top.x, l.top.y, l.scale * 0.62)}
                    opacity={0.75 * inner}
                    style={HOT}
                  />
                  <polygon
                    points={plate(l.top.x, l.top.y, l.scale * 0.34)}
                    opacity={0.85 * inner}
                    style={CORE}
                  />
                </g>
              ))}
              {boss && <Pool x={x} y={pileTop} scale={0.7} opacity={0.35} core />}
            </Flicker>
          )}
        </g>
      )}
      {wall.lumps > 0 && (
        <g opacity={wall.lumps}>
          {ashLumps.map((l, i) => (
            <g key={i}>
              <BoardBlock
                x={l.top.x}
                y={l.top.y}
                width={TILE.width * l.scale}
                depth={l.height}
                {...ashFaces(l.ember)}
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
      {burning > 0 && stand > 0 && (
        <Embers
          x={x}
          y={pileTop}
          count={style.count}
          top={style.rise}
          every={style.every}
          opacity={burning * stand}
        />
      )}
    </g>
  ) : kind === 'spark' ? (
    <g>
      <polygon points={plate(x, y, SPARK.rim)} style={{ fill: 'var(--color-stove-top)' }} />
      <polygon
        points={plate(x, y, SPARK.bed)}
        style={{ fill: blend('var(--color-stove-bed)', 'var(--color-heat-crack)', lit) }}
      />
      {lit > 0 && <polygon points={plate(x, y, SPARK.glow)} opacity={lit} style={HOT} />}
      <BoardBlock
        x={x}
        y={y - SPARK.coalHeight}
        width={TILE.width * SPARK.coal}
        depth={SPARK.coalHeight}
        top={blend('var(--color-char-top)', 'var(--color-heat-core)', lit)}
        left={blend('var(--color-char-left)', 'var(--color-heat-crack)', lit)}
        right={blend('var(--color-char-right)', 'var(--color-heat-hot)', lit)}
      />
      {lit > 0 && (
        <Flicker opacity={lit}>
          <Pool x={x} y={y} scale={SPARK.pool} opacity={0.1} />
          <polygon points={plate(x, y - SPARK.coalHeight, 0.12)} opacity={0.9} style={CORE} />
        </Flicker>
      )}
      {lit > 0 && (
        <Embers
          x={x}
          y={y - SPARK.coalHeight}
          count={1}
          top={SPARK.rise}
          every={fireStyle(false).every}
          opacity={lit}
        />
      )}
    </g>
  ) : kind === 'wall' ? (
    <g>
      {mark > 0 && (
        <polygon
          points={plate(x, y, crumble > 0 ? wall.smudge : ASH_MARK)}
          opacity={mark}
          style={{ fill: blend(floorTop, 'var(--color-ash-top)', crumble > 0 ? 0.55 : 0.4) }}
        />
      )}
      {burning > 0 && (
        <Flicker opacity={burning * stand}>
          <Pool x={x} y={y} scale={style.pool} opacity={style.poolOpacity * style.inner} />
        </Flicker>
      )}
    </g>
  ) : (
    <g>
      {burning > 0 && stand > 0 && (
        <Flicker opacity={burning * stand}>
          <Pool x={x} y={y} scale={style.pool} opacity={style.poolOpacity * style.inner} />
        </Flicker>
      )}
      {stand > 0 && bridge.slab > 0 && (
        <g opacity={stand * bridge.slab}>
          <BoardBlock
            x={x}
            y={y}
            width={TILE.width}
            depth={TILE.lip}
            top={tone.lo}
            left={tone.left}
            right={tone.right}
          />
          {logs.map((log, i) => (
            <g key={i}>
              <polygon points={log.body} style={{ fill: tone.top }} />
              <polygon
                points={log.grain}
                style={{ fill: log.bright ? tone.hi : blend(tone.top, tone.hi, 0.5) }}
              />
            </g>
          ))}
          {glow > 0 && (
            <Flicker opacity={glow}>
              {logs.map((log, i) => (
                <g key={i}>
                  <polygon points={log.hot} opacity={0.7 * inner} style={HOT} />
                  <polygon points={log.core} opacity={0.8 * inner} style={CORE} />
                </g>
              ))}
              {boss && <Pool x={x} y={y} scale={0.7} opacity={0.35} core />}
            </Flicker>
          )}
        </g>
      )}
      {bridge.opacity > 0 && (
        <g opacity={bridge.opacity}>
          {pieces.map((piece, i) => (
            <BoardBlock
              key={i}
              x={piece.top.x}
              y={piece.top.y}
              width={TILE.width * piece.scale}
              depth={piece.height}
              {...ashFaces(piece.ember)}
            />
          ))}
        </g>
      )}
      {burning > 0 && stand > 0 && (
        <Embers
          x={x}
          y={y}
          count={style.count}
          top={style.rise}
          every={style.every}
          opacity={burning * stand}
        />
      )}
    </g>
  )
}

export default BoardFire
