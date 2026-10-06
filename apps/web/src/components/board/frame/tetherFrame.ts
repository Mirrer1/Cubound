import { moorCells, postsOf, ropeEnds, ropePoints } from '../view'
import type { BoxFrame } from './boxFrame'
import { clamp01, lerp, smooth } from './curveFrame'
import { same } from './pathFrame'
import { restartDrop } from './restartFrame'
import { waterLevel } from '@/game/rules'
import type { GameState, Point, Stage } from '@/game/types'

export interface TetherFrame {
  slack: number // 처진 정도, 범위 끝에서 0
  active: number // 큐브가 탄 정도
  opacity: number
  points: string
  depth: number // 줄의 뒤쪽 끝 깊이, 이보다 앞에 선 큐브가 가리는 줄
  ridden: boolean // 말뚝보다 뒤가 아닌 배에 큐브가 탄 줄, 탄 큐브가 가리는 줄
}

interface TetherView {
  prev: GameState | null
  game: GameState
  box: BoxFrame | null
  t: number
  dropping: boolean
}

const riding = (state: GameState, boat: Point) => (same(state.player, boat) ? 1 : 0)

// 말뚝 순서대로 줄과 범위, 저어 가는 배는 그 순간 자리
export const tetherFrames = ({ prev, game, box, t, dropping }: TetherView): TetherFrame[] => {
  const { stage, boxes } = game
  return postsOf(stage).map((post, i) => {
    const boat = game.tethered[i]
    const rowing = prev !== null && box !== null && !same(prev.tethered[i], boat)
    const at = rowing ? { x: box.x, y: box.y } : boat
    const drop = dropping
      ? restartDrop(t, boxes.findIndex((b) => same(b, boat)) + 1, boxes.length, game.stones.length)
      : null
    const top = rowing ? box.level + 1 : waterLevel(game, at) + (drop?.lift ?? 0)
    const d = Math.abs(at.x - post.x) + Math.abs(at.y - post.y)
    const slack = smooth(clamp01(post.length - d))
    const { from, to } = ropeEnds(post, stage.heights[post.y][post.x], at, top)
    const was = prev ? riding(prev, prev.tethered[i]) : riding(game, boat)
    const active = lerp(was, riding(game, boat), prev ? smooth(t) : 1)

    return {
      slack,
      active,
      opacity: drop?.opacity ?? 1,
      points: ropePoints(from, to, slack),
      depth: Math.min(post.x + post.y, at.x + at.y),
      ridden: active > 0 && at.x + at.y >= post.x + post.y,
    }
  })
}

// 줄을 가리는 큐브, 줄의 뒤쪽 끝보다 반 칸 넘게 앞에 섰거나 말뚝보다 뒤가 아닌 배에 탄 큐브
export const coversRope = (cube: Point, frame: TetherFrame) =>
  frame.ridden || cube.x + cube.y > frame.depth + 0.5

// 범위 칸마다 그 칸을 범위로 갖는 배 중 큐브가 가장 많이 탄 정도
export const moorLooks = (stage: Stage, frames: TetherFrame[]) =>
  new Map(
    [...moorCells(stage)].map(([key, posts]) => [
      key,
      Math.max(...posts.map((i) => frames[i].active)),
    ]),
  )
