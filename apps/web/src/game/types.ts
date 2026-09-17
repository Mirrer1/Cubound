export type Direction = 'up' | 'right' | 'down' | 'left'

export interface Point {
  x: number
  y: number
}

export type Entity = (
  | { type: 'box' }
  | { type: 'switch'; target: string }
  | { type: 'door'; id: string }
  | { type: 'ladder' }
) &
  Point

export interface Stage {
  version: 1
  id: string
  name: string
  heights: number[][] // 행(y) 먼저, -1은 바닥 없음
  start: Point
  goal: Point
  entities: Entity[]
  best?: number // 풀이 검사기가 구한 최소 이동 수
  guides?: Guide[] // 스텝 가이드 단계
  zones?: Zone[] // 카메라 구역, 없으면 맵 전체
}

export type GuideTarget = Point | 'restart' | 'moves' // 칸 좌표나 화면 요소 이름

export interface Guide {
  id: string // 문구 모음의 키
  target: GuideTarget
}

export interface Zone {
  x: number
  y: number
  w: number
  h: number
}

// (x, y) 칸에서 direction 쪽 높은 칸에 기대 놓인 사다리
export type LeaningLadder = Point & { direction: Direction }

export interface GameState {
  stage: Stage
  heights: number[][] // 상자로 메운 칸이 반영된 높이
  boxes: Point[]
  ladders: Point[] // 바닥에 놓인 사다리
  leaningLadders: LeaningLadder[]
  carrying: boolean
  player: Point
  moves: number
  cleared: boolean
}

export type GameEvent =
  | { type: 'moved'; from: Point; to: Point }
  | { type: 'fell'; from: Point; to: Point; drop: number } // drop은 층 수
  | { type: 'climbed'; from: Point; to: Point; via: 'box' | 'ladder' }
  | { type: 'pushed'; from: Point; to: Point; result: 'slid' | 'fell' | 'filled' }
  | { type: 'pickedUp'; at: Point }
  | { type: 'placed'; ladder: LeaningLadder }
  | { type: 'door'; id: string; open: boolean }
  | { type: 'blocked'; direction: Direction }
  | { type: 'cleared' }

export interface MoveResult {
  state: GameState
  events: GameEvent[]
}
