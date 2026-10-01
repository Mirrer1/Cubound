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
  | { type: 'seed' }
  | { type: 'tram'; id: string; level: number; cells: Point[]; dir: 1 | -1 } // x, y는 cells 안의 시작 자리
  | { type: 'vine'; id: string; cells: Point[] } // x, y는 뿌리 칸이고 cells는 자랄 순서
) &
  Point

export type Limit = 'moves' | 'pushes' | 'climbs' | 'rides' | 'dir'

export interface StageRules {
  moveLimit?: number // 보스 이동 제한, 없으면 제한 없음
  pushLimit?: number // 보스 밀기 제한, 없으면 제한 없음
  climbLimit?: number // 보스 올라가기 제한, 없으면 제한 없음
  rideLimit?: number // 보스 타는 횟수 제한, 없으면 제한 없음
  dirLimit?: { dir: Direction; count: number } // 보스 방향 제한, 없으면 제한 없음
  swampDeepen?: boolean // 늪에 빠질수록 버둥이 한 수씩 는다
  mushroomWither?: boolean // 밟힌 버섯이 시들고 맵의 버섯을 다 밟아야 클리어된다
  vineStop?: boolean // 큐브가 밟은 덩굴이 그 길이로 굳는다
  seedGrow?: boolean // 솟은 씨앗 칸이 4수마다 한 층씩 세 층까지 솟는다
  wind?: Direction // 4수마다 큐브가 밀려 가는 방향
}

export interface Stage {
  version: 1
  id: string
  name?: string // 유저가 만든 맵의 이름. 공식 스테이지 이름은 사전에 둔다
  heights: number[][] // 행(y) 먼저, -1은 바닥 없음
  ice?: string[] // heights와 같은 모양에서 '#'이 얼음
  swamp?: string[] // heights와 같은 모양에서 '#'이 늪
  mushroom?: string[] // heights와 같은 모양에서 '#'이 버섯
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
export type GuideTarget =
  Point | 'restart' | 'moves' | 'pushes' | 'climbs' | 'rides' | 'dir' | 'wind'

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

export interface VineSpot {
  id: string
  grown: number // 자라서 메운 칸 수
  stopped: boolean
}

export type Carried = 'ladder' | 'seed'

// 솟는 칸과 함께 올라간 것
export type Lifted = 'player' | 'box'

export interface PlantedSeed extends Point {
  left: number // 다음에 솟기까지 남은 수
  rises: number // 이미 솟은 층 수
}

export interface GameState {
  stage: Stage
  heights: number[][] // 상자와 덩굴로 메운 칸과 씨앗으로 솟은 칸이 반영된 높이
  boxes: Point[]
  cracks: Crack[]
  trams: TramSpot[]
  swamps: Point[] // 남아 있는 늪 칸. 상자가 가라앉은 칸은 빠진다
  mushrooms: Point[] // 남아 있는 버섯 칸. 시드는 판에서 밟힌 칸은 빠진다
  vines: VineSpot[]
  struggles: number // 지금 선 늪 칸에서 버둥거린 수
  sinks: number // 늪에 빠진 횟수
  ladders: Point[] // 바닥에 놓인 사다리
  leaningLadders: LeaningLadder[]
  seeds: Point[] // 바닥에 놓인 씨앗
  planted: PlantedSeed[] // 아직 솟을 차례가 남은 심은 칸
  carrying: Carried | null
  player: Point
  moves: number
  pushes: number // 상자를 민 이동의 수
  climbs: number // 한 층 올라선 이동의 수
  rides: number // 발판에 올라탄 횟수
  dirUses: number // 제한된 방향으로 센 이동의 수
  cleared: boolean
}

export type GameEvent =
  | { type: 'moved'; from: Point; to: Point }
  | { type: 'fell'; from: Point; to: Point; drop: number } // drop은 층 수
  | { type: 'climbed'; from: Point; to: Point; via: 'box' | 'ladder' }
  | { type: 'slid'; subject: 'player' | 'box'; from: Point; to: Point } // 얼음 위 미끄러짐이라 from과 to가 이웃하지 않을 수 있다
  | { type: 'pushed'; from: Point; to: Point; result: 'slid' | 'fell' | 'filled' }
  | { type: 'cracked'; at: Point; left: number; gone: boolean } // gone은 바닥 없는 칸이 되었는지
  | { type: 'struggled'; at: Point } // 늪에서 제자리에 선 수
  | { type: 'sank'; at: Point } // 늪에 밀려 들어간 상자가 가라앉음
  | { type: 'pickedUp'; at: Point; item: Carried }
  | { type: 'placed'; ladder: LeaningLadder }
  | { type: 'door'; id: string; open: boolean }
  | { type: 'lift'; id: string; up: boolean }
  | { type: 'warped'; from: Point; to: Point }
  | { type: 'tram'; id: string; from: Point; to: Point }
  | { type: 'grew'; id: string; at: Point } // 덩굴이 한 칸 뻗어 메움
  | { type: 'planted'; at: Point; direction: Direction } // direction은 턱 쪽으로 민 방향
  | { type: 'seedTicked'; at: Point; left: number } // 심은 칸이 솟기까지 남은 수가 줄어듦
  | { type: 'rose'; at: Point; height: number; lifted: Lifted[]; growing: boolean } // height는 솟은 뒤 바닥 높이이고 growing은 또 솟을 차례가 남았는지
  | { type: 'blown'; from: Point; to: Point; direction: Direction } // 바람에 밀려 to 쪽으로 감. 그 이동의 이벤트가 뒤에 이어진다
  | { type: 'braced'; direction: Direction; sheltered?: true } // 바람에 버팀. sheltered는 바람 오는 쪽이 막혀 숨은 것
  | { type: 'blocked'; direction: Direction }
  | { type: 'limit'; limit: Limit } // 보스 제약에 막힘
  | { type: 'cleared' }

export interface MoveResult {
  state: GameState
  events: GameEvent[]
}
