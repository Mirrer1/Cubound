import BoardBlock from './BoardBlock'
import { Pool } from './BoardFire'
import {
  BURST_RINGS,
  blend,
  burstLook,
  burstSparks,
  dim,
  dustPuffs,
  floorFaces,
  isoEllipse,
  kegBlocks,
  kegCordSpan,
  kegCords,
  kegTrail,
  shade,
} from './view'
import { TILE, blockFaces } from '@/game/iso'
import { useLoop } from '@/hooks/useLoop'

const HOT = 'var(--color-heat-hot)'
const CORE = 'var(--color-heat-core)'

const spark = (x: number, y: number, size: number) =>
  `${x},${y - size} ${x + size * 0.7},${y} ${x},${y + size} ${x - size * 0.7},${y}`

const plate = (x: number, y: number, scale: number) => blockFaces(x, y, TILE.width * scale, 0).top

// 심지 타는 끝의 일렁임, 수 사이에도 살아 있는 불
const EMBER_LOOP: Keyframe[] = [
  { opacity: 1 },
  { opacity: 0.55 },
  { opacity: 0.9 },
  { opacity: 0.65 },
  { opacity: 1 },
]
const EMBER_MS = 1100

// 타는 끝에서 오르는 가는 연기
const SMOKE_LOOP: Keyframe[] = [
  { transform: 'translate(0px, 0px)', opacity: 0 },
  { transform: 'translate(0.5px, -5px)', opacity: 0.4 },
  { transform: 'translate(-0.5px, -12px)', opacity: 0 },
]
const SMOKE_MS = 2200

// 타는 끝에서 톡 튀는 작은 불티
const POP_LOOP: Keyframe[] = [
  { transform: 'translate(0px, 0px)', opacity: 0 },
  { transform: 'translate(0px, 0px)', opacity: 0, offset: 0.7 },
  { transform: 'translate(1.5px, -3px)', opacity: 1, offset: 0.78 },
  { transform: 'translate(3px, -5px)', opacity: 0 },
]
const POP_MS = 1500

// 숯불빛 쪽으로 섞이는 면 색, 윗면이 먼저 물드는 heat
const heated = (token: string, heat: number) => ({
  top: blend(shade(token, 'top'), blend(HOT, 'var(--color-heat-top)', 0.45), heat),
  left: blend(shade(token, 'left'), 'var(--color-heat-left)', heat),
  right: blend(shade(token, 'right'), 'var(--color-heat-right)', heat),
})

interface KegProps {
  part: 'keg'
  x: number
  y: number // 칸 윗면 중심
  swell: number
  heat: number
  cords: number
  ember: number
  ashTo?: number
  ash?: number
  trailU?: number // 밀리는 동안 불티가 처지는 칸 쪽
  trailV?: number
}

interface BurstProps {
  part: 'burst'
  x: number
  y: number // 칸 윗면 중심
  s: number // 터지기 시작한 뒤 흐른 초
}

interface DustProps {
  part: 'dust'
  x: number
  y: number // 칸 윗면 중심
  tier: number
  s: number
  du: number
  dv: number
}

type BoardKegProps = KegProps | BurstProps | DustProps

