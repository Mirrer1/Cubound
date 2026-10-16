import { blend, shade } from './shadeView'
import { TILE } from '@/game/iso'
import { same } from '@/game/rules'
import type { Point } from '@/game/types'

// 받침과 몸의 폭은 칸 폭 배, 높이는 px, 몸은 받침보다 inset만큼 짧은 길이
export const BAR = {
  base: { width: 0.36, height: 4 },
  body: { width: 0.24, height: 7, inset: 0.14 },
  sheen: 2,
  reach: 0.32, // 끝 칸 가운데에서 받침 끝까지
  sag: (6 * Math.PI) / 180,
  lip: { length: 0.26, over: 0.06 }, // 다리 끝이 가장자리 땅에 얹힌 길이, 그중 구덩이 위 몫
  shadow: 0.82, // 처짐에 들린 쪽 밑 그늘 길이
  contact: 0.08, // 받침 모서리에 닿는 띠 길이
}

export const BAR_HEIGHT = BAR.base.height + BAR.body.height + BAR.sheen

// 칸 경계에서 자른 조각끼리 겹치는 길이, 이음매 실금 방지
const OVERLAP = 0.01

export interface BarPose {
  x: number // 가운데의 칸 좌표
  y: number
  angle: number // 꼬리에서 머리 쪽 라디안, 0은 +x
  length: number // 받침 길이 칸 수
  span: number // 양 끝 칸 가운데 사이 거리
  inset: number // 몸이 받침보다 짧은 길이, 다리는 0
  z: number // 밑면 높이 px
  sag: { at: number; angle: number } | null // at은 가운데에서 받침 모서리까지 거리, angle은 양수면 머리 쪽이 처지는 각
  lips: number // 다리 끝이 가장자리에 얹힌 진하기
  hold?: Point // 막대 전체를 한 덩이로 그리는 칸
  turn?: { cut: number; side: number; pivot: Point; front: Point } // 돌 때 cut에서 나눈 두 조각, side 쪽은 축 칸 pivot
  dip?: number // 큐브 무게로 가라앉은 px, 가장자리에 얹힌 끝은 제자리
}

export type BarLayer = 'base' | 'body' | 'sheen'

export interface BarFace {
  layer: BarLayer
  top: boolean
  k: number // 옆면 색, 0은 왼쪽 면, 1은 오른쪽 면
  points: string
}

export interface BarFlat {
  kind: 'shadow' | 'contact' | 'lip' | 'lipSheen'
  opacity: number
  points: string
}

export interface BarPiece {
  cell: Point
  flats: BarFlat[] // 막대 밑에 깔리는 평면
  pool: Point | null // 달군 쇠 발밑 빛의 화면 자리, 막대 칸 가운데가 든 조각
  faces: BarFace[]
  clip?: string // 면이 보이는 화면 영역
}

const ZU = TILE.height

// 막대 안 좌표 u(길이), w(폭) 칸 단위와 밑면에서의 높이 h px의 화면 점
const placer = (pose: BarPose) => {
  const cos = Math.cos(pose.angle)
  const sin = Math.sin(pose.angle)
  return (u: number, w: number, h: number) => {
    let pu = u
    let ph = h
    if (pose.sag) {
      const du = u - pose.sag.at
      const dh = h / ZU
      const c = Math.cos(pose.sag.angle)
      const s = Math.sin(pose.sag.angle)
      pu = pose.sag.at + du * c + dh * s
      ph = (-du * s + dh * c) * ZU
    }
    const x = pose.x + pu * cos - w * sin
    const y = pose.y + pu * sin + w * cos
    const z = pose.z + ph
    return [((x - y) * TILE.width) / 2, ((x + y) * TILE.height) / 2 - z]
  }
}

const join = (list: number[][]) =>
  list.map(([x, y]) => `${Math.round(x * 100) / 100},${Math.round(y * 100) / 100}`).join(' ')

// 길이 방향 a~b, 폭 width, 높이 h0~h1 상자의 보이는 면, caps는 양 끝 면 그리기 여부
const prism = (
  pose: BarPose,
  layer: BarLayer,
  [a, b]: [number, number],
  width: number,
  [h0, h1]: [number, number],
  caps: [boolean, boolean],
): BarFace[] => {
  const at = placer(pose)
  const cos = Math.cos(pose.angle)
  const sin = Math.sin(pose.angle)
  const hw = width / 2
  const sides: { n: [number, number]; corners: [number, number][] }[] = [
    {
      n: [0, -1],
      corners: [
        [a, -hw],
        [b, -hw],
      ],
    },
    {
      n: [0, 1],
      corners: [
        [a, hw],
        [b, hw],
      ],
    },
    ...(caps[0]
      ? [
          {
            n: [-1, 0] as [number, number],
            corners: [
              [a, -hw],
              [a, hw],
            ] as [number, number][],
          },
        ]
      : []),
    ...(caps[1]
      ? [
          {
            n: [1, 0] as [number, number],
            corners: [
              [b, -hw],
              [b, hw],
            ] as [number, number][],
          },
        ]
      : []),
  ]
  const faces = sides.flatMap(({ n: [nu, nw], corners: [p, q] }) => {
    const nx = nu * cos - nw * sin
    const ny = nu * sin + nw * cos
    if (nx + ny < 1e-3) return []
    const points = join([
      at(p[0], p[1], h0),
      at(q[0], q[1], h0),
      at(q[0], q[1], h1),
      at(p[0], p[1], h1),
    ])
    return [{ layer, top: false, k: Math.min(1, Math.max(0, (nx - ny + 1) / 2)), points }]
  })
  const top = join([at(a, -hw, h1), at(b, -hw, h1), at(b, hw, h1), at(a, hw, h1)])
  return [...faces, { layer, top: true, k: 0, points: top }]
}

