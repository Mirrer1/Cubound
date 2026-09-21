export type Direction = 'up' | 'right' | 'down' | 'left'

export interface Point {
  x: number
  y: number
}

export type Entity = (
  | { type: 'box' }
  | { type: 'switch'; target: string }
  | { type: 'door'; id: string }
  | { type: 'lift'; id: string }
  | { type: 'warp'; id: string }
  | { type: 'ladder' }
  | { type: 'tram'; id: string; level: number; cells: Point[]; dir: 1 | -1 } // x, y는 cells 안의 시작 자리
) &
  Point

export interface StageRules {
  moveLimit?: number // 보스 이동 제한, 없으면 제한 없음
  pushLimit?: number // 보스 밀기 제한, 없으면 제한 없음
  climbLimit?: number // 보스 올라가기 제한, 없으면 제한 없음
  rideLimit?: number // 보스 타는 횟수 제한, 없으면 제한 없음
}

export interface Stage {
  version: 1
  id: string
  name?: string // 유저가 만든 맵의 이름. 공식 스테이지 이름은 사전에 둔다
  heights: number[][] // 행(y) 먼저, -1은 바닥 없음
  ice?: string[] // heights와 같은 모양에서 '#'이 얼음
  cracks?: string[] // heights와 같은 모양에서 1~9가 무너지기까지 견디는 횟수
  start: Point
  goal: Point
  entities: Entity[]
  best?: number // 풀이 검사기가 구한 최소 이동 수
  rules?: StageRules // 보스 제약
  guides?: Guide[] // 스텝 가이드 단계
  zones?: Zone[] // 카메라 구역, 없으면 맵 전체
}

// 칸 좌표나 화면 요소 이름
export type GuideTarget = Point | 'restart' | 'moves' | 'pushes' | 'climbs' | 'rides'

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

// 무너지는 칸이 앞으로 견디는 횟수. -1은 이미 무너진 칸
export type Crack = Point & { left: number }

export interface TramSpot {
  id: string
  at: number // cells 안의 자리
  dir: 1 | -1
}

export interface GameState {
  stage: Stage
  heights: number[][] // 상자로 메운 칸이 반영된 높이
  boxes: Point[]
  cracks: Crack[]
  trams: TramSpot[]
  ladders: Point[] // 바닥에 놓인 사다리
  leaningLadders: LeaningLadder[]
  carrying: boolean
  player: Point
  moves: number
  pushes: number // 상자를 민 이동의 수
  climbs: number // 한 층 올라선 이동의 수
  rides: number // 발판에 올라탄 횟수
  cleared: boolean
}

export type GameEvent =
  | { type: 'moved'; from: Point; to: Point }
  | { type: 'fell'; from: Point; to: Point; drop: number } // drop은 층 수
  | { type: 'climbed'; from: Point; to: Point; via: 'box' | 'ladder' }
  | { type: 'slid'; subject: 'player' | 'box'; from: Point; to: Point } // 얼음 위 미끄러짐이라 from과 to가 이웃하지 않을 수 있다
  | { type: 'pushed'; from: Point; to: Point; result: 'slid' | 'fell' | 'filled' }
  | { type: 'cracked'; at: Point; left: number; gone: boolean } // gone은 바닥 없는 칸이 되었는지
  | { type: 'pickedUp'; at: Point }
  | { type: 'placed'; ladder: LeaningLadder }
  | { type: 'door'; id: string; open: boolean }
  | { type: 'lift'; id: string; up: boolean }
  | { type: 'warped'; from: Point; to: Point }
  | { type: 'tram'; id: string; from: Point; to: Point }
  | { type: 'blocked'; direction: Direction }
  | { type: 'cleared' }

export interface MoveResult {
  state: GameState
  events: GameEvent[]
}
