import { describe, expect, it } from 'vitest'

import { BOX_SINK } from '../view'
import { type BoxFrame, boxFramesOf, movingBox } from './boxFrame'
import { standSink } from './crackFrame'
import { mushroomFrames } from './mushroomFrame'
import { switchProgress } from './switchFrame'
import {
  HOP_STAGE,
  ICE_STAGE,
  LIFT_STAGE,
  SEED_AT,
  SEED_STAGE,
  STAGE,
  TRAM_CELLS,
  TRAM_STAGE,
  lastMove,
} from './testStages'
import { tramProgress } from './tramFrame'
import { TILE, toScreen } from '@/game/iso'
import { createState, move } from '@/game/rules'
import type { GameState, Stage } from '@/game/types'

describe('movingBox', () => {
  it('밀린 상자는 두 칸 사이를 미끄러진다', () => {
    const stage: Stage = { ...STAGE, heights: [[0, 0, 0]], entities: [{ type: 'box', x: 1, y: 0 }] }
    const prev = createState(stage)
    const { state, events } = move(prev, 'right')

    expect(movingBox(prev, state, events, 0.5)).toMatchObject({
      x: 1.5,
      level: 0,
      to: { x: 2, y: 0 },
    })
    expect(movingBox(prev, state, events, 1)).toBeNull()
  })

  it('올라간 발판으로 밀린 상자는 발판을 따라 내려앉는다', () => {
    const stage: Stage = {
      ...LIFT_STAGE,
      heights: [
        [0, 0, 0],
        [1, 1, 0],
      ],
      start: { x: 0, y: 1 },
      entities: [
        { type: 'switch', x: 0, y: 1, target: 'a' },
        { type: 'lift', x: 2, y: 1, id: 'a' },
        { type: 'box', x: 1, y: 1 },
      ],
    }
    const prev = createState(stage)
    const { state, events } = move(prev, 'right')

    expect(state.boxes).toEqual([{ x: 2, y: 1 }])
    expect(movingBox(prev, state, events, 0)?.level).toBe(1)
    // 상자가 자리에 앉기 직전의 높이, 내려가는 발판과 같은 높이
    const lift = 1 - switchProgress(events, [{ x: 0, y: 1 }], false, 0.8)
    expect(movingBox(prev, state, events, 0.8)?.level).toBeCloseTo(lift, 1)
  })

  it('물이 높은 동안 잠긴 칸에 띄워 같은 수에 끌려가는 상자는 땅 위에서 출발 높이 그대로', () => {
    // (0,0) 장치 위 상자로 물이 높은 판, (1,1) 상자를 잠긴 (1,2)에 띄우면 (3,2) 소용돌이로 한 칸 끌림
    const stage: Stage = {
      ...STAGE,
      heights: [
        [2, 2, 2, 2],
        [2, 2, 2, 2],
        [2, 1, 1, 0],
      ],
      water: 1,
      start: { x: 1, y: 0 },
      entities: [
        { type: 'sluice', x: 0, y: 0 },
        { type: 'box', x: 0, y: 0 },
        { type: 'box', x: 1, y: 1 },
        { type: 'whirlpool', x: 3, y: 2 },
      ],
    }
    const prev = createState(stage)
    const { state, events } = move(prev, 'down')

    expect(events).toContainEqual({ type: 'pulled', from: { x: 1, y: 2 }, to: { x: 2, y: 2 } })
    expect(movingBox(prev, state, events, 0.1)?.level).toBe(2)
  })
})

describe('movingBox 미끄러짐', () => {
  it('밀린 상자가 얼음 위를 이어서 미끄러진다', () => {
    const stage: Stage = {
      ...ICE_STAGE,
      heights: [[0, 0, 0, 0, 0, 0, 0]],
      ice: ['..###..'],
      goal: { x: 6, y: 0 },
      entities: [{ type: 'box', x: 1, y: 0 }],
    }
    const prev = createState(stage)
    const { state, events } = move(prev, 'right')

    expect(movingBox(prev, state, events, 0.2)?.x).toBeLessThanOrEqual(2)
    expect(movingBox(prev, state, events, 0.7)?.x).toBeGreaterThan(3)
    expect(movingBox(prev, state, events, 0.7)?.to).toEqual({ x: 5, y: 0 })
  })

  it('여러 칸 미끄러지는 상자는 도착 칸이 아니라 지금 걸친 두 칸 중 앞 칸 순서로 그린다', () => {
    const stage: Stage = {
      ...ICE_STAGE,
      heights: [[0, 0, 0, 0, 0, 0, 0]],
      ice: ['..###..'],
      goal: { x: 6, y: 0 },
      entities: [{ type: 'box', x: 1, y: 0 }],
    }
    const prev = createState(stage)
    const { state, events } = move(prev, 'right')
    const early = [0.3, 0.4, 0.5].map((t) => movingBox(prev, state, events, t))

    for (const frame of early) {
      expect(frame?.cell.x).toBeLessThan(5)
      expect(frame?.cell.x).toBe(Math.ceil(frame?.x ?? 0))
    }
  })
})

