import { isoPoint, uvQuad } from './fireView'
import { TILE } from '@/game/iso'

// 몸통과 뚜껑의 칸 폭 배수와 높이 px, 테 두께와 윗면 높이 px, 마개 칸 폭 배수와 높이 px
export const KEG_SHAPE = {
  body: 0.48,
  bodyHeight: 24,
  lid: 0.34,
  lidHeight: 4,
  hoop: 3,
  hoops: [6, 21],
  plug: 0.1,
  plugHeight: 3,
}

// 마개 윗면까지의 높이 px
export const KEG_HEIGHT = KEG_SHAPE.bodyHeight + KEG_SHAPE.lidHeight + KEG_SHAPE.plugHeight

interface Block {
  x: number
  y: number // 윗면 중심
  width: number
  depth: number
}

// 부푼 배율 swell인 몸통, 테, 뚜껑, 마개, x와 y는 칸 윗면 중심
export const kegBlocks = (x: number, y: number, swell: number) => {
  const body = KEG_SHAPE.bodyHeight * swell
  const lid = KEG_SHAPE.lidHeight * swell
  const block = (scale: number, z: number, depth: number): Block => ({
    x,
    y: y - z - depth,
    width: TILE.width * scale * swell,
    depth,
  })
  return {
    body: block(KEG_SHAPE.body, 0, body),
    hoops: KEG_SHAPE.hoops.map((z) =>
      block(KEG_SHAPE.body, z * swell - KEG_SHAPE.hoop * swell, KEG_SHAPE.hoop * swell),
    ),
    lid: block(KEG_SHAPE.lid, body, lid),
    plug: block(KEG_SHAPE.plug, body + lid, KEG_SHAPE.plugHeight),
  }
}

// 뚜껑 둘레 앞쪽 두 변을 감는 심지 네 마디, 오른쪽 모서리에서 왼쪽 모서리 순서, along 축으로 from에서 to까지
const CORDS = [
  { along: 'v', from: -0.16, to: -0.025 },
  { along: 'v', from: 0.025, to: 0.16 },
  { along: 'u', from: 0.16, to: 0.025 },
  { along: 'u', from: -0.025, to: -0.16 },
] as const

// 심지 마디의 가로 범위, 두께 px, 타는 끝 길이
const CORD = { across: [0.185, 0.225], thick: 2, tip: 0.055 }

export interface CordFaces {
  top: string
  left: string
  right: string
}

// u, v 범위의 납작한 블록 세 면, z는 윗면 높이
const cordFaces = (
  x: number,
  y: number,
  [u0, u1]: number[],
  [v0, v1]: number[],
  z: number,
): CordFaces => {
  const p = (u: number, v: number, dz = 0) => isoPoint(x, y, u, v, z - dz)
  const quad = (list: { x: number; y: number }[]) => list.map((q) => `${q.x},${q.y}`).join(' ')
  return {
    top: uvQuad(x, y, u0, u1, v0, v1, z),
    right: quad([p(u1, v0), p(u1, v1), p(u1, v1, CORD.thick), p(u1, v0, CORD.thick)]),
    left: quad([p(u0, v1), p(u1, v1), p(u1, v1, CORD.thick), p(u0, v1, CORD.thick)]),
  }
}

const span = (a: number, b: number) => [Math.min(a, b), Math.max(a, b)]

const cordZ = (swell: number) => KEG_SHAPE.bodyHeight * swell + CORD.thick

const cordPiece = (x: number, y: number, z: number, along: 'u' | 'v', a: number, b: number) =>
  along === 'v'
    ? cordFaces(x, y, CORD.across, span(a, b), z)
    : cordFaces(x, y, span(a, b), CORD.across, z)

// 남은 마디 cords만큼의 심지, 끝 마디는 소수만큼, tip은 타는 끝, ember는 끝 불빛 자리
export const kegCords = (x: number, y: number, cords: number, swell: number) => {
  const count = Math.ceil(Math.max(0, Math.min(4, cords)) - 1e-6)
  const z = cordZ(swell)
  const piece = (along: 'u' | 'v', a: number, b: number) => cordPiece(x, y, z, along, a, b)
  const parts = CORDS.slice(0, count).map((cord, i) => {
    const kept = i === count - 1 ? cords - i : 1
    return { ...cord, end: cord.from + (cord.to - cord.from) * kept }
  })
  const last = parts.at(-1)
  if (!last) return { parts: [], tip: null, ember: null }

  const dir = Math.sign(last.to - last.from)
  const tipFrom =
    dir > 0 ? Math.max(last.from, last.end - CORD.tip) : Math.min(last.from, last.end + CORD.tip)
  const mid = (CORD.across[0] + CORD.across[1]) / 2
  return {
    parts: parts.map((cord) => piece(cord.along, cord.from, cord.end)),
    tip: piece(last.along, tipFrom, last.end),
    ember: last.along === 'v' ? isoPoint(x, y, mid, last.end, z) : isoPoint(x, y, last.end, mid, z),
  }
}

// 마디 자리 from에서 to까지의 심지 조각들, 탄 자리 재
export const kegCordSpan = (x: number, y: number, from: number, to: number, swell: number) =>
  CORDS.flatMap((cord, i) => {
    const lo = Math.max(from, i)
    const hi = Math.min(to, i + 1)
    if (hi - lo <= 1e-6) return []
    const at = (k: number) => cord.from + (cord.to - cord.from) * (k - i)
    return [cordPiece(x, y, cordZ(swell), cord.along, at(lo), at(hi))]
  })

