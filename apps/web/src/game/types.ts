export type Direction = 'up' | 'right' | 'down' | 'left'

export interface Point {
  x: number
  y: number
}

export type Entity = { type: 'box' } & Point

export interface Stage {
  id: string
  name: string
  heights: number[][] // 행(y) 먼저, -1은 바닥 없음
  start: Point
  goal: Point
  entities: Entity[]
}

export interface GameState {
  stage: Stage
  heights: number[][] // 상자로 메운 칸이 반영된 높이
  boxes: Point[]
  player: Point
  moves: number
  cleared: boolean
}

export type GameEvent =
  | { type: 'moved'; from: Point; to: Point }
  | { type: 'fell'; from: Point; to: Point; drop: number } // drop은 층 수
  | { type: 'climbed'; from: Point; to: Point }
  | { type: 'pushed'; from: Point; to: Point; result: 'slid' | 'fell' | 'filled' }
  | { type: 'blocked'; direction: Direction }
  | { type: 'cleared' }

export interface MoveResult {
  state: GameState
  events: GameEvent[]
}
