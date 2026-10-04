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
  | { type: 'vine'; id: string; cells: Point[] } // x, y는 뿌리 칸, cells는 자랄 순서
  | { type: 'post'; length: number; boat: Point } // x, y는 말뚝 칸, boat는 묶인 배의 처음 자리
  | { type: 'whirlpool' }
) &
  Point

export type Tram = Extract<Entity, { type: 'tram' }>

export type Limit = 'moves' | 'pushes' | 'climbs' | 'rides' | 'dir'

export interface StageRules {
  moveLimit?: number
  pushLimit?: number
  climbLimit?: number
  rideLimit?: number
  dirLimit?: { dir: Direction; count: number }
  swampDeepen?: boolean // 늪에 빠질 때마다 한 수씩 느는 버둥
  mushroomWither?: boolean // 밟힌 버섯이 시드는 판, 클리어 조건은 버섯 전부 밟기
  vineStop?: boolean // 큐브가 밟은 덩굴이 그 길이로 굳는 판
  seedGrow?: boolean // 솟은 씨앗 칸이 4수마다 한 층씩 세 층까지 솟는 판
  wind?: Direction // 4수마다 큐브가 밀려 가는 방향
  plug?: boolean // 땅 상자를 밀어 넣으면 소용돌이가 막히는 판
}

export interface Stage {
  version: 1
  id: string
  name?: string // 유저가 만든 맵의 이름, 공식 스테이지 이름은 사전
  heights: number[][] // 행 먼저, -1은 바닥 없는 칸
  ice?: string[] // heights와 같은 모양, '#'이 얼음 칸
  swamp?: string[] // heights와 같은 모양, '#'이 늪 칸
  mushroom?: string[] // heights와 같은 모양, '#'이 버섯 칸
  cracks?: string[] // heights와 같은 모양, 1~9는 무너지기까지 견디는 횟수
  water?: number // 물 높이, 이보다 낮은 바닥 칸이 물 칸
  start: Point
  goal: Point
  entities: Entity[]
  best?: number // 풀이 검사기가 구한 최소 이동 수
  rules?: StageRules
  guides?: Guide[]
  zones?: Zone[] // 카메라 구역, 없으면 맵 전체
}

// 칸 좌표나 화면 요소 이름
export type GuideTarget =
  Point | 'restart' | 'moves' | 'pushes' | 'climbs' | 'rides' | 'dir' | 'wind'

export interface Guide {
  id: string // 문구 사전의 키
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

// 무너지는 칸이 앞으로 견디는 횟수, -1은 이미 무너진 칸
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
  heights: number[][] // 상자와 덩굴로 메운 칸, 무너진 칸, 씨앗으로 솟은 칸이 반영된 높이
  boxes: Point[]
  tethered: Point[] // 말뚝 순서대로 묶인 배의 지금 자리
  plugged: Point[] // 상자로 막혀 보통 물 칸이 된 소용돌이
  cracks: Crack[]
  trams: TramSpot[]
  swamps: Point[] // 남아 있는 늪 칸, 상자가 가라앉은 칸은 제외
  mushrooms: Point[] // 남아 있는 버섯 칸, 시드는 판에서 밟힌 칸은 제외
  vines: VineSpot[]
  struggles: number // 지금 선 늪 칸에서 버둥거린 수
  sinks: number // 늪에 빠진 횟수
  ladders: Point[]
  leaningLadders: LeaningLadder[]
  seeds: Point[]
  planted: PlantedSeed[] // 아직 솟을 차례가 남은 심은 칸
  carrying: Carried | null
  player: Point
  moves: number
  pushes: number // 상자를 민 이동 수
  climbs: number // 한 층 올라선 이동 수
  rides: number // 발판에 올라탄 횟수
  dirUses: number // 제한된 방향으로 센 이동 수
  cleared: boolean
}

export type GameEvent =
  | { type: 'moved'; from: Point; to: Point }
  | { type: 'fell'; from: Point; to: Point; drop: number } // drop은 떨어진 층 수
  | { type: 'climbed'; from: Point; to: Point; via: 'box' | 'ladder' }
  | { type: 'slid'; subject: 'player' | 'box'; from: Point; to: Point } // 얼음 위 미끄러짐, 이웃하지 않을 수도 있는 from과 to
  | { type: 'pushed'; from: Point; to: Point; result: 'slid' | 'fell' | 'filled' | 'floated' } // floated는 땅에서 물에 떨어져 뜬 상자
  | { type: 'cracked'; at: Point; left: number; gone: boolean } // gone은 바닥 없는 칸이 되었는지 여부
  | { type: 'struggled'; at: Point } // 늪에서 제자리에 선 수
  | { type: 'sank'; at: Point } // 늪에 밀려 들어가 가라앉는 상자
  | { type: 'pickedUp'; at: Point; item: Carried }
  | { type: 'placed'; ladder: LeaningLadder }
  | { type: 'door'; id: string; open: boolean }
  | { type: 'lift'; id: string; up: boolean }
  | { type: 'warped'; from: Point; to: Point }
  | { type: 'rowed'; from: Point; to: Point } // 뜬 상자를 탄 채 함께 간 한 칸
  | { type: 'pulled'; from: Point; to: Point } // 소용돌이에 끌려 한 칸 간 빈 배
  | { type: 'plugged'; at: Point } // 밀어 넣은 땅 상자로 막힌 소용돌이
  | { type: 'tram'; id: string; from: Point; to: Point }
  | { type: 'grew'; id: string; at: Point } // 덩굴이 한 칸 뻗어 메운 칸
  | { type: 'planted'; at: Point; direction: Direction } // direction은 턱 쪽으로 민 방향
  | { type: 'seedTicked'; at: Point; left: number } // 심은 칸이 솟기까지 남은 수
  | { type: 'rose'; at: Point; height: number; lifted: Lifted[]; growing: boolean } // height는 솟은 뒤 바닥 높이, growing은 또 솟을 차례가 남았는지 여부
  | { type: 'blown'; from: Point; to: Point; direction: Direction } // 바람에 밀려 to 쪽으로 간 이동, 그 이동의 이벤트는 바로 뒤
  | { type: 'braced'; direction: Direction; sheltered?: true } // 바람을 버틴 수, sheltered는 바람 오는 쪽이 막혀 숨은 경우
  | { type: 'blocked'; direction: Direction }
  | { type: 'limit'; limit: Limit } // 보스 제약에 막힌 이동
  | { type: 'cleared' }

export interface MoveResult {
  state: GameState
  events: GameEvent[]
}