// 밀리는 반대쪽 u, v로 처진 불티의 화면 어긋남
export const kegTrail = (u: number, v: number) => isoPoint(0, 0, u * 0.14, v * 0.14)

// [초, 값] 사이를 곧게 잇는 값, 처음과 끝 밖은 그 값
const track = (keys: [number, number][], s: number) => {
  if (s <= keys[0][0]) return keys[0][1]
  for (let i = 1; i < keys.length; i += 1) {
    const [s1, v1] = keys[i]
    const [s0, v0] = keys[i - 1]
    if (s <= s1) return v0 + ((v1 - v0) * (s - s0)) / (s1 - s0)
  }
  return keys[keys.length - 1][1]
}

// 화약통 자리 빛 고임, 숯불빛과 속불빛 세 겹 고리, 불티, 터지기 시작한 뒤 s초
export const burstLook = (s: number) => ({
  pool: track(
    [
      [0, 1],
      [0.08, 1.72],
      [0.16, 3.1],
      [0.28, 2.4],
      [0.4, 1.3],
    ],
    s,
  ),
  poolOpacity: track(
    [
      [0, 0],
      [0.08, 0.14],
      [0.16, 0.26],
      [0.28, 0.12],
      [0.34, 0.05],
      [0.4, 0],
    ],
    s,
  ),
  core: track(
    [
      [0.08, 0],
      [0.16, 0.42],
      [0.28, 0],
    ],
    s,
  ),
  rings: track(
    [
      [0.1, 0],
      [0.16, 1],
      [0.24, 0],
    ],
    s,
  ),
  sparks: track(
    [
      [0.12, 0],
      [0.16, 1],
      [0.28, 0.55],
      [0.4, 0],
    ],
    s,
  ),
  spread: track(
    [
      [0.12, -0.3],
      [0.16, 0],
      [0.28, 0.4],
      [0.4, 0.55],
    ],
    s,
  ),
})

// 터지는 고리 셋의 칸 폭 배수, 높이 px, 진하기, 속불빛보다 밝은 맨 안쪽
export const BURST_RINGS = [
  { r: 0.62, z: 12, opacity: 0.22, light: false },
  { r: 0.44, z: 14, opacity: 0.38, light: false },
  { r: 0.26, z: 16, opacity: 0.6, light: true },
]

// uv 평면의 반지름 r 원이 화면에 그리는 타원 반지름
export const isoEllipse = (r: number) => ({
  rx: (r * TILE.width) / Math.SQRT2,
  ry: (r * TILE.height) / Math.SQRT2,
})

// 둘레로 흩어지는 불티 열둘, 각, 칸 폭 배수 거리, 높이 px
const SPARKS = Array.from({ length: 12 }, (_, i) => ({
  angle: (i / 12) * Math.PI * 2 + 0.3,
  r: 0.5 + 0.22 * (i % 3),
  z: 6 + ((i * 7) % 20),
  size: i % 2 ? 1.3 : 1.8,
  hot: i % 2 === 1,
}))

export const burstSparks = (x: number, y: number, spread: number) =>
  SPARKS.map((spark) => {
    const r = spark.r + spread
    return {
      ...isoPoint(
        x,
        y,
        r * Math.cos(spark.angle),
        r * Math.sin(spark.angle),
        Math.min(28, spark.z + spread * 15),
      ),
      size: spark.size,
      hot: spark.hot,
    }
  })

// 깎인 칸에서 화약통 반대쪽 du, dv로 오르고 퍼지는 흙먼지 셋, 터지기 시작한 뒤 s초
// 각 값은 [가는 거리 칸 배수, 높이 px, 반지름 칸 배수, 진하기]의 오름, 퍼짐, 가라앉음 차례 값
const PUFFS = [
  {
    light: true,
    keys: [
      [0, 4, 0.3, 0],
      [0, 4, 0.38, 0.5],
      [0.2, 3, 0.48, 0.3],
      [0.25, 1, 0.5, 0.13],
      [0.27, 1, 0.5, 0],
    ],
  },
  {
    light: false,
    keys: [
      [0.05, 8, 0.26, 0],
      [0.1, 11, 0.32, 0.45],
      [0.3, 9, 0.4, 0.26],
      [0.34, 6, 0.42, 0.08],
      [0.35, 5, 0.42, 0],
    ],
  },
  {
    light: true,
    keys: [
      [0.1, 14, 0.18, 0],
      [0.18, 18, 0.22, 0.4],
      [0.26, 22, 0.25, 0.1],
      [0.3, 24, 0.26, 0],
      [0.3, 24, 0.26, 0],
    ],
  },
]
const PUFF_TIMES = [0.12, 0.16, 0.28, 0.34, 0.4]

export const dustPuffs = (x: number, y: number, du: number, dv: number, s: number) =>
  PUFFS.map(({ light, keys }) => {
    const at = (j: number) =>
      track(
        PUFF_TIMES.map((time, i) => [time, keys[i][j]]),
        s,
      )
    const k = at(0)
    return {
      ...isoPoint(x, y, du * k, dv * k, at(1)),
      ...isoEllipse(at(2)),
      opacity: at(3),
      light,
    }
  })
