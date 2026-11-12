import { TILE } from '@/game/iso'
import type { Point } from '@/game/types'

// 날아와 앉는 ms, 둘째가 늦게 날아오는 ms, 머묾 ms, 둘째가 늦게 떠나는 ms, 날아 빠지는 ms
const ARRIVE = 1000
const ARRIVE_LAG = 150
const STAY = 3000
const LAG = 50
const FLIGHT = 800

export const CROW = {
  life: ARRIVE + ARRIVE_LAG + STAY + LAG + FLIGHT,
  takeoff: ARRIVE + ARRIVE_LAG + STAY, // 스스로 날아가는 ms
  fade: 250, // 날아 빠지며 옅어지는 마지막 ms
  flap: 400, // 날갯짓 한 번 ms
  rise: 117, // 초당 오르는 px
  drift: { x: 50, y: 14.4 }, // 초당 옆으로 가는 px, 아래로 처지는 px
  from: { x: 27, z: 20 }, // 날아오기 시작하는 자리 px
  pitch: { sit: 0, fly: 10 }, // 몸 기울기, 땅에 선 몸이 이미 부리 쪽으로 약 14° 들림
  scale: (0.162 * TILE.width) / 1.16, // 단위 길이 px
  shadow: { opacity: 0.14, rx: 2.66, ry: 1.3 },
}

// 머묾 동안 동작, 까마귀 번호, 시작 ms, 길이 ms
const GESTURES = [
  { crow: 0, kind: 'tilt', at: 1600, length: 700 },
  { crow: 1, kind: 'caw', at: 2500, length: 300 },
  { crow: 0, kind: 'caw', at: 3200, length: 300 },
] as const
const TILT_EASE = 150

// 까마귀 둘의 칸 안 자리와 보는 쪽, 한 칸에 둘이면 together
const SEATS = [
  { u: -0.05, v: 0.12, d: [0, 1] as const, together: { u: -0.25, v: 0 } },
  { u: 0.02, v: 0.04, d: [1, 0] as const, together: { u: 0.25, v: 0 } },
]

export interface CrowSeat {
  index: number
  x: number // 칸 윗면 가운데 기준 px
  y: number
  face: number // 화면 옆으로 보는 쪽 1 오른쪽, -1 왼쪽
}

const screen = (u: number, v: number) => ({
  x: ((u - v) * TILE.width) / 2,
  y: ((u + v) * TILE.height) / 2,
})

// 칸에 앉은 까마귀, crows는 1 첫째, 2 둘째, 3 둘 다
export const crowSeats = (crows: number): CrowSeat[] =>
  SEATS.flatMap((seat, index) => {
    if (!(crows & (1 << index))) return []
    const { u, v } = crows === 3 ? seat.together : seat
    return [{ index, ...screen(u, v), face: seat.d[0] - seat.d[1] < 0 ? -1 : 1 }]
  })

// 고른 첫 칸에 붙은 같은 높이 칸 하나를 더한 앉을 칸, together면 첫 칸 하나, cells는 고르는 순서로 늘어선 후보
export const flockCells = (
  first: Point[],
  cells: Point[],
  heights: number[][],
  together = false,
): Point[] => {
  const [a] = first
  if (!a || together) return first
  const next = cells.find(
    (p) =>
      Math.abs(p.x - a.x) + Math.abs(p.y - a.y) === 1 && heights[p.y][p.x] === heights[a.y][a.x],
  )
  return next ? [a, next] : [a]
}