// 상자를 발판 위로 밀어 넣는 판
const PUSH_TRAM_STAGE: Stage = {
  ...TRAM_STAGE,
  start: { x: 5, y: 1 },
  entities: [
    { type: 'tram', x: 3, y: 1, id: 'tram-a', level: 0, cells: TRAM_CELLS, dir: 1 },
    { type: 'box', x: 4, y: 1 },
  ],
}

// 발판에 실린 상자를 구덩이로 밀어 넣는 판
const DROP_TRAM_STAGE: Stage = {
  ...TRAM_STAGE,
  heights: [
    [0, 0, 0, 0, 0, 0],
    [0, -1, -1, -1, 0, 0],
    [0, 0, -1, 0, 0, 0],
  ],
  start: { x: 2, y: 0 },
  entities: [
    { type: 'tram', x: 2, y: 1, id: 'tram-a', level: 0, cells: TRAM_CELLS, dir: 1 },
    { type: 'box', x: 2, y: 1 },
  ],
}

describe('movingBox 발판에 실려 가기', () => {
  it('밀려서 올라탄 상자는 발판이 멈출 때까지 이어서 간다', () => {
    const prev = createState(PUSH_TRAM_STAGE)
    const { state, events } = move(prev, 'left')
    let last = 4

    expect(state.boxes).toEqual([{ x: 2, y: 1 }])
    for (let t = 0; t < 1; t += 0.02) {
      const frame = movingBox(prev, state, events, t)
      expect(frame).not.toBeNull()
      expect(frame?.x ?? 0).toBeLessThanOrEqual(last)
      expect(frame).toMatchObject({ level: 0, to: { x: 2, y: 1 } })
      last = frame?.x ?? 0
    }

    expect(movingBox(prev, state, events, 0.999)?.x).toBeCloseTo(2, 1)
    expect(movingBox(prev, state, events, 1)).toBeNull()
  })

  it('발판이 가는 동안에는 상자가 밀린 칸을 지나 발판을 따라간다', () => {
    const prev = createState(PUSH_TRAM_STAGE)
    const { state, events } = move(prev, 'left')

    for (let t = 0; t < 1; t += 0.02) {
      const p = tramProgress(events, t)
      if (p > 0) expect(movingBox(prev, state, events, t)?.x).toBeCloseTo(3 - p)
    }
  })
})

describe('movingBox 발판에서 구덩이로', () => {
  const drop = () => {
    const prev = createState(DROP_TRAM_STAGE)
    return { prev, ...move(prev, 'down') }
  }

  it('발판 위의 상자는 발판 높이에서 출발한다', () => {
    const { prev, state, events } = drop()

    expect(state.heights[2][2]).toBe(0)
    expect(movingBox(prev, state, events, 0)).toMatchObject({ x: 2, y: 1, level: 0 })
  })

  it('메우는 상자는 한 층만 내려가고 바닥 아래로 꺼지지 않는다', () => {
    const { prev, state, events } = drop()
    let last = 0

    for (let t = 0; t <= 1; t += 0.02) {
      const frame = movingBox(prev, state, events, t)
      if (!frame) continue
      expect(frame.level).toBeLessThanOrEqual(last + 1e-9)
      expect(frame.level).toBeGreaterThanOrEqual(-1)
      last = frame.level
    }
  })
})

// 상자를 (2,0) 버섯 쪽으로 밀면 (4,0)까지 날아가는 판
const BOX_HOP_STAGE: Stage = {
  ...HOP_STAGE,
  heights: [[0, 0, 0, 0, 0, 0, 0]],
  mushroom: ['..#....'],
  entities: [{ type: 'box', x: 1, y: 0 }],
}

