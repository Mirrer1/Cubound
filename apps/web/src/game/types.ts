export type Direction = 'up' | 'right' | 'down' | 'left'

export interface Point {
  x: number
  y: number
}

export interface Stage {
  id: string
  name: string
  heights: number[][] // 행(y) 먼저, -1은 바닥 없음
  start: Point
  goal: Point
}

export interface GameState {
  stage: Stage
  player: Point
  moves: number
  cleared: boolean
}

export type GameEvent =
  | { type: 'moved'; from: Point; to: Point }
  | { type: 'fell'; from: Point; to: Point; drop: number } // drop은 층 수
  | { type: 'blocked'; direction: Direction }
  | { type: 'cleared' }

export interface MoveResult {
  state: GameState
  events: GameEvent[]
}
