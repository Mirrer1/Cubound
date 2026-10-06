import { TILE } from '@/game/iso'
import type { Direction } from '@/game/types'

// 시안 J절 얼음 돌, 칸 폭 배수 너비와 px 높이 세 단, frost는 땅 위 돌 밑 서리 판, line은 물에 뜬 돌 밑 선이 돌보다 넓은 칸 폭 배수
// floatCut은 물에 뜬 돌의 잠긴 아랫단 px, meltCut은 다 녹을 때 더 잠기는 px
export const STONE = {
  steps: [
    { width: 0.64, depth: 14 },
    { width: 0.48, depth: 8 },
    { width: 0.28, depth: 4 },
  ],
  frost: 0.9,
  line: 0.09,
  floatCut: 8,
  meltCut: 10,
}

// 언 물 판, 윗면이 같은 높이 땅보다 낮은 px와 판 두께
export const ICE = { below: 2, slab: 4 }

// 서리 판이 처음 생길 때 다 자란 크기에 대한 비율
const FROST_SEED = 0.3

// 서리 판이 생기거나 사라지는 동안의 칸 폭 배수, 돌 바닥 가운데에서 퍼지는 크기
export const frostWidth = (frost: number) => STONE.frost * (FROST_SEED + (1 - FROST_SEED) * frost)

// 멈춰 선 돌이 물에 뜬 정도, 언 판 밑까지 차면 0에서 한 층 다 차면 1로 이어지는 값
export const stoneFloat = (depth: number) =>
  Math.min(1, Math.max(0, (depth * TILE.layer - ICE.below) / (TILE.layer - ICE.below)))

// 얼어붙은 배의 얼음 위로 보이는 px, 서리 테와 그 바깥 금의 상자 폭 배수
export const LOCKED = { shown: 3, rim: 1.3, crack: 1.42 }

export type StoneTone = 'base' | 'mid' | 'peak'

// 바닥 중심 (x, y)에 선 돌 세 단의 윗면 중심과 크기, cut은 아랫단에서 잠긴 px, k는 녹으며 줄어든 비율
export const stoneSteps = (x: number, y: number, cut: number, k: number) => {
  const tones: StoneTone[] = ['base', 'mid', 'peak']
  let top = y
  return STONE.steps.map((step, i) => {
    const depth = (i === 0 ? Math.max(2, step.depth - cut) : step.depth) * k
    top -= depth
    return { x, y: top, width: TILE.width * step.width * k, depth, tone: tones[i] }
  })
}

const corner = (x: number, y: number, u: number, v: number) =>
  `${x + ((u - v) * TILE.width) / 2},${y + ((u + v) * TILE.height) / 2}`

// 자라는 앞 가장자리에서 모서리가 가운데보다 늦는 정도, 앞 가장자리를 나눈 점 수
const FRONT = { bulge: 0.6, steps: 8 }

// 붙은 쪽 가장자리에서 cover만큼 덮은 언 물 판의 윗면과 보이는 두 옆면, (x, y)는 칸 윗면 중심
// a는 붙은 가장자리에서 자란 거리, b는 가장자리를 따라간 자리
export const icePlate = (x: number, y: number, cover: number, from: Direction) => {
  const reach = (b: number) =>
    Math.min(1, Math.max(0, cover - FRONT.bulge * (2 * b) ** 2 * (1 - cover)))
  const at = (a: number, b: number): [number, number] =>
    from === 'left'
      ? [-0.5 + a, b]
      : from === 'right'
        ? [0.5 - a, b]
        : from === 'up'
          ? [b, -0.5 + a]
          : [b, 0.5 - a]
  const top = ([u, v]: [number, number]) => corner(x, y, u, v)
  const down = ([u, v]: [number, number]) => corner(x, y + ICE.slab, u, v)
  const side = (line: [number, number][]) =>
    [...line.map(top), ...[...line].reverse().map(down)].join(' ')

  const bs = Array.from({ length: FRONT.steps + 1 }, (_, i) => -0.5 + i / FRONT.steps)
  const front = bs.map((b) => at(reach(b), b))
  const edge = [at(0, 0.5), at(reach(0.5), 0.5)]
  const attached = [at(0, -0.5), at(0, 0.5)]
  // 앞 가장자리가 보이는 쪽(오른쪽으로 자라면 오른 옆면, 아래로 자라면 왼 옆면)
  const across = from === 'left' || from === 'right'
  const facing = from === 'left' || from === 'up'
  return {
    top: [...front, at(0, 0.5), at(0, -0.5)].map(top).join(' '),
    left: side(across ? edge : facing ? front : attached),
    right: side(across ? (facing ? front : attached) : edge),
  }
}
