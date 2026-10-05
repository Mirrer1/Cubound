import { createState, move } from '@/game/rules'
import type { Direction, Point, Stage } from '@/game/types'

export const STAGE: Stage = {
  version: 1,
  id: 'test-frame',
  name: '프레임',
  heights: [[1, 1, 0, -1, 0]],
  start: { x: 0, y: 0 },
  goal: { x: 4, y: 0 },
  entities: [],
}

export const ICE_STAGE: Stage = {
  version: 1,
  id: 'test-ice',
  name: '얼음',
  heights: [[0, 0, 0, 0, 0]],
  ice: ['.###.'],
  start: { x: 0, y: 0 },
  goal: { x: 4, y: 0 },
  entities: [],
}

// 큐브가 한 층 높은 스위치에서 올라간 발판으로 옮겨 서면 발판과 함께 내려앉는 판
export const LIFT_STAGE: Stage = {
  version: 1,
  id: 'test-lift',
  name: '발판',
  heights: [
    [0, 1, 0],
    [0, 1, 0],
  ],
  start: { x: 1, y: 0 },
  goal: { x: 0, y: 0 },
  entities: [
    { type: 'switch', x: 1, y: 1, target: 'a' },
    { type: 'lift', x: 2, y: 1, id: 'a' },
  ],
}

// 밀린 상자가 얼음을 건너 스위치에 닿으면 큐브가 선 발판이 올라가는 판
export const SLIDE_SWITCH_STAGE: Stage = {
  version: 1,
  id: 'test-slide-switch',
  name: '미끄러지는 스위치',
  heights: [
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
  ],
  ice: ['..##.', '.....'],
  start: { x: 0, y: 0 },
  goal: { x: 4, y: 1 },
  entities: [
    { type: 'box', x: 1, y: 0 },
    { type: 'lift', x: 1, y: 0, id: 'a' },
    { type: 'switch', x: 4, y: 0, target: 'a' },
  ],
}

// 한 칸 걸어 들어간 짝 칸에서 저쪽 짝 칸으로 옮겨 서는 판
export const WARP_STAGE: Stage = {
  version: 1,
  id: 'test-warp',
  name: '짝 칸',
  heights: [[0, 0, 0, 0, 0]],
  start: { x: 0, y: 0 },
  goal: { x: 4, y: 0 },
  entities: [
    { type: 'warp', x: 1, y: 0, id: 'a' },
    { type: 'warp', x: 3, y: 0, id: 'a' },
  ],
}

export const TRAM_CELLS: Point[] = [
  { x: 1, y: 1 },
  { x: 2, y: 1 },
  { x: 3, y: 1 },
]

export const TRAM_STAGE: Stage = {
  version: 1,
  id: 'test-tram',
  name: '움직이는 발판',
  heights: [
    [0, 0, 0, 0, 0, 0],
    [0, -1, -1, -1, 0, 0],
    [0, 0, 0, 0, 0, 0],
  ],
  start: { x: 0, y: 1 },
  goal: { x: 5, y: 2 },
  entities: [{ type: 'tram', x: 1, y: 1, id: 'tram-a', level: 0, cells: TRAM_CELLS, dir: 1 }],
}

export const board = () => {
  const prev = createState(TRAM_STAGE)
  return { prev, ...move(prev, 'right') }
}

export const ride = () => {
  const prev = move(createState(TRAM_STAGE), 'right').state
  return { prev, ...move(prev, 'right') }
}

export const SWAMP_STAGE: Stage = {
  version: 1,
  id: 'test-swamp',
  name: '늪',
  heights: [[0, 0, 0, 0, 0]],
  swamp: ['..#..'],
  start: { x: 1, y: 0 },
  goal: { x: 4, y: 0 },
  entities: [],
}

// 늪 옆에 선 큐브가 상자를 늪으로 밀어 넣는 판
export const SINK_STAGE: Stage = {
  ...SWAMP_STAGE,
  start: { x: 0, y: 0 },
  entities: [{ type: 'box', x: 1, y: 0 }],
}

export const enterSwamp = () => {
  const prev = createState(SWAMP_STAGE)
  return { prev, ...move(prev, 'right') }
}

export const struggleSwamp = () => {
  const prev = enterSwamp().state
  return { prev, ...move(prev, 'right') }
}

export const leaveSwamp = () => {
  const prev = move(struggleSwamp().state, 'right').state
  return { prev, ...move(prev, 'right') }
}

export const sinkBox = () => {
  const prev = createState(SINK_STAGE)
  return { prev, ...move(prev, 'right') }
}

// (1,0) 버섯을 밟으면 한 층 벽인 (2,0)을 넘어 (3,0)에 내리는 판
export const HOP_STAGE: Stage = {
  version: 1,
  id: 'test-frame-mushroom',
  name: '버섯',
  heights: [[0, 0, 1, 0, 0, 0, 0]],
  start: { x: 0, y: 0 },
  goal: { x: 6, y: 0 },
  entities: [],
  mushroom: ['.#.....'],
}