// 큐브가 옆 칸일 때 날아가는 화면 옆 방향 1 오른쪽, -1 왼쪽, 0은 각자 보는 쪽
export const crowSide = (cells: Point[], player: Point, near: boolean) => {
  const across = cells.reduce((sum, p) => sum + p.x - p.y, 0) / cells.length
  return near ? Math.sign(across - (player.x - player.y)) : 0
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
const easeOut = (k: number) => 1 - (1 - k) * (1 - k)
const smooth = (k: number) => {
  const c = clamp01(k)
  return c * c * (3 - 2 * c)
}
const lerp = (a: number, b: number, k: number) => a + (b - a) * k

export interface CrowPose {
  opacity: number
  x: number // 앉은 자리에서 옮겨 간 px
  y: number
  z: number // 뜬 px
  pitch: number // 몸 기울기
  facing: number // 화면 옆으로 보는 쪽 -1~1
  fold: number // 날개 접힘 0~1
  flap: number // 날개 -1 올림, 0 펼침, 1 내림
  perch: number // 앉은 정도, 다리와 머리 자세 0~1
  tilt: number // 갸웃 0~1
  caw: number // 까악 0~1
  shadow: number
}

const gesture = (index: number, kind: 'tilt' | 'caw', ms: number) =>
  GESTURES.reduce((top, g) => {
    if (g.crow !== index || g.kind !== kind) return top
    const k = ms - g.at
    if (k <= 0 || k >= g.length) return top
    const value =
      kind === 'caw'
        ? Math.sin((k / g.length) * Math.PI)
        : Math.min(1, k / TILT_EASE, (g.length - k) / TILT_EASE)
    return Math.max(top, value)
  }, 0)

// 날아오기 시작해 t ms 지난 자세, 날개 접고 앉는 때는 닿기 전 0.25초
const arrival = (t: number, face: number) => {
  const near = easeOut(clamp01(t / ARRIVE))
  const fold = smooth((t - (ARRIVE - 250)) / 250)
  return {
    opacity: clamp01(t / 700),
    x: -face * CROW.from.x * (1 - near),
    z: CROW.from.z * (1 - near),
    fold,
    flap: -Math.cos((t / CROW.flap) * Math.PI * 2),
    perch: fold,
    pitch: lerp(CROW.pitch.fly, CROW.pitch.sit, fold),
  }
}

// 차례 시작에서 ms 지난 까마귀 하나, takeoff는 떠나기 시작한 ms, side는 날아가는 쪽, 0이면 보던 쪽
export const crowPose = (
  ms: number,
  index: number,
  takeoff: number,
  face: number,
  side: number,
): CrowPose => {
  const way = side || face
  const start = index * ARRIVE_LAG
  const leave = takeoff + index * LAG
  const before = arrival(Math.min(ms, leave) - start, face)
  const q = Math.max(0, ms - leave) / 1000
  const settle = 1 - smooth(q / 0.15)
  const turn = smooth(q / 0.2)
  const z = before.z + q * CROW.rise
  const opacity = before.opacity * clamp01((FLIGHT - q * 1000) / CROW.fade)
  return {
    opacity,
    x: before.x + q * CROW.drift.x * way,
    y: q * CROW.drift.y,
    z,
    pitch: lerp(before.pitch, CROW.pitch.fly, turn),
    facing: lerp(face, way, turn),
    fold: Math.min(before.fold, 1 - smooth(q / 0.1)),
    // 떠나는 순간 날개 펼침, 0.1초 뒤 올림 자세
    flap:
      q > 0
        ? lerp(before.flap, -Math.sin((q / 0.4) * Math.PI * 2), lerp(1 - settle, 1, before.fold))
        : before.flap,
    perch: before.perch * settle,
    tilt: gesture(index, 'tilt', ms) * settle,
    caw: gesture(index, 'caw', ms) * settle,
    shadow: Math.max(0, CROW.shadow.opacity - z / 150) * opacity,
  }
}

const m = (v: number) => Math.round(v * 1000) / 1000
const f = (p: readonly number[]) => `${m(p[0])},${m(p[1])}`

const rotate = ([x, y]: readonly number[], [cx, cy]: readonly number[], deg: number) => {
  const a = (deg * Math.PI) / 180
  const [ox, oy] = [x - cx, y - cy]
  return [cx + ox * Math.cos(a) - oy * Math.sin(a), cy + ox * Math.sin(a) + oy * Math.cos(a)]
}

// 몸 점 25개, 부리 끝, 윗부리, 이마, 정수리, 목, 등, 꼬리, 배, 멱, 아랫부리 차례, 땅에 선 자세
const BODY = [
  [0.58, -0.3],
  [0.5, -0.34],
  [0.4, -0.36],
  [0.32, -0.39],
  [0.28, -0.43],
  [0.2, -0.49],
  [0.1, -0.41],
  [0.06, -0.32],
  [0, -0.26],
  [-0.2, -0.26],
  [-0.36, -0.13],
  [-0.5, -0.09],
  [-0.62, -0.05],
  [-0.64, -0.01],
  [-0.62, 0.02],
  [-0.5, 0],
  [-0.32, 0.03],
  [-0.05, 0.22],
  [0.18, -0.03],
  [0.24, -0.12],
  [0.28, -0.22],
  [0.36, -0.26],
  [0.5, -0.27],
  [0.575, -0.29],
  [0.58, -0.3],
]
const HEAD = new Set([0, 1, 2, 3, 4, 5, 6, 19, 20, 21, 22, 23, 24])
const TIP = 0
const LOWER = 23
const CORNER = 24

// 목 자리, 부리가 벌어지는 자리
const NECK = [0.16, -0.3]
const HINGE = [0.33, -0.3]

const mix = (a: readonly number[], b: readonly number[], k: number) => [
  lerp(a[0], b[0], k),
  lerp(a[1], b[1], k),
]

// 까마귀 몸 실루엣, 단위 길이 1의 옆모습, 머리가 +x
export const crowBodyPath = (tilt: number, caw: number) => {
  const lift = (1.5 * tilt + 1.5 * caw) / CROW.scale
  const pts = BODY.map((p) => [...p])
  const tip = pts[TIP]
  pts[TIP] = rotate(tip, HINGE, -6 * caw)
  pts[LOWER] = rotate(tip, HINGE, 22 * caw)
  pts[CORNER] = mix(tip, HINGE, caw)
  const p = pts.map((q, i) => {
    if (!HEAD.has(i)) return q
    const [x, y] = rotate(q, NECK, 18 * tilt - 8 * caw)
    return [x, y - lift]
  })
  const [
    a,
    c1,
    p1,
    fb,
    fh,
    c2,
    nape,
    nc,
    np,
    bc,
    bp,
    t0,
    t1,
    t2,
    t3,
    t4,
    t5,
    ec,
    ep,
    hc,
    hp,
    lb,
    lc,
    lt,
    corner,
  ] = p
  return `M${f(a)} Q${f(c1)} ${f(p1)} L${f(fb)} L${f(fh)} Q${f(c2)} ${f(nape)} Q${f(nc)} ${f(np)} Q${f(bc)} ${f(bp)} L${f(t0)} Q${f(t1)} ${f(t2)} Q${f(t3)} ${f(t4)} L${f(t5)} Q${f(ec)} ${f(ep)} Q${f(hc)} ${f(hp)} L${f(lb)} Q${f(lc)} ${f(lt)} L${f(corner)} Z`
}

// 발끝 자리, 두 다리의 배 안 엉덩이 x, 엉덩이 y, 발이 앞으로 나간 몫, 굵기, 발가락 길이와 굵기
export const CROW_FOOT = [0.05, 0.3]
const HIPS = [-0.03, 0.11]
const HIP_Y = 0.08
const LEAN = 0.03
const LEG_WIDTH = 0.065
const TOE = { length: 0.12, width: 0.045 }
// 다리 길이와 각, 서면 발이 살짝 앞, 날면 꼬리 쪽으로 접혀 조금 벌어진 두 다리
const STAND = {
  length: Math.hypot(LEAN, CROW_FOOT[1] - HIP_Y),
  angle: Math.atan2(LEAN, CROW_FOOT[1] - HIP_Y),
}
const TUCK = { length: 0.17, angles: [-72, -80].map((deg) => (deg * Math.PI) / 180) }

// 배 안에서 시작하는 가는 다리 둘, 서면 곧은 다리와 발가락 선, 날면 뒤로 접힌 꼴
export const crowLegs = (perch: number) =>
  HIPS.map((x, i) => {
    const a = lerp(TUCK.angles[i], STAND.angle, perch)
    const length = lerp(TUCK.length, STAND.length, perch)
    const [fx, fy] = [x + Math.sin(a) * length, HIP_Y + Math.cos(a) * length]
    const [nx, ny] = [(Math.cos(a) * LEG_WIDTH) / 2, (-Math.sin(a) * LEG_WIDTH) / 2]
    const toe = TOE.length * perch
    const toeWidth = TOE.width * perch
    return (
      `M${f([x - nx, HIP_Y - ny])} L${f([x + nx, HIP_Y + ny])} L${f([fx + nx, fy + ny])} L${f([fx - nx, fy - ny])} Z ` +
      `M${f([fx - nx, fy - toeWidth])} L${f([fx + toe, fy - toeWidth])} L${f([fx + toe, fy])} L${f([fx - nx, fy])} Z`
    )
  }).join(' ')

// 날개 끝이 올림, 펼침, 내림, 접힘에 가는 자리와 몸에 붙는 앞뒤 자리, 땅에 선 때 접힌 끝과 뿌리
const WINGS = {
  near: {
    up: [-0.32, -1.1],
    mid: [-0.49, -0.42],
    down: [-0.22, 0.38],
    folded: [-0.46, -0.25],
    root: [
      [0.08, -0.25],
      [-0.18, -0.24],
    ],
    sit: {
      folded: [-0.54, -0.11],
      root: [
        [0.08, -0.25],
        [0, -0.15],
      ],
    },
  },
  far: {
    up: [-0.12, -1],
    mid: [-0.26, -0.56],
    down: [-0.06, -0.17],
    folded: [-0.4, -0.29],
    root: [
      [0.12, -0.29],
      [-0.08, -0.28],
    ],
    sit: {
      folded: [-0.5, -0.14],
      root: [
        [0.1, -0.27],
        [0.02, -0.2],
      ],
    },
  },
} as const

// 휜 날개 하나, 끝 깃 셋, flap -1 올림, 0 펼침, 1 내림, fold 1이면 등에 접힘
export const crowWing = (wing: 'near' | 'far', flap: number, fold: number, perch: number) => {
  const { up, mid, down, folded, root, sit } = WINGS[wing]
  const r0 = mix(root[0], sit.root[0], perch)
  const r1 = mix(root[1], sit.root[1], perch)
  const to = flap < 0 ? up : down
  const open = mix(mid, to, Math.abs(flap))
  const T = mix(open, mix(folded, sit.folded, perch), fold)
  const mL = [(r0[0] + T[0]) / 2, (r0[1] + T[1]) / 2]
  const mT = [(r1[0] + T[0]) / 2, (r1[1] + T[1]) / 2]
  const L = Math.hypot(T[0] - r0[0], T[1] - r0[1]) || 1
  const nx = -(T[1] - r0[1]) / L
  const ny = (T[0] - r0[0]) / L
  const sg = T[1] < 0 ? 1 : -1
  const cL = [mL[0] + nx * 0.16 * sg + 0.05, mL[1] + ny * 0.16 * sg]
  const cT = [mT[0] - nx * 0.05 * sg, mT[1] - ny * 0.05 * sg]
  const bx = (r1[0] - T[0]) / L
  const by = (r1[1] - T[1]) / L
  const feather = (along: number, side: number) => [
    T[0] + bx * along + nx * side * sg,
    T[1] + by * along + ny * side * sg,
  ]
  return `M${f(r0)} Q${f(cL)} ${f(T)} L${f(feather(0.07, 0.03))} L${f(feather(0.1, -0.005))} L${f(feather(0.17, 0.02))} Q${f(cT)} ${f(r1)} Z`
}

// 까마귀 하나의 변환, 발끝을 앉은 자리에 맞춤, 칸 윗면 가운데 기준
export const crowTransform = (seat: CrowSeat, pose: CrowPose) => {
  const s = CROW.scale
  const a = (-pose.pitch * Math.PI) / 180
  const [lx, ly] = CROW_FOOT.map((v) => v * s)
  const fx = (lx * Math.cos(a) - ly * Math.sin(a)) * pose.facing
  const fy = lx * Math.sin(a) + ly * Math.cos(a)
  const x = seat.x + pose.x - fx
  const y = seat.y + pose.y - pose.z - fy
  return `translate(${m(x)} ${m(y)}) scale(${m(pose.facing)} 1) rotate(${m(-pose.pitch)}) scale(${m(s)})`
}
