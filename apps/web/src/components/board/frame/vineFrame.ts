import { directionBetween } from './cubeFrame'
import { clamp01, easeOut, lerp } from './curveFrame'
import { swampTime } from './swampFrame'
import {
  type CountView,
  NO_SWAMP,
  type SwampTime,
  countDisplay,
  elapsedAt,
  moveSeconds,
} from './timeFrame'
import { vinesLeft } from '@/game/rules'
import type { Direction, GameEvent, GameState } from '@/game/types'

export type VineKind = 'root' | 'grown' | 'next' | 'future' | 'spent'

export interface VineLook {
  kind: VineKind
  enter: Direction | null // 줄기가 들어오는 방향, 뿌리는 null
  leave: Direction | null
  hard: boolean // 굳은 덩굴의 자란 칸
  knot: boolean // 봉오리로 닫히는 굳은 덩굴의 끝 칸
}

// 덩굴 뿌리와 길 칸마다 그릴 모습, 키는 "x-y"
export const vineLooks = (state: GameState): Map<string, VineLook> => {
  const looks = new Map<string, VineLook>()
  const vines = state.stage.entities.filter((e) => e.type === 'vine')

  vines.forEach((vine, i) => {
    const { grown, stopped } = state.vines[i]
    const line = [{ x: vine.x, y: vine.y }, ...vine.cells]
    const look = (kind: VineKind, enter: Direction | null, leave: Direction | null) => ({
      kind,
      enter,
      leave,
      hard: false,
      knot: false,
    })

    looks.set(`${vine.x}-${vine.y}`, look('root', null, directionBetween(line[0], line[1])))
    vine.cells.forEach((cell, k) => {
      const enter = directionBetween(line[k], cell)
      // 끝 칸은 들어온 쪽으로 곧게 나가는 방향
      const leave = line[k + 2] ? directionBetween(cell, line[k + 2]) : enter
      const kind = k < grown ? 'grown' : stopped ? 'spent' : k === grown ? 'next' : 'future'
      const hard = stopped && k < grown
      looks.set(`${cell.x}-${cell.y}`, {
        ...look(kind, enter, leave),
        hard,
        knot: hard && k === grown - 1,
      })
    })
  })

  return looks
}

// 싹 키 px, 다음 자랄 칸이 더 큰 값
export const VINE_SPROUT = { next: 24, future: 14 }

// 다음 자랄 칸으로 넘어온 혀의 길이, 칸 단위
export const VINE_TONGUE = 0.2

// 한 수에 한 칸을 같은 빠르기로 가는 줄기 끝, 혀 끝에서 출발해 칸 끝에 닿는 몫
const VINE_TIP = 1 - VINE_TONGUE

// 이 수의 진행도에서 시작하는 자리와 걸리는 몫
const VINE_RISE = { from: 0, span: 1 } // 판이 구덩이에서 차오르는 구간

const VINE_NEXT = { from: 0, span: 1 } // 새 다음 칸의 싹이 크는 구간

const VINE_HARD = { from: 0.4, span: 0.6 } // 굳는 구간

export interface VineFrame {
  kind: VineKind
  enter: Direction | null
  leave: Direction | null
  growth: number // 줄기가 칸을 건너는 진행도 0~1, 1보다 작은 것은 이 수에 자라는 칸
  rise: number // 판이 구덩이에서 차오른 정도 0~1
  tongue: number // 다음 칸으로 넘어온 혀 길이 0~1
  sprout: number // 싹 키 px, 0이면 싹 없는 칸
  sproutOpacity: number
  hard: number // 굳은 정도 0~1
  knot: number // 봉오리가 돋은 정도 0~1
  opacity: number // 줄기와 잎의 투명도, 재시작하면 0
}

// 이 수에서 덩굴이 움직이는 진행도 0~1, 늪에서 뽑혀 나오는 동안은 0
export const vineProgress = (events: GameEvent[], t: number, swamp: SwampTime = NO_SWAMP) => {
  const moving = moveSeconds(events, swamp) - swamp.lead
  return moving <= 0 ? 1 : clamp01(elapsedAt(events, swamp, t) / moving)
}

