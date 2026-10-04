import { spotPoints } from './cellView'
import { CUBE } from './cubeView'
import { blend } from './shadeView'
import { waterDepth } from './waterView'
import { TILE, blockFaces, isoDelta } from '@/game/iso'
import type { Direction, Point, Stage } from '@/game/types'

// 깊어지는 면의 바탕 판과 원 넷, 반지름은 칸 단위, 원마다 도는 쪽으로 밀리는 거리와 각
export const BOWL = { plate: 0.96, shift: 0.035, turn: 0.9 }
const RINGS: [number, string][] = [
  [0.44, blend('var(--color-water-1)', 'var(--color-water-2)', 0.5)],
  [0.31, 'var(--color-water-2)'],
  [0.18, blend('var(--color-water-2)', 'var(--color-water-3)', 0.6)],
  [0.08, 'var(--color-water-3)'],
]

// 바깥 원 셋에 감기는 반사 초승달, 시작 각 간격과 감기는 각과 최대 폭
const CRESCENT = { gap: 2.1, span: 2.2, width: 0.115, steps: 12 }
const CIRCLE_STEPS = 28

// 물길 띠 반폭과 먼 가장자리 선 폭, 칸 단위
export const LANE = { half: 0.2, edge: 0.035 }

// 막은 상자 비침, 상자 폭 배수
export const GHOST = { outer: 1.05, inner: 0.62 }

// 앞 칸에 멈춘 배가 소용돌이 쪽으로 쏠리는 칸 단위 거리와 잠기는 px
export const LEAN = { reach: 0.08, dip: 3 }

const OFFSETS: Record<Direction, Point> = {
  up: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
}
const DIRECTIONS = Object.keys(OFFSETS) as Direction[]

const uv = (list: [number, number][]) => list.map(([u, v]) => `${u},${v}`).join(' ')

const circle = (r: number, ou: number, ov: number): [number, number][] =>
  Array.from({ length: CIRCLE_STEPS }, (_, i) => {
    const a = (Math.PI * 2 * i) / CIRCLE_STEPS
    return [ou + r * Math.cos(a), ov + r * Math.sin(a)]
  })

// 끝으로 갈수록 굵어지다 끝에서 닫히는 초승달
const crescent = (r: number, ou: number, ov: number, a0: number): [number, number][] => {
  const outer: [number, number][] = []
  const inner: [number, number][] = []
  for (let i = 0; i <= CRESCENT.steps; i += 1) {
    const t = i / CRESCENT.steps
    const a = a0 + CRESCENT.span * t
    const w = CRESCENT.width * t ** 0.75 * (t > 0.92 ? (1 - t) / 0.08 : 1)
    outer.push([ou + r * Math.cos(a), ov + r * Math.sin(a)])
    inner.unshift([ou + (r - w) * Math.cos(a), ov + (r - w) * Math.sin(a)])
  }
  return [...outer, ...inner]
}

// 칸 가운데가 원점인 칸 단위 좌표의 원과 초승달, 늘어선 차례대로 그리는 것
export const BOWL_SHAPES: { points: string; fill: string }[] = RINGS.flatMap(([r, fill], k) => {
  const a = k * BOWL.turn
  const ou = BOWL.shift * k * Math.cos(a)
  const ov = BOWL.shift * k * Math.sin(a)
  return [
    { points: uv(circle(r, ou, ov)), fill },
    ...(k < 3
      ? [
          {
            points: uv(crescent(r, ou, ov, k * CRESCENT.gap)),
            fill: 'var(--color-water-reflect)',
          },
        ]
      : []),
  ]
})

// 칸 단위 좌표를 (x, y) 가운데의 화면 좌표로 옮기는 변환
export const cellMatrix = (x: number, y: number) =>
  `matrix(${TILE.width / 2} ${TILE.height / 2} ${-TILE.width / 2} ${TILE.height / 2} ${x} ${y})`

export const whirlpoolsOf = (stage: Stage): Point[] =>
  stage.entities.filter((e) => e.type === 'whirlpool').map(({ x, y }) => ({ x, y }))

export interface Lane {
  whirl: number // 판의 소용돌이 순서
  axis: 'x' | 'y'
  toward: Direction // 소용돌이 쪽
  front: boolean // 소용돌이 바로 앞 칸
}

// 칸마다 그 칸을 지나는 물길, 소용돌이에서 네 방향으로 물 칸이 이어진 데까지
export const pullLanes = (stage: Stage) => {
  const lanes = new Map<string, Lane>()
  whirlpoolsOf(stage).forEach((whirl, i) =>
    DIRECTIONS.forEach((direction) => {
      const d = OFFSETS[direction]
      const toward = DIRECTIONS.find((o) => OFFSETS[o].x === -d.x && OFFSETS[o].y === -d.y)!
      for (let k = 1; ; k += 1) {
        const p = { x: whirl.x + d.x * k, y: whirl.y + d.y * k }
        if (waterDepth(stage, p) === 0) break
        lanes.set(`${p.x}-${p.y}`, {
          whirl: i,
          axis: d.x === 0 ? 'y' : 'x',
          toward,
          front: k === 1,
        })
      }
    }),
  )
  return lanes
}

// 칸을 가로지르는 띠와 먼 가장자리 선, y는 수면 가운데
export const lanePoints = (x: number, y: number, axis: 'x' | 'y') => {
  const at = (t: number, s: number): [number, number] => (axis === 'x' ? [t, s] : [s, t])
  const strip = (s0: number, s1: number) =>
    spotPoints(x, y, [at(-0.5, s0), at(0.5, s0), at(0.5, s1), at(-0.5, s1)])
  return {
    band: strip(-LANE.half, LANE.half),
    edge: strip(-LANE.half, -LANE.half + LANE.edge),
  }
}

// 쏠림의 끝 자리와 세기 0~1, CSS 변수로 넘기는 화면 거리
export const leanShift = (toward: Direction, amp: number) => {
  const d = isoDelta(OFFSETS[toward].x * LEAN.reach, OFFSETS[toward].y * LEAN.reach)
  return { '--lean-x': `${d.x}px`, '--lean-y': `${d.y + LEAN.dip}px`, '--lean-amp': amp }
}

// 쏠렸다 돌아오는 한 번의 진행도, 쏠린 자리는 whirl-lean 몫
export const LEAN_LOOP: Keyframe[] = [
  { '--lean-phase': 0, easing: 'ease-in-out' },
  { '--lean-phase': 1, easing: 'ease-in-out' },
  { '--lean-phase': 0 },
]

export const ghostWidths = {
  outer: TILE.width * CUBE * GHOST.outer,
  inner: TILE.width * CUBE * GHOST.inner,
}

// 멈출 때 퍼지는 고리 테 폭, 칸 폭 배수
const RING_WIDTH = 0.07

// 가운데가 빈 마름모 고리, size는 칸 폭 배수
export const ringPath = (x: number, y: number, size: number) =>
  `M${blockFaces(x, y, TILE.width * size, 0).top}Z M${blockFaces(x, y, TILE.width * (size - RING_WIDTH), 0).top}Z`