describe('movingBox 버섯', () => {
  it('상자도 같은 포물선으로 두 칸을 날아간다', () => {
    const prev = createState(BOX_HOP_STAGE)
    const { state, events } = move(prev, 'right')
    const lifts = Array.from({ length: 101 }, (_, i) => movingBox(prev, state, events, i / 100))
      .filter((f) => f !== null)
      .map((f) => f.lift)

    expect(state.boxes).toEqual([{ x: 4, y: 0 }])
    expect(state.pushes).toBe(1)
    expect(lifts[0]).toBe(0)
    expect(Math.max(...lifts)).toBeGreaterThan(TILE.layer)
  })

  it('높은 버섯에서 낮은 버섯으로 이어 튀는 상자는 두 번째 갓을 딛고 지나간다', () => {
    // (2,0) 한 층 버섯에서 (4,0) 바닥 버섯을 거쳐 (6,0)에 내리는 판
    const stage: Stage = {
      ...BOX_HOP_STAGE,
      heights: [[1, 1, 1, 1, 0, 0, 0, 0]],
      goal: { x: 7, y: 0 },
      mushroom: ['..#.#...'],
    }
    const prev = createState(stage)
    const { state, events } = move(prev, 'right')
    const onSecond = Array.from({ length: 201 }, (_, i) => movingBox(prev, state, events, i / 200))
      .filter((f) => f !== null && Math.abs(f.x - 4) < 0.01)
      .map((f) => f!.level)

    expect(state.boxes).toEqual([{ x: 6, y: 0 }])
    expect(onSecond.length).toBeGreaterThan(0)
    for (const level of onSecond) expect(level).toBeCloseTo(0)
  })

  it('두 층 벽 너머 구덩이를 메우는 상자는 땅에 내리는 상자와 같은 높이로 넘는다', () => {
    const peak = (landing: number) => {
      const prev = createState({ ...BOX_HOP_STAGE, heights: [[0, 0, 0, 2, landing, 0, 0]] })
      const { state, events } = move(prev, 'right')
      return Math.max(
        ...Array.from(
          { length: 201 },
          (_, i) => movingBox(prev, state, events, i / 200)?.lift ?? 0,
        ),
      )
    }

    expect(peak(-1)).toBeCloseTo(peak(0))
  })

  it('상자가 지나간 버섯도 눌린다', () => {
    const prev = createState(BOX_HOP_STAGE)
    const { state, events } = move(prev, 'right')
    const presses = Array.from({ length: 101 }, (_, i) =>
      mushroomFrames(prev, state, events, i / 100).find((f) => f.cell.x === 2),
    ).map((f) => f?.press ?? 0)

    expect(Math.max(...presses)).toBeGreaterThan(0.8)
    expect(Math.min(...presses)).toBeLessThan(-0.8)
  })
})

describe('movingBox 씨앗', () => {
  it('솟는 칸으로 밀린 상자는 미는 동안 오르지 않는다', () => {
    const stage: Stage = { ...SEED_STAGE, entities: [{ type: 'box', x: 1, y: 1 }] }
    const from: GameState = { ...createState(stage), planted: [{ ...SEED_AT, left: 1, rises: 0 }] }
    const { prev, game, events } = lastMove(stage, ['right'], from)

    expect(game.boxes).toEqual([SEED_AT])
    expect(movingBox(prev, game, events, 0.3)?.level).toBe(0)
  })
})

describe('boxFramesOf', () => {
  const NO_CRACK = { game: { cracks: [] }, before: { cracks: [] }, crackPhase: 1 }
  const BOX: BoxFrame = {
    x: 1.5,
    y: 0,
    level: 1,
    to: { x: 2, y: 0 },
    cell: { x: 2, y: 0 },
    lift: 5,
  }
  const view = (over: Partial<Parameters<typeof boxFramesOf>[0]>) =>
    boxFramesOf({
      box: null,
      sinkingBox: null,
      tramFrames: [],
      boxes: [],
      crackView: NO_CRACK,
      iceDrop: 0,
      ...over,
    })
  const pushed = toScreen({ x: 1.5, y: 0 }, 1)

  it('움직이는 상자가 없고 발판 위 상자도 없으면 비어 있다', () => {
    expect(view({})).toEqual([])
  })

  it('밀리는 상자는 그 순간 화면 자리에서 떠오른 만큼 올려 그린다', () => {
    expect(view({ box: BOX })).toEqual([
      { x: pushed.x, y: pushed.y - TILE.layer - 5, to: BOX.to, cell: BOX.cell },
    ])
  })

  it('늪에 가라앉는 상자는 잠긴 정도만큼 내려간다', () => {
    const sinkingBox = { at: { x: 2, y: 0 }, deep: 0.5, filled: 0 }

    expect(view({ box: BOX, sinkingBox })[0].y).toBe(pushed.y - TILE.layer - 5 + BOX_SINK * 0.5)
  })

  it('무너지는 칸 위를 지나는 상자는 내려앉은 만큼 내려간다', () => {
    const crackView = {
      game: { cracks: [{ x: 2, y: 0, left: 1 }] },
      before: { cracks: [{ x: 2, y: 0, left: 1 }] },
      crackPhase: 1,
    }

    expect(view({ box: BOX, crackView })[0].y).toBeCloseTo(
      pushed.y - TILE.layer - 5 + standSink(crackView, 1.5, 0),
    )
  })

  it('발판 위의 상자는 발판 판 위에 얹어 그린다', () => {
    const tram = { x: 40, y: 50, to: { x: 3, y: 0 }, cell: { x: 3, y: 0 } }

    expect(view({ tramFrames: [tram], boxes: [{ x: 3, y: 0 }] })).toEqual([
      { x: 40, y: 50 - TILE.layer, to: tram.to, cell: tram.cell },
    ])
  })

  it('발판으로 밀려 가는 상자는 발판 위 상자로 두 번 그리지 않는다', () => {
    const tram = { x: 40, y: 50, to: { x: 2, y: 0 }, cell: { x: 2, y: 0 } }

    expect(view({ box: BOX, tramFrames: [tram], boxes: [{ x: 2, y: 0 }] })).toHaveLength(1)
  })

  it('상자가 없는 발판은 그리지 않는다', () => {
    const tram = { x: 40, y: 50, to: { x: 3, y: 0 }, cell: { x: 3, y: 0 } }

    expect(view({ tramFrames: [tram] })).toEqual([])
  })
})