const stillVine = (look: VineLook): VineFrame => ({
  kind: look.kind,
  enter: look.enter,
  leave: look.leave,
  growth: 1,
  rise: 1,
  tongue: look.kind === 'next' ? 1 : 0,
  sprout: look.kind === 'next' ? VINE_SPROUT.next : look.kind === 'future' ? VINE_SPROUT.future : 0,
  sproutOpacity: 1,
  hard: look.hard ? 1 : 0,
  knot: look.knot ? 1 : 0,
  opacity: 1,
})

const phase = (p: number, { from, span }: { from: number; span: number }) =>
  easeOut(clamp01((p - from) / span))

// 덩굴 칸마다 이 순간의 모습, 자라기와 굳기와 재시작 되돌림은 앞뒤 모습 차이로 구분
export const vineFrames = (
  prev: GameState | null,
  game: GameState,
  events: GameEvent[],
  t: number,
  swamp: SwampTime = NO_SWAMP,
  restarting = false,
): Map<string, VineFrame> => {
  const after = vineLooks(game)
  if (!prev || t >= 1) return new Map([...after].map(([key, look]) => [key, stillVine(look)]))

  const before = vineLooks(prev)
  const p = restarting ? 0 : vineProgress(events, t, swamp)
  const back = easeOut(t)
  const hard = phase(p, VINE_HARD)

  return new Map(
    [...after].map(([key, look]): [string, VineFrame] => {
      const was = before.get(key) ?? look
      const still = stillVine(look)

      // 재시작하면 구덩이로 내려가는 자란 칸의 판, 그 자리에 다시 돋는 싹
      if (restarting) {
        if (was.kind === 'grown' && look.kind !== 'grown') {
          return [
            key,
            {
              ...stillVine(was),
              rise: 1 - back,
              opacity: 1 - back,
              sprout: still.sprout,
              sproutOpacity: back,
            },
          ]
        }
        return [key, was.kind === 'spent' ? { ...still, sproutOpacity: back } : still]
      }

      if (was.kind === 'next' && look.kind === 'grown') {
        const rise = phase(p, VINE_RISE)
        return [
          key,
          {
            ...still,
            growth: clamp01(p / VINE_TIP),
            rise,
            sprout: VINE_SPROUT.next,
            sproutOpacity: 1 - rise,
          },
        ]
      }
      if (was.kind === 'future' && look.kind === 'next') {
        return [
          key,
          {
            ...still,
            tongue: clamp01((p - VINE_TIP) / (1 - VINE_TIP)),
            sprout: lerp(VINE_SPROUT.future, VINE_SPROUT.next, phase(p, VINE_NEXT)),
          },
        ]
      }
      if (was.kind === 'grown' && look.hard && !was.hard) {
        return [key, { ...still, hard, knot: look.knot ? hard : 0 }]
      }
      // 굳은 덩굴의 남은 자리, 물러나는 혀와 사라지는 싹
      if (look.kind === 'spent' && was.kind !== 'spent') {
        return [
          key,
          {
            ...stillVine(was),
            tongue: was.kind === 'next' ? 1 - hard : 0,
            sproutOpacity: 1 - hard,
          },
        ]
      }
      return [key, still]
    }),
  )
}

// 새로 굳은 덩굴마다 판이 짙어지기 시작하는 초
export const hardenSeconds = (prev: GameState, game: GameState, events: GameEvent[]) => {
  const swamp = swampTime(prev, game)
  const at = swamp.lead + VINE_HARD.from * (moveSeconds(events, swamp) - swamp.lead)
  return game.vines.filter((v, i) => v.stopped && !prev.vines[i].stopped).map(() => at)
}

export const vinesDisplay = (view: CountView) => countDisplay(view, vinesLeft, hardenSeconds)
