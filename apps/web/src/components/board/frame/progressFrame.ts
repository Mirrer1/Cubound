import { clamp01, smooth } from './curveFrame'
import { totalSeconds } from './pathFrame'
import {
  FREEZE_SECONDS,
  NO_SWAMP,
  RISE_SECONDS,
  SHAKE_SECONDS,
  SLUICE,
  type SwampTime,
  durationOf,
  moveSeconds,
  playerSegments,
  rises,
  sluiceStart,
  tapSeconds,
} from './timeFrame'
import type { GameEvent, GameState } from '@/game/types'

// 흔들림 진행도, 흔들리지 않는 수는 0
export const shakeProgress = (events: GameEvent[], t: number, swamp: SwampTime = NO_SWAMP) => {
  if (!events.some((e) => e.type === 'cracked' && e.worn)) return 0
  const start = totalSeconds(playerSegments(events))
  return clamp01((t * durationOf(events, swamp) - start) / SHAKE_SECONDS)
}

// 물이 바뀌는 수의 꼭지, 수면, 새로 잠긴 칸이 어는 진행도, 드러나는 칸이 녹는 진행도와 그 뒤 돌 밑 판이 녹는 진행도, 물이 그대로인 수는 모두 1
export const sluicePhase = (events: GameEvent[], t: number, swamp: SwampTime = NO_SWAMP) => {
  const at = sluiceStart(events)
  if (at === null) return { tap: 1, level: 1, freeze: 1, thaw: 1, slab: 1 }

  const now = elapsedAt(events, swamp, t)
  const tap = tapSeconds(events)
  const afloat = at + tap + SLUICE.level * SLUICE.afloat
  return {
    tap: tap === 0 ? 1 : smooth(clamp01((now - at) / tap)),
    level: smooth(clamp01((now - at - tap) / SLUICE.level)),
    freeze: smooth(clamp01((now - afloat) / FREEZE_SECONDS)),
    thaw: smooth(clamp01((now - at) / FREEZE_SECONDS)),
    slab: smooth(clamp01((now - at - FREEZE_SECONDS) / (tap + SLUICE.level - FREEZE_SECONDS))),
  }
}

// 이동 몫의 진행도, 씨앗이 솟는 수는 솟기 전에 1
export const stepProgress = (events: GameEvent[], t: number, swamp: SwampTime = NO_SWAMP) => {
  const moving = moveSeconds(events, swamp)
  return moving <= 0 ? 1 : clamp01((t * durationOf(events, swamp)) / moving)
}

// 가속해 오르다 끝에서 느려지는 씨앗이 솟는 진행도
export const riseProgress = (events: GameEvent[], t: number, swamp: SwampTime = NO_SWAMP) => {
  if (!rises(events)) return 1

  const p = clamp01((t * durationOf(events, swamp) - moveSeconds(events, swamp)) / RISE_SECONDS)
  return p * p * (3 - 2 * p)
}

// 이동이 시작한 뒤로 흐른 시간, 늪에서 뽑혀 나오기를 기다리는 동안은 음수
export const elapsedAt = (events: GameEvent[], swamp: SwampTime, t: number) =>
  t * durationOf(events, swamp) - swamp.lead

export interface CountView {
  game: GameState | null
  prevGame: GameState | null
  events: GameEvent[]
  animating: boolean
  passed: number // 이 수의 연출에서 이미 지난 숫자가 바뀌는 순간 수
}

type Moments = (prev: GameState, game: GameState, events: GameEvent[]) => number[]

// 지난 순간 수만큼만 다음 숫자로 다가간 보스 숫자, at은 연출이 시작한 뒤 숫자가 바뀌는 초
export const countDisplay = (
  { game, prevGame, events, animating, passed }: CountView,
  count: (state: GameState) => number | null,
  moments: Moments,
) => {
  const after = game ? count(game) : null
  const before = prevGame ? count(prevGame) : null
  if (!game || !prevGame || !animating || after === null || before === null)
    return { at: [], count: after }

  const at = moments(prevGame, game, events)
  const step = Math.min(passed, Math.abs(after - before))
  return { at, count: passed >= at.length ? after : before + Math.sign(after - before) * step }
}
