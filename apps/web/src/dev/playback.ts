import type { Follow } from './follow'
import { createState, move } from '@/game/rules'
import type { Direction, Stage } from '@/game/types'

interface PlayView {
  follow: Follow | null
  length: number
  expect: number // 재생이 마지막으로 누른 뒤의 이동 수
  moves: number
  restarting: boolean
  guideOpen: boolean
  cleared: boolean
  collapsed: boolean
}

export const stateAt = (stage: Stage, path: Direction[], n: number) =>
  path.slice(0, n).reduce((state, direction) => move(state, direction).state, createState(stage))

// 뒤로 가서 설 이동 수, 벗어났으면 마지막으로 풀이 위에 있던 수
export const backTarget = (follow: Follow | null) => {
  if (follow?.kind === 'off') return follow.at
  if (follow?.kind === 'on' && follow.at > 0) return follow.at - 1
  return null
}

export const nextMove = (path: Direction[], follow: Follow | null) =>
  follow?.kind === 'on' && follow.at < path.length ? path[follow.at] : null

export const controlsOf = (path: Direction[], follow: Follow | null) => {
  const ahead = nextMove(path, follow) !== null
  return { back: backTarget(follow) !== null, play: ahead, forward: ahead }
}

export const playStops = (view: PlayView) =>
  view.collapsed ||
  view.guideOpen ||
  view.cleared ||
  view.restarting ||
  view.moves !== view.expect ||
  view.follow?.kind !== 'on' ||
  view.follow.at >= view.length
