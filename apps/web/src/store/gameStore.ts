import { create } from 'zustand'

import { type Progress, recordClear, shouldShowGuide } from '@/game/progress'
import { createState, move } from '@/game/rules'
import { restoreSession, toSession } from '@/game/session'
import type { Direction, GameEvent, GameState } from '@/game/types'
import { localProgressStorage, localSessionStorage } from '@/platform/storage'
import { STAGES } from '@/stages'

// 기다리는 입력은 하나만 받는다. 더 받아 두면 손을 뗀 뒤에도 큐브가 움직여 이동 수를 까먹는다
const MAX_QUEUE = 1

interface GameStore {
  progress: Progress
  game: GameState | null
  prevGame: GameState | null // 연출 시작 전 상태
  events: GameEvent[]
  turn: number
  animating: boolean
  restarting: boolean // 처음 자리로 내려앉는 연출 중
  queue: Direction[] // 연출 중 들어온 입력
  chained: boolean // 지금 연출이 대기열에서 이어진 이동
  guideStep: number | null // 보고 있는 가이드 단계
  enter: (stageId: string) => void
  move: (direction: Direction, chained?: boolean) => void
  finishAnimation: () => void
  restart: () => void
  openGuide: () => void
  nextGuide: () => void
  closeGuide: () => void
}

const fresh = (game: GameState, turn: number) => ({
  game,
  prevGame: null,
  events: [],
  turn: turn + 1,
  animating: false,
  restarting: false,
  queue: [],
  chained: false,
})

export const useGameStore = create<GameStore>((set, get) => ({
  progress: localProgressStorage.load(),
  game: null,
  prevGame: null,
  events: [],
  turn: 0,
  animating: false,
  restarting: false,
  queue: [],
  chained: false,
  guideStep: null,
  // 중간 상태가 남아 있으면 이어서 시작하고 그때는 가이드를 띄우지 않는다
  enter: (stageId) =>
    set(({ turn, progress }) => {
      const stage = STAGES[stageId]
      const saved = restoreSession(localSessionStorage.load(), stage)
      return {
        ...fresh(saved ?? createState(stage), turn),
        guideStep: !saved && shouldShowGuide(stage, progress) ? 0 : null,
      }
    }),
  move: (direction, chained = false) =>
    set(({ game, progress, animating, restarting, queue, turn, guideStep }) => {
      if (!game || guideStep !== null || restarting) return {}
      if (animating) {
        return queue.length < MAX_QUEUE ? { queue: [...queue, direction] } : {}
      }

      const result = move(game, direction)
      if (result.state === game && result.events.length === 0) return {}

      const next = {
        prevGame: game,
        game: result.state,
        events: result.events,
        turn: turn + 1,
        animating: true,
        chained,
      }
      if (result.state.cleared) localSessionStorage.clear()
      else localSessionStorage.save(toSession(result.state))
      if (!result.state.cleared || game.cleared) return next

      const cleared = recordClear(
        progress,
        game.stage.id,
        result.state.moves,
        game.stage.best ?? result.state.moves,
        game.stage.rules?.moveLimit,
      )
      localProgressStorage.save(cleared)
      return { ...next, progress: cleared }
    }),
  finishAnimation: () => {
    const [next, ...rest] = get().queue
    set({ animating: false, restarting: false, queue: rest })
    if (next) get().move(next, true)
  },
  // 연출 중에 다시 눌러도 기다리지 않고 처음부터 다시 시작한다
  restart: () =>
    set(({ game, turn, guideStep }) => {
      if (!game || guideStep !== null) return {}
      localSessionStorage.clear()
      return { ...fresh(createState(game.stage), turn), prevGame: game, restarting: true }
    }),
  openGuide: () =>
    set(({ game }) => (game?.stage.guides?.length ? { guideStep: 0, queue: [] } : {})),
  nextGuide: () =>
    set(({ game, guideStep }) =>
      guideStep === null
        ? {}
        : { guideStep: guideStep + 1 < (game?.stage.guides?.length ?? 0) ? guideStep + 1 : null },
    ),
  closeGuide: () => set({ guideStep: null }),
}))