// (1,0)과 (3,0)이 이어져 한 수에 다섯 칸을 가는 판
export const CHAIN_STAGE: Stage = {
  ...HOP_STAGE,
  heights: [[0, 0, 0, 0, 0, 0, 0]],
  mushroom: ['.#.#...'],
}

// 착지 칸이 두 층 높아 뛰지 못하고 버섯에 올라서는 판
export const STAND_STAGE: Stage = {
  ...HOP_STAGE,
  heights: [
    [0, 0, 0, 2, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0],
  ],
  mushroom: ['.#.....', '.......', '.......'],
}

// 밟힌 버섯이 시드는 보스 판
export const DRY_STAGE: Stage = { ...CHAIN_STAGE, rules: { mushroomWither: true } }

export const hop = (stage: Stage) => {
  const prev = createState(stage)
  const { state, events } = move(prev, 'right')
  return { prev, state, events }
}

// 오른쪽 (3, 1)과 (3, 2)가 한 층 높아 (2, 1)에 심는 판
export const SEED_STAGE: Stage = {
  version: 1,
  id: 'test-seed-frame',
  heights: [
    [0, 0, 0, 0, 0, 0],
    [0, 0, 0, 1, 0, 0],
    [0, 0, 0, 1, 0, 0],
  ],
  start: { x: 0, y: 1 },
  goal: { x: 5, y: 0 },
  entities: [{ type: 'seed', x: 1, y: 1 }],
}

export const SEED_AT = { x: 2, y: 1 }

// 씨앗을 주워 (2, 1)에 심는 수순
export const PLANT: Direction[] = ['right', 'right', 'right']

// 심은 뒤 옆 칸을 오가 네 번째 수에 큐브가 심은 칸으로 들어서며 솟는 수순
export const RIDE: Direction[] = [...PLANT, 'left', 'right', 'left', 'right']

// 마지막 수의 앞 상태와 결과
export const lastMove = (stage: Stage, directions: Direction[], from = createState(stage)) => {
  const prev = directions.slice(0, -1).reduce((state, d) => move(state, d).state, from)
  const { state, events } = move(prev, directions[directions.length - 1])
  return { prev, game: state, events }
}

export const WIND_STAGE: Stage = {
  version: 1,
  id: 'test-wind',
  name: '바람',
  heights: [
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
  ],
  start: { x: 3, y: 1 },
  goal: { x: 4, y: 0 },
  entities: [],
  rules: { wind: 'left' },
}

// 이동 세 번을 쓴 상태, 다음 센 수에 부는 바람
export const gust = (stage: Partial<Stage> = {}, direction: Direction = 'up') => {
  const prev = { ...createState({ ...WIND_STAGE, ...stage }), moves: 3 }
  const { state: game, events } = move(prev, direction)
  return { prev, game, events }
}

// 물 높이 1, (1,1) 소용돌이가 오른쪽 물길 (2~5,1)을 끄는 판, 줄 위의 배 둘과 (5,2) 땅 상자
export const WHIRL_STAGE: Stage = {
  version: 1,
  id: 'test-whirl',
  name: '소용돌이',
  heights: [
    [1, 1, 1, 1, 1, 1, 1],
    [1, 0, 0, 0, 0, 0, 1],
    [1, 1, 1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1, 1, 1],
  ],
  water: 1,
  start: { x: 3, y: 0 },
  goal: { x: 6, y: 3 },
  entities: [
    { type: 'whirlpool', x: 1, y: 1 },
    { type: 'box', x: 3, y: 1 },
    { type: 'box', x: 4, y: 1 },
    { type: 'box', x: 5, y: 2 },
  ],
}

// 위에서 (1,1) 땅 상자를 밀어 (1,2) 소용돌이를 막는 판
export const PLUG_STAGE: Stage = {
  version: 1,
  id: 'test-plug',
  name: '마개',
  heights: [
    [1, 1, 1, 1],
    [1, 1, 1, 1],
    [1, 0, 0, 1],
    [1, 1, 1, 1],
  ],
  water: 1,
  start: { x: 1, y: 0 },
  goal: { x: 3, y: 3 },
  entities: [
    { type: 'whirlpool', x: 1, y: 2 },
    { type: 'box', x: 1, y: 1 },
  ],
  rules: { plug: true },
}

// 물 높이 1, x 2~4와 y 2~3이 물 칸, (2,1) 땅 위 얼음 돌을 아래로 밀면 뜨는 판
// (4,1)은 소용돌이 판에서 끌릴 자리, (0,1)은 땅 위로만 밀리는 돌
export const STONE_STAGE: Stage = {
  version: 1,
  id: 'test-stone',
  name: '얼음 돌',
  heights: [
    [1, 1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1, 1],
    [1, 1, 0, 0, 0, 1],
    [1, 1, 0, 0, 0, 1],
    [1, 1, 1, 1, 1, 1],
  ],
  water: 1,
  start: { x: 2, y: 0 },
  goal: { x: 5, y: 4 },
  entities: [{ type: 'iceStone', x: 2, y: 1 }],
}
