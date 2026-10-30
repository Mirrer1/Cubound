import { clamp01, lerp, smooth } from './curveFrame'
import { has } from './pathFrame'
import type { GameEvent, GameState, Point } from '@/game/types'

// 남은 수마다 꼬리 불 세기
const LEVEL = [0, 0.76, 0.88, 1]

// 켜지는 꼬리 불 빛 고임이 차오르기 시작하는 크기 비
export const TRAIL_POOL = 1

const levelOf = (state: GameState, p: Point) =>
  LEVEL[state.trail.find((t) => t.x === p.x && t.y === p.y)?.left ?? 0] ?? 0

const outOf = (events: GameEvent[]) => events.flatMap((e) => (e.type === 'trailOut' ? [e.at] : []))

interface TrailView {
  before: GameState
  game: GameState
  events: GameEvent[]
  prevEvents: GameEvent[]
  moving: boolean
  dropping: boolean
  t: number
  stepT: number
}

// 그 순간 판 전체의 꼬리 불 값, 꼬리 불 판이 아니면 null
export const trailScene = (view: TrailView) => {
  const { before, game, events, prevEvents, moving, dropping, t, stepT } = view
  if (!game.stage.rules?.trail) return null
  const going = moving && !dropping
  return {
    before,
    game,
    dropping,
    q: moving ? smooth(stepT) : 1,
    back: dropping ? smooth(clamp01(t)) : 1,
    out: going ? outOf(events) : [],
    // 앞 수에 꺼져 이번 수 동안 지워지는 그을음
    fading: going ? outOf(prevEvents) : [],
    marked: moving ? [] : outOf(events),
  }
}

export type TrailScene = ReturnType<typeof trailScene>

export interface TrailLook {
  flame: number // 불 세기
  pool: number // 빛 고임 크기 비
  mark: number // 꺼진 자리 그을음 진하기
  lit: boolean // 켜진 불, false는 수 길이와 따로 옅어지는 불
}

export const NO_TRAIL: TrailLook = { flame: 0, pool: 1, mark: 0, lit: true }

// 칸 하나의 꼬리 불 모습, 켜짐과 꺼짐의 투명도는 BoardTrail의 useFade 몫
export const trailLookOf = (scene: TrailScene, p: Point): TrailLook => {
  if (!scene) return NO_TRAIL
  const { before, game, q, back } = scene
  const was = levelOf(before, p)
  if (scene.dropping) return { ...NO_TRAIL, flame: was * (1 - back) }
  if (has(scene.out, p)) return { ...NO_TRAIL, flame: was, mark: q, lit: false }
  const now = levelOf(game, p)
  if (now > 0 && was === 0) return { ...NO_TRAIL, flame: now, pool: lerp(TRAIL_POOL, 1, q) }
  if (now > 0) return { ...NO_TRAIL, flame: lerp(was, now, q) }
  if (has(scene.fading, p)) return { ...NO_TRAIL, flame: LEVEL[1], mark: 1 - q, lit: false }
  if (has(scene.marked, p)) return { ...NO_TRAIL, flame: LEVEL[1], mark: 1, lit: false }
  return NO_TRAIL
}