// 막대 가운데 줄이 칸 경계를 지나는 길이 방향 자리
export const barCuts = (pose: BarPose): number[] => {
  const half = pose.length / 2
  const cos = Math.cos(pose.angle)
  const sin = Math.sin(pose.angle)
  const crossings = (from: number, step: number) => {
    if (Math.abs(step) < 1e-6) return []
    const lo = Math.ceil(Math.min(from - half * step, from + half * step) - 0.5)
    const hi = Math.floor(Math.max(from - half * step, from + half * step) - 0.5)
    return Array.from({ length: Math.max(0, hi - lo + 1) }, (_, i) => (lo + i + 0.5 - from) / step)
  }
  return [-half, ...crossings(pose.x, cos), ...crossings(pose.y, sin), half]
    .filter((u) => u >= -half && u <= half)
    .sort((a, b) => a - b)
    .filter((u, i, list) => i === 0 || u - list[i - 1] > 1e-6)
}

const cellAt = (pose: BarPose, u: number): Point =>
  pose.hold ??
  (pose.turn
    ? (u - pose.turn.cut) * pose.turn.side > 0
      ? pose.turn.pivot
      : pose.turn.front
    : {
        x: Math.round(pose.x + u * Math.cos(pose.angle)),
        y: Math.round(pose.y + u * Math.sin(pose.angle)),
      })

// 받침 바닥이 닿는 칸, 길이와 폭 방향으로 0.25칸마다 잰 자리
export const footprintCells = (pose: BarPose): Point[] => {
  const half = pose.length / 2
  const cos = Math.cos(pose.angle)
  const sin = Math.sin(pose.angle)
  const steps = Math.ceil(pose.length / 0.25)
  return Array.from({ length: steps + 1 }, (_, i) => -half + (pose.length * i) / steps).flatMap(
    (u) =>
      [-BAR.base.width / 2, 0, BAR.base.width / 2].map((w) => ({
        x: Math.round(pose.x + u * cos - w * sin) + 0,
        y: Math.round(pose.y + u * sin + w * cos) + 0,
      })),
  )
}

// 가장 앞에 그려지는 칸, 같은 깊이면 아래 줄
export const frontCell = (cells: Point[]): Point =>
  cells.reduce((a, b) => (b.x + b.y > a.x + a.y || (b.x + b.y === a.x + a.y && b.y > a.y) ? b : a))

// 바닥에 깔리는 길이 방향 a~b, 폭 width 판
const flat = (pose: BarPose, [a, b]: [number, number], width: number, h: number, hb = h) => {
  const at = placer({ ...pose, sag: null })
  return join([
    at(a, -width / 2, h),
    at(b, -width / 2, hb),
    at(b, width / 2, hb),
    at(a, width / 2, h),
  ])
}

