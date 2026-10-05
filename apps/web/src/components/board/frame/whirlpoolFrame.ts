import { CUBE, type Lane, WATER, whirlpoolsOf } from '../view'
import { clamp01, easeOut, lerp, smooth } from './curveFrame'
import {
  NO_SWAMP,
  PLUG,
  type SwampTime,
  elapsedAt,
  has,
  moveSeconds,
  plugStart,
  pullStart,
  same,
} from './timeFrame'
import { frontOf } from './tramFrame'
import { TILE, toScreen } from '@/game/iso'
import { standHeight } from '@/game/rules'
import type { Direction, GameEvent, GameState, Point } from '@/game/types'

// 끌려가는 배가 더 잠기는 px
export const PULL_DIP = 8

// 끌려가는 배 뒤 물테 셋, 배 가운데에서 칸 단위 거리와 상자 폭 배수 크기와 진하기
const WAKE = [
  { behind: 0.28, size: 1.2, opacity: 0.75 },
  { behind: 0.5, size: 0.98, opacity: 0.53 },
  { behind: 0.72, size: 0.76, opacity: 0.31 },
]

// 끌려와 멈출 때 퍼지는 고리, 시작하는 진행도와 칸 폭 배수 크기와 진하기
const SETTLE = { from: 0.7, size: [0.7, 0.95], opacity: 0.4 }

// 마개 상자가 빨려 들어 수면 아래로 내려간 px, suck은 빨려 든 끝, close는 사라지는 끝
const PLUG_DEPTH = { suck: 8, close: 20 }

export interface WhirlBoxFrame {
  x: number
  y: number // 상자 윗면 중심
  shown: number // 수면 위로 보이는 높이 px
  opacity: number
  to: Point
  cell: Point // 덮이는 순서가 맞게 그리는 칸
  wake: { x: number; y: number; width: number; opacity: number }[] // 수면 위 물테
  ring: { x: number; y: number; size: number; opacity: number } | null // 칸 폭 배수 크기
}

interface WhirlView {
  before: GameState
  game: GameState
  events: GameEvent[]
  t: number
  swamp?: SwampTime
  moving: boolean
  dropping: boolean
}

type Pulled = Extract<GameEvent, { type: 'pulled' }>

const surfaceY = (game: GameState, p: { x: number; y: number }) =>
  toScreen(p, game.stage.water ?? 0).y + WATER.lip

// 한 칸 끌려가는 배, 출발한 뒤 그 수가 끝날 때까지 미끄러지듯 가는 자리
// 이 수에 밀어 띄운 상자는 다 뜰 때까지 상자 연출 몫이라 투명
const pulledFrame = (view: WhirlView, event: Pulled): WhirlBoxFrame => {
  const { game, events, t } = view
  const swamp = view.swamp ?? NO_SWAMP
  const start = pullStart(events, event)
  const end = moveSeconds(events, swamp)
  const elapsed = elapsedAt(events, swamp, t)
  const floating = events.some((e) => e.type === 'pushed' && same(e.to, event.from))

  const p = clamp01((elapsed - start) / Math.max(end - start, 1e-6))
  const at = {
    x: lerp(event.from.x, event.to.x, smooth(p)),
    y: lerp(event.from.y, event.to.y, smooth(p)),
  }
  const dip = PULL_DIP * Math.sin(Math.PI * p)
  const surface = surfaceY(game, at)
  const wakeOn = Math.sin(Math.PI * p)
  const dx = event.to.x - event.from.x
  const dy = event.to.y - event.from.y
  const r = clamp01((p - SETTLE.from) / (1 - SETTLE.from))
  const ringAt = toScreen(event.to, game.stage.water ?? 0)

  return {
    x: toScreen(at, 0).x,
    y: surface - WATER.lip + dip,
    shown: Math.max(0, WATER.lip - dip),
    opacity: floating && elapsed < start ? 0 : 1,
    to: event.to,
    cell: p > 0 ? frontOf(event.from, event.to) : event.from,
    wake:
      wakeOn > 0
        ? WAKE.map((w) => {
            const q = { x: at.x - dx * w.behind, y: at.y - dy * w.behind }
            return {
              x: toScreen(q, 0).x,
              y: surfaceY(game, q),
              width: TILE.width * CUBE * w.size,
              opacity: w.opacity * wakeOn,
            }
          })
        : [],
    ring:
      r > 0 && r < 1
        ? {
            x: ringAt.x,
            y: ringAt.y + WATER.lip,
            size: lerp(SETTLE.size[0], SETTLE.size[1], easeOut(r)),
            opacity: SETTLE.opacity * Math.sin(Math.PI * r),
          }
        : null,
  }
}

