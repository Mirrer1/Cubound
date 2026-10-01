import type { Direction, Entity, MoveResult, Point, Stage } from '../types'
import { move } from './moveRule'
import { createState } from './stateRule'

export const FLAT_STAGE: Stage = {
  version: 1,
  id: 'test',
  name: '테스트',
  heights: [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ],
  start: { x: 1, y: 1 },
  goal: { x: 2, y: 0 },
  entities: [],
}

export const BOX_STAGE: Stage = {
  version: 1,
  id: 'test-box',
  name: '상자 테스트',
  heights: [
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
  ],
  start: { x: 0, y: 1 },
  goal: { x: 4, y: 0 },
  entities: [{ type: 'box', x: 1, y: 1 }],
}

export const withMiddleRow = (row: number[]) => [BOX_STAGE.heights[0], row, BOX_STAGE.heights[2]]

export const LADDER_STAGE: Stage = {
  version: 1,
  id: 'test-ladder',
  name: '사다리 테스트',
  heights: [
    [0, 0, 0, 1, 1],
    [0, 0, 0, 1, 1],
    [0, 0, 0, 1, 1],
  ],
  start: { x: 0, y: 1 },
  goal: { x: 4, y: 0 },
  entities: [{ type: 'ladder', x: 1, y: 1 }],
}

export const play = (stage: Stage, directions: Direction[]) =>
  directions.reduce<MoveResult>((result, d) => move(result.state, d), {
    state: createState(stage),
    events: [],
  })

export const ICE_STAGE: Stage = {
  version: 1,
  id: 'test-ice',
  name: '얼음 테스트',
  heights: [
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
  ],
  start: { x: 0, y: 1 },
  goal: { x: 4, y: 0 },
  entities: [],
  ice: ['.....', '.###.', '.....'],
}

export const LIFT_STAGE: Stage = {
  version: 1,
  id: 'test-lift',
  name: '발판 테스트',
  heights: [
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
  ],
  start: { x: 0, y: 1 },
  goal: { x: 4, y: 0 },
  entities: [
    { type: 'switch', x: 2, y: 1, target: 'a' },
    { type: 'lift', x: 4, y: 1, id: 'a' },
  ],
}

export const WARP_STAGE: Stage = {
  version: 1,
  id: 'test-warp',
  name: '짝 칸 테스트',
  heights: [
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
  ],
  start: { x: 0, y: 1 },
  goal: { x: 4, y: 0 },
  entities: [
    { type: 'warp', x: 1, y: 1, id: 'a' },
    { type: 'warp', x: 4, y: 1, id: 'a' },
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
  name: '움직이는 발판 테스트',
  heights: [
    [0, 0, 0, 0, 0, 0],
    [0, -1, -1, -1, 0, 0],
    [0, 0, 0, 0, 0, 0],
  ],
  start: { x: 0, y: 1 },
  goal: { x: 5, y: 2 },
  entities: [{ type: 'tram', x: 1, y: 1, id: 'tram-a', level: 0, cells: TRAM_CELLS, dir: 1 }],
}

export const withTram = (
  tram: Partial<Extract<Entity, { type: 'tram' }>>,
  rest?: Partial<Stage>,
) => {
  const base = TRAM_STAGE.entities[0] as Extract<Entity, { type: 'tram' }>
  return { ...TRAM_STAGE, ...rest, entities: [{ ...base, ...tram }, ...(rest?.entities ?? [])] }
}

export const BOX_RIDE_STAGE: Stage = {
  version: 1,
  id: 'test-tram-box',
  name: '발판 상자 테스트',
  heights: [
    [0, 0, 0, 0, 0],
    [0, -1, -1, -1, 0],
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
  ],
  ice: ['.....', '.....', '.#...', '.....'],
  start: { x: 2, y: 3 },
  goal: { x: 4, y: 3 },
  entities: [
    {
      type: 'tram',
      x: 2,
      y: 1,
      id: 'tram-a',
      level: 0,
      cells: TRAM_CELLS,
      dir: 1,
    },
    { type: 'box', x: 2, y: 2 },
  ],
}

// 바람은 왼쪽으로 분다
export const WIND_STAGE: Stage = {
  version: 1,
  id: 'test-wind',
  name: '바람 테스트',
  heights: [
    [0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0],
  ],
  start: { x: 3, y: 0 },
  goal: { x: 5, y: 2 },
  entities: [],
  rules: { wind: 'left' },
}
