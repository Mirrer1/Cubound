import { create } from 'zustand'

import { type Progress, recordClear, shouldShowGuide } from '@/game/progress'
import { createState, move } from '@/game/rules'
import type { Direction, GameEvent, GameState } from '@/game/types'
import { localProgressStorage } from '@/platform/storage'
import { STAGES } from '@/stages'

export type Screen = 'title' | 'select' | 'play'

const MAX_QUEUE = 2

interface GameStore {
  screen: Screen
  progress: Progress
  game: GameState | null
  prevGame: GameState | null // 연출 시작 전 상태
  events: GameEvent[]
  turn: number
  animating: boolean
  queue: Direction[] // 연출 중 들어온 입력
  chained: boolean // 지금 연출이 대기열에서 이어진 이동
  guideStep: number | null // 보고 있는 가이드 단계
  goTo: (screen: Screen) => void
  play: (stageId: string) => void
  move: (direction: Direction, repeat?: boolean, chained?: boolean) => void
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
  queue: [],
  chained: false,
})

export const useGameStore = create<GameStore>((set, get) => ({
  screen: 'title',
  progress: localProgressStorage.load(),
  game: null,
  prevGame: null,
  events: [],
  turn: 0,
  animating: false,
  queue: [],
  chained: false,
  guideStep: null,
  goTo: (screen) => set({ screen }),
  play: (stageId) =>
    set(({ turn, progress }) => ({
      screen: 'play',
      ...fresh(createState(STAGES[stageId]), turn),
      guideStep: shouldShowGuide(STAGES[stageId], progress) ? 0 : null,
    })),
  move: (direction, repeat = false, chained = false) =>
    set(({ game, progress, animating, queue, turn, guideStep }) => {
      if (!game || guideStep !== null) return {}
      // 키를 누르고 있을 때는 1개만 기다리게 해 손을 뗀 뒤 밀려 움직이지 않게 한다
      if (animating) {
        return queue.length < (repeat ? 1 : MAX_QUEUE) ? { queue: [...queue, direction] } : {}
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
      if (!result.state.cleared || game.cleared) return next

      const cleared = recordClear(
        progress,
        game.stage.id,
        result.state.moves,
        game.stage.best ?? result.state.moves,
      )
      localProgressStorage.save(cleared)
      return { ...next, progress: cleared }
    }),
  finishAnimation: () => {
    const [next, ...rest] = get().queue
    set({ animating: false, queue: rest })
    if (next) get().move(next, false, true)
  },
  restart: () =>
    set(({ game, turn, guideStep }) =>
      game && guideStep === null ? fresh(createState(game.stage), turn) : {},
    ),
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