// 마개 구간마다의 진행도, 이 수에 막지 않으면 null
export const plugPhase = (events: GameEvent[], t: number, swamp: SwampTime = NO_SWAMP) => {
  const start = plugStart(events)
  if (start === null) return null

  const e = elapsedAt(events, swamp, t) - start
  return {
    push: clamp01(e / PLUG.push),
    suck: clamp01((e - PLUG.push) / PLUG.suck),
    close: clamp01((e - PLUG.push - PLUG.suck) / PLUG.close),
  }
}

// 소용돌이 칸으로 밀려 빨려 들며 사라지는 땅 상자
const plugBox = (view: WhirlView, phase: NonNullable<ReturnType<typeof plugPhase>>) => {
  const { before, game, events } = view
  const pushed = events
    .filter((e): e is Extract<GameEvent, { type: 'pushed' }> => e.type === 'pushed')
    .at(-1)
  if (!pushed) return null

  const at = {
    x: lerp(pushed.from.x, pushed.to.x, smooth(phase.push)),
    y: lerp(pushed.from.y, pushed.to.y, smooth(phase.push)),
  }
  const startTop = toScreen(at, standHeight(before, pushed.from)).y
  const surface = surfaceY(game, pushed.to)
  const top =
    phase.suck < 1
      ? lerp(startTop, surface + PLUG_DEPTH.suck, smooth(phase.suck))
      : lerp(surface + PLUG_DEPTH.suck, surface + PLUG_DEPTH.close, smooth(phase.close))

  const frame: WhirlBoxFrame = {
    x: toScreen(at, 0).x,
    y: top,
    shown: Math.min(TILE.layer, Math.max(0, surface - top)),
    opacity: 1 - smooth(phase.close),
    to: pushed.to,
    cell: frontOf(pushed.from, pushed.to),
    wake: [],
    ring: null,
  }
  return frame
}

const isOpen = (state: GameState, whirl: Point) => !has(state.plugged, whirl)

// 소용돌이마다 보이는 정도와 물길 진하기, 막은 자리의 비침 진하기
const whirlOpenings = (view: WhirlView, phase: ReturnType<typeof plugPhase>) => {
  const { before, game, events, t, moving, dropping } = view
  const plugged = events.find((e) => e.type === 'plugged')
  return whirlpoolsOf(game.stage).map((whirl) => {
    const now = isOpen(game, whirl) ? 1 : 0
    const was = isOpen(before, whirl) ? 1 : 0
    if (dropping && was !== now) {
      const p = smooth(clamp01(t))
      return { eye: lerp(was, now, p), lane: lerp(was, now, p), ghost: lerp(1 - was, 1 - now, p) }
    }
    if (moving && phase && plugged?.type === 'plugged' && same(plugged.at, whirl)) {
      return {
        eye: 1 - smooth(phase.suck),
        lane: 1 - phase.close,
        ghost: smooth(phase.close),
      }
    }
    return { eye: now, lane: now, ghost: 1 - now }
  })
}

// 그 순간 소용돌이들의 모습과 끌려가거나 빨려 드는 상자
export const whirlFrames = (view: WhirlView) => {
  const { events, t, moving } = view
  const phase = moving ? plugPhase(events, t, view.swamp) : null
  const pulled = moving
    ? events.filter((e): e is Pulled => e.type === 'pulled').map((e) => pulledFrame(view, e))
    : []
  const plug = phase ? plugBox(view, phase) : null

  return {
    openings: whirlOpenings(view, phase),
    boxes: plug ? [...pulled, plug] : pulled,
    plugging: phase !== null,
  }
}

export type WhirlFrames = ReturnType<typeof whirlFrames>

// 큐브와 같은 깊이 옆 칸에 그리는 배, 큐브를 같은 깊이 맨 뒤에 그릴 경우
export const pulledBeside = (boxes: { cell: Point }[], cube: Point) =>
  boxes.some(({ cell }) => cell.x + cell.y === cube.x + cube.y && Math.abs(cell.x - cube.x) === 1)

// 앞 칸에 멈춘 배가 쏠리는 쪽, 열린 소용돌이 한정
export const leanOf = (
  lane: Lane | undefined,
  game: GameState,
  p: Point,
  frames: WhirlFrames,
): Direction | null =>
  lane?.front && has(game.boxes, p) && frames.openings[lane.whirl].eye >= 1 ? lane.toward : null

// 칸에 넘길 소용돌이 값, eye는 소용돌이 칸, lane은 물길 칸, ghost는 막힌 칸, shown은 얼음에 끊긴 물길 진하기
export const whirlLook = (
  stage: GameState['stage'],
  p: Point,
  lane: Lane | undefined,
  frames: WhirlFrames,
  shown = 1,
) => {
  const whirl = whirlpoolsOf(stage).findIndex((w) => same(w, p))
  const opening = whirl >= 0 ? frames.openings[whirl] : null
  return {
    eye: opening?.eye ?? 0,
    ghost: opening?.ghost ?? 0,
    lane: lane ? lane.axis : null,
    laneOpacity: lane ? frames.openings[lane.whirl].lane * shown : 0,
  }
}