// 칸마다 그리는 막대 조각, 같은 칸에 떨어지는 평면과 면은 한 조각
export const barPieces = (pose: BarPose): BarPiece[] => {
  const half = pose.length / 2
  const body = (pose.length - pose.inset) / 2
  const layers: { layer: BarLayer; span: [number, number]; width: number; h: [number, number] }[] =
    [
      { layer: 'base', span: [-half, half], width: BAR.base.width, h: [0, BAR.base.height] },
      {
        layer: 'body',
        span: [-body, body],
        width: BAR.body.width,
        h: [BAR.base.height, BAR.base.height + BAR.body.height],
      },
      {
        layer: 'sheen',
        span: [-body, body],
        width: BAR.body.width,
        h: [BAR.base.height + BAR.body.height, BAR_HEIGHT],
      },
    ]
  const pieces = new Map<string, BarPiece>()
  const pieceAt = (cell: Point) => {
    const key = `${cell.x}-${cell.y}`
    const known = pieces.get(key)
    if (known) return known
    const piece: BarPiece = { cell, flats: [], faces: [], pool: null }
    pieces.set(key, piece)
    return piece
  }

  if (pose.sag) {
    const side = pose.sag.angle > 0 ? -1 : 1
    const opacity = Math.min(1, Math.abs(pose.sag.angle) / BAR.sag)
    const { at } = pose.sag
    const shadow: [number, number] = [at + side * BAR.shadow, at].sort((a, b) => a - b) as [
      number,
      number,
    ]
    const contact: [number, number] = [at + side * BAR.contact, at].sort((a, b) => a - b) as [
      number,
      number,
    ]
    const host = pieceAt(cellAt(pose, at + (side * BAR.shadow) / 2))
    host.flats.push(
      { kind: 'shadow', opacity, points: flat(pose, shadow, BAR.base.width, 0) },
      { kind: 'contact', opacity, points: flat(pose, contact, BAR.base.width, 0) },
    )
  }

  if (pose.lips > 0) {
    for (const end of [-1, 1]) {
      const inner = end * (half - BAR.lip.over)
      const span = [inner, inner + end * BAR.lip.length].sort((a, b) => a - b) as [number, number]
      const host = pieceAt(cellAt(pose, (span[0] + span[1]) / 2))
      // 가라앉은 몸에 붙은 안쪽 끝과 땅에 얹힌 바깥쪽 끝을 잇는 비스듬한 판
      const ground = BAR_HEIGHT + (pose.dip ?? 0)
      const [ha, hb] = end < 0 ? [ground, BAR_HEIGHT] : [BAR_HEIGHT, ground]
      host.flats.push(
        {
          kind: 'lip',
          opacity: pose.lips,
          points: flat(pose, span, BAR.base.width, ha, hb),
        },
        {
          kind: 'lipSheen',
          opacity: pose.lips,
          points: flat(pose, span, BAR.body.width, ha, hb),
        },
      )
    }
  }

  const floor = placer({ ...pose, sag: null })
  for (let i = 0; i <= pose.span + 1e-6; i++) {
    const u = -pose.span / 2 + i
    const [x, y] = floor(u, 0, 0)
    pieceAt(cellAt(pose, u)).pool = { x, y }
  }

  if (pose.turn) {
    const { cut, side, pivot, front } = pose.turn
    const whole = layers.flatMap(({ layer, span, width, h }) =>
      prism(pose, layer, span, width, h, [true, true]),
    )
    const lead = frontCell([pivot, front])
    const back = same(lead, pivot) ? front : pivot
    pieceAt(back).faces = whole
    if (!same(lead, back)) {
      // 나중에 그리는 칸 쪽 절반만 보이는 영역, 먼저 그린 막대 위에 덮는 자리
      const far = cut + (same(lead, pivot) ? side : -side) * 4
      const ground = placer({ ...pose, sag: null })
      pieceAt(lead).faces = whole
      pieceAt(lead).clip = join([
        ground(cut, -4, 0),
        ground(cut, 4, 0),
        ground(far, 4, 0),
        ground(far, -4, 0),
      ])
    }
    return [...pieces.values()]
  }

  const cuts = pose.hold ? [-half, half] : barCuts(pose)
  cuts.slice(1).forEach((end, i) => {
    const start = cuts[i]
    const piece = pieceAt(cellAt(pose, (start + end) / 2))
    for (const { layer, span, width, h } of layers) {
      const a = Math.max(start === -half ? start : start - OVERLAP, span[0])
      const b = Math.min(end === half ? end : end + OVERLAP, span[1])
      if (b - a < 1e-6) continue
      piece.faces.push(...prism(pose, layer, [a, b], width, h, [a === span[0], b === span[1]]))
    }
  })

  return [...pieces.values()]
}

type Side = 'top' | 'left' | 'right'

// 달궈질 때 섞는 숯불빛과 그 몫
const HEATED: Record<BarLayer, Record<Side, [string, number]>> = {
  base: { top: ['heat-top', 0.35], left: ['heat-left', 0.35], right: ['heat-right', 0.35] },
  body: { top: ['heat-hi', 0.5], left: ['heat-left', 0.55], right: ['heat-right', 0.55] },
  sheen: { top: ['heat-hot', 0.6], left: ['heat-crack', 0.45], right: ['heat-hot', 0.45] },
}

const coldTone = (layer: BarLayer, side: Side) =>
  layer === 'base'
    ? shade('iron-base', side)
    : layer === 'body'
      ? shade('iron', side)
      : side === 'top'
        ? 'var(--color-iron-sheen)'
        : blend(shade('iron', side), 'white', 0.2)

// 막대 면 색, 옆면은 돌아간 만큼 왼쪽 면과 오른쪽 면 사이
export const barTone = (face: Pick<BarFace, 'layer' | 'top' | 'k'>, heat: number) => {
  const tone = (side: Side) => {
    const [token, amount] = HEATED[face.layer][side]
    const cold = coldTone(face.layer, side)
    return heat > 0 ? blend(cold, `var(--color-${token})`, amount * heat) : cold
  }
  if (face.top) return tone('top')
  return face.k <= 0
    ? tone('left')
    : face.k >= 1
      ? tone('right')
      : blend(tone('left'), tone('right'), face.k)
}

// 막대 밑 평면의 색과 진하기, 그늘은 먹 14%, 닿는 띠는 막대 색 55%
export const flatLook = ({ kind, opacity }: BarFlat) =>
  kind === 'shadow'
    ? { fill: 'var(--color-ink)', opacity: 0.14 * opacity }
    : kind === 'contact'
      ? { fill: 'var(--color-iron)', opacity: 0.55 * opacity }
      : kind === 'lip'
        ? { fill: shade('iron-base', 'top'), opacity }
        : { fill: 'var(--color-iron-sheen)', opacity }
