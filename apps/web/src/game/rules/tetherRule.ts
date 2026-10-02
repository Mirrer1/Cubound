import type { Entity, GameState, Point, Stage } from '../types'
import { same } from './cellRule'

type Post = Extract<Entity, { type: 'post' }>

export const posts = (stage: Stage) => stage.entities.filter((e): e is Post => e.type === 'post')

export const isPost = (stage: Stage, p: Point) =>
  stage.entities.some((e) => e.type === 'post' && same(e, p))

// 묶인 배의 범위, 말뚝에서 가로 칸 수와 세로 칸 수의 합이 줄 길이 이하인 칸
export const withinReach = (state: GameState, boat: Point, to: Point) => {
  const n = state.tethered.findIndex((p) => same(p, boat))
  if (n < 0) return true

  const post = posts(state.stage)[n]
  return Math.abs(to.x - post.x) + Math.abs(to.y - post.y) <= post.length
}

export const moveTethered = (state: GameState, from: Point, to: Point) =>
  state.tethered.map((p) => (same(p, from) ? to : p))
