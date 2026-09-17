import { create } from 'zustand'

import { createState, move } from '@/game/rules'
import type { Direction, GameEvent, GameState, Stage } from '@/game/types'
import stage01 from '@/stages/world-1/01.json'

interface GameStore {
  game: GameState
  events: GameEvent[]
  move: (direction: Direction) => void
  restart: () => void
}

export const useGameStore = create<GameStore>((set) => ({
  game: createState(stage01 as Stage),
  events: [],
  move: (direction) =>
    set(({ game }) => {
      const result = move(game, direction)
      return { game: result.state, events: result.events }
    }),
  restart: () => set(({ game }) => ({ game: createState(game.stage), events: [] })),
}))