const Keg = ({
  x,
  y,
  swell,
  heat,
  cords,
  ember,
  ashTo = 0,
  ash = 0,
  trailU = 0,
  trailV = 0,
}: Omit<KegProps, 'part'>) => {
  const { body, hoops, lid, plug } = kegBlocks(x, y, swell)
  const tone = heated('keg', heat)
  const lidTone = heated('keg-lid', heat)
  const hoopLeft = dim(tone.left, 16)
  const hoopRight = dim(tone.right, 16)
  const fuse = kegCords(x, y, cords, swell)
  const glow = heat / 0.72
  const flicker = useLoop(EMBER_LOOP, EMBER_MS)
  const smoke = useLoop(SMOKE_LOOP, SMOKE_MS)
  const pop = useLoop(POP_LOOP, POP_MS)
  const ashes = ash > 0 ? kegCordSpan(x, y, cords, ashTo, swell) : []
  const trail = kegTrail(trailU, trailV)

  return (
    <g>
      <BoardBlock {...body} top={tone.top} left={tone.left} right={tone.right} />
      {hoops.map((hoop) => {
        const faces = blockFaces(hoop.x, hoop.y, hoop.width, hoop.depth)
        return (
          <g key={hoop.y}>
            <polygon points={faces.left} style={{ fill: hoopLeft }} />
            <polygon points={faces.right} style={{ fill: hoopRight }} />
          </g>
        )
      })}
      <BoardBlock {...lid} top={lidTone.top} left={lidTone.left} right={lidTone.right} />
      <BoardBlock
        {...plug}
        top={shade('keg-plug', 'top')}
        left={shade('keg-plug', 'left')}
        right={shade('keg-plug', 'right')}
      />
      {fuse.parts.map((cord) => (
        <g key={cord.top}>
          <polygon points={cord.right} style={{ fill: dim('var(--color-char-left)', 3) }} />
          <polygon points={cord.left} style={{ fill: dim('var(--color-char-left)', 5) }} />
          <polygon points={cord.top} style={{ fill: 'var(--color-char-left)' }} />
        </g>
      ))}
      {ashes.map((cord) => (
        <g key={cord.top} opacity={ash}>
          <polygon points={cord.right} style={{ fill: 'var(--color-ash-right)' }} />
          <polygon points={cord.left} style={{ fill: 'var(--color-ash-left)' }} />
          <polygon points={cord.top} style={{ fill: 'var(--color-ash-top)' }} />
        </g>
      ))}
      {fuse.tip && ember > 0 && (
        <g opacity={ember}>
          <polygon points={fuse.tip.right} style={{ fill: HOT }} />
          <polygon points={fuse.tip.left} style={{ fill: 'var(--color-heat-crack)' }} />
          <polygon points={fuse.tip.top} style={{ fill: CORE }} />
        </g>
      )}
      {fuse.ember && ember > 0 && (
        <g opacity={ember}>
          <g ref={flicker}>
            <polygon
              points={plate(fuse.ember.x, fuse.ember.y, 0.09)}
              opacity={0.5}
              style={{ fill: HOT }}
            />
            <polygon
              points={plate(fuse.ember.x, fuse.ember.y, 0.045)}
              opacity={0.85}
              style={{ fill: CORE }}
            />
            <polygon
              points={spark(fuse.ember.x, fuse.ember.y - 4, 1)}
              opacity={0.9}
              style={{ fill: CORE }}
            />
          </g>
          <ellipse
            ref={smoke}
            cx={fuse.ember.x}
            cy={fuse.ember.y - 3}
            rx={1.6}
            ry={1.1}
            style={{ fill: 'var(--color-amb-brazier-smoke)' }}
          />
          <polygon
            ref={pop}
            points={spark(fuse.ember.x, fuse.ember.y - 2, 0.8)}
            style={{ fill: HOT }}
          />
          {(trailU !== 0 || trailV !== 0) &&
            [1, 1.9].map((k) => (
              <polygon
                key={k}
                points={spark(fuse.ember.x + trail.x * k, fuse.ember.y + trail.y * k - 3, 0.9 / k)}
                opacity={0.7 / k}
                style={{ fill: HOT }}
              />
            ))}
        </g>
      )}
      {glow > 0 && (
        <g opacity={glow}>
          <polygon points={plate(x, lid.y, 0.34 * 0.8)} opacity={0.55} style={{ fill: HOT }} />
          <polygon points={plate(x, lid.y, 0.34 * 0.45)} opacity={0.7} style={{ fill: CORE }} />
        </g>
      )}
    </g>
  )
}

const Burst = ({ x, y, s }: Omit<BurstProps, 'part'>) => {
  const look = burstLook(s)
  const sparks = burstSparks(x, y, look.spread)

  return (
    <g>
      <Pool x={x} y={y} scale={look.pool} opacity={look.poolOpacity} />
      {look.core > 0 && <Pool x={x} y={y} scale={1.6} opacity={look.core} core />}
      {look.rings > 0 &&
        BURST_RINGS.map((ring) => (
          <ellipse
            key={ring.r}
            cx={x}
            cy={y - ring.z}
            {...isoEllipse(ring.r)}
            opacity={ring.opacity * look.rings}
            style={{ fill: ring.light ? blend(CORE, 'var(--color-amb-light)', 0.6) : CORE }}
          />
        ))}
      {look.sparks > 0 && (
        <g opacity={look.sparks}>
          {sparks.map((p, i) => (
            <polygon
              key={i}
              points={spark(p.x, p.y, p.size)}
              style={{ fill: p.hot ? HOT : CORE }}
            />
          ))}
        </g>
      )}
    </g>
  )
}

const Dust = ({ x, y, tier, s, du, dv }: Omit<DustProps, 'part'>) => (
  <g>
    {dustPuffs(x, y, du, dv, s).map((puff, i) =>
      puff.opacity > 0 ? (
        <ellipse
          key={i}
          cx={puff.x}
          cy={puff.y}
          rx={puff.rx}
          ry={puff.ry}
          opacity={puff.opacity}
          style={{
            fill: puff.light
              ? blend(floorFaces(tier, false).left, 'var(--color-ash-top)', 0.45)
              : blend(floorFaces(tier, false).top, 'var(--color-ash-top)', 0.35),
          }}
        />
      ) : null,
    )}
  </g>
)

const BoardKeg = (props: BoardKegProps) => {
  return (
    <>
      {props.part === 'keg' ? (
        <Keg {...props} />
      ) : props.part === 'burst' ? (
        <Burst {...props} />
      ) : (
        <Dust {...props} />
      )}
    </>
  )
}

export default BoardKeg
