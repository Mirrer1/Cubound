import { describe, expect, it } from 'vitest'

import type { Direction, GameEvent, GameState, MoveResult, Point, Stage } from '../types'
import { move } from './moveRule'
import { createState, standHeight } from './stateRule'
import { WIND_STAGE, play } from './testStages'

// 이동 세 번을 쓴 상태라 다음 센 수에 분다
const gusty = (stage: Partial<Stage> = {}, state: Partial<GameState> = {}): GameState => ({
  ...createState({ ...WIND_STAGE, ...stage }),
  moves: 3,
  ...state,
})

const windy = (events: GameEvent[]) => events.some((e) => e.type === 'blown' || e.type === 'braced')

describe('move 바람', () => {
  it('센 수 네 번째에 큐브가 바람 쪽으로 한 칸 밀리고 이동 수는 늘지 않는다', () => {
    const three = play(WIND_STAGE, ['down', 'up', 'down'])
    const four = move(three.state, 'up')

    expect(three.state.player).toEqual({ x: 3, y: 1 })
    expect(windy(three.events)).toBe(false)
    expect(four.state.player).toEqual({ x: 2, y: 0 })
    expect(four.state.moves).toBe(4)
    expect(four.events).toEqual([
      { type: 'moved', from: { x: 3, y: 1 }, to: { x: 3, y: 0 } },
      { type: 'blown', from: { x: 3, y: 0 }, to: { x: 2, y: 0 }, direction: 'left' },
      { type: 'moved', from: { x: 3, y: 0 }, to: { x: 2, y: 0 } },
    ])
  })

  it('불고 나면 다시 네 수를 센 뒤에 분다', () => {
    const four = play(WIND_STAGE, ['down', 'up', 'down', 'up'])
    const seven = (['down', 'up', 'down'] as Direction[]).reduce<MoveResult>(
      (result, d) => move(result.state, d),
      { state: four.state, events: [] },
    )
    const eight = move(seven.state, 'up')

    expect(windy(seven.events)).toBe(false)
    expect(eight.state.player).toEqual({ x: 1, y: 0 })
    expect(eight.state.moves).toBe(8)
  })

  it('막힌 이동은 세지 않는다', () => {
    const blocked = play(WIND_STAGE, ['up', 'down', 'up', 'down'])
    const four = move(blocked.state, 'up')

    expect(blocked.state.moves).toBe(3)
    expect(windy(blocked.events)).toBe(false)
    expect(four.events).toContainEqual({
      type: 'blown',
      from: { x: 3, y: 0 },
      to: { x: 2, y: 0 },
      direction: 'left',
    })
  })

  it('늪의 버둥도 센 수라 버둥 수에 불고 늪에 선 채 버틴다', () => {
    const state = gusty(
      { swamp: ['......', '......', '...#..'] },
      { player: { x: 3, y: 2 }, sinks: 1 },
    )
    const { state: next, events } = move(state, 'up')

    expect(next.player).toEqual({ x: 3, y: 2 })
    expect(next.moves).toBe(4)
    expect(events).toEqual([
      { type: 'struggled', at: { x: 3, y: 2 } },
      { type: 'braced', direction: 'left' },
    ])
  })

  it('벽, 구덩이, 판 끝, 닫힌 문이면 기대서 버틴다', () => {
    const cases: { stage: Partial<Stage>; at: Point }[] = [
      {
        stage: {
          heights: [
            [0, 0, 1, 0, 0, 0],
            [0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0],
          ],
        },
        at: { x: 3, y: 0 },
      },
      {
        stage: {
          heights: [
            [0, 0, -1, 0, 0, 0],
            [0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0],
          ],
        },
        at: { x: 3, y: 0 },
      },
      { stage: {}, at: { x: 0, y: 0 } },
      {
        stage: {
          entities: [
            { type: 'door', id: 'a', x: 2, y: 0 },
            { type: 'switch', target: 'a', x: 5, y: 1 },
          ],
        },
        at: { x: 3, y: 0 },
      },
    ]

    for (const { stage, at } of cases) {
      const state = gusty(stage, { player: { x: at.x, y: at.y + 1 } })
      const { state: next, events } = move(state, 'up')

      expect(next.player).toEqual(at)
      expect(events.at(-1)).toEqual({ type: 'braced', direction: 'left' })
    }
  })

  it('두 층 이상 높은 칸에서도 버틴다', () => {
    const state = gusty(
      {
        heights: [
          [0, 0, 2, 0, 0, 0],
          [0, 0, 0, 0, 0, 0],
          [0, 0, 0, 0, 0, 0],
        ],
      },
      { player: { x: 3, y: 1 } },
    )
    const { state: next, events } = move(state, 'up')

    expect(next.player).toEqual({ x: 3, y: 0 })
    expect(events.at(-1)).toEqual({ type: 'braced', direction: 'left' })
  })

  it('같은 높이의 상자는 밀지 않고 올라서지도 않고 기대서 버틴다', () => {
    const state = gusty({ entities: [{ type: 'box', x: 2, y: 0 }] }, { player: { x: 3, y: 1 } })
    const { state: next, events } = move(state, 'up')

    expect(next.player).toEqual({ x: 3, y: 0 })
    expect(next.boxes).toEqual([{ x: 2, y: 0 }])
    expect(next.pushes).toBe(0)
    expect(next.climbs).toBe(0)
    expect(events.at(-1)).toEqual({ type: 'braced', direction: 'left' })
  })

  it('낮은 칸의 상자도 높이와 상관없이 기대서 버티고 그 위로 밀려 올라가지 않는다', () => {
    const state = gusty(
      {
        heights: [
          [0, 0, -1, 1, 0, 0],
          [0, 0, 0, 1, 0, 0],
          [0, 0, 0, 0, 0, 0],
        ],
        entities: [{ type: 'box', x: 2, y: 1 }],
      },
      { player: { x: 3, y: 0 } },
    )
    const { state: next, events } = move(state, 'down')

    expect(next.player).toEqual({ x: 3, y: 1 })
    expect(events.at(-1)).toEqual({ type: 'braced', direction: 'left' })
  })

  it('상자 위에 서 있으면 바람 쪽에 붙은 같은 높이 상자 위로 밀려 간다', () => {
    // (3,1) 상자 쪽으로 가면 뒤의 (2,1) 상자에 막혀 못 밀고 올라선다
    const state = gusty(
      {
        entities: [
          { type: 'box', x: 2, y: 1 },
          { type: 'box', x: 3, y: 1 },
        ],
      },
      { player: { x: 4, y: 1 } },
    )
    const { state: next, events } = move(state, 'left')

    expect(next.player).toEqual({ x: 2, y: 1 })
    expect(standHeight(next, next.player)).toBe(1)
    expect(next.boxes).toEqual([
      { x: 2, y: 1 },
      { x: 3, y: 1 },
    ])
    expect(next.moves).toBe(4)
    expect(events.some((e) => e.type === 'blown')).toBe(true)
  })

  it('늪에 서 있으면 버둥을 다 했어도 발이 묶여 버틴다', () => {
    const state = gusty({ swamp: ['......', '......', '..#...'] }, { player: { x: 3, y: 2 } })
    const { state: next, events } = move(state, 'left')

    expect(next.player).toEqual({ x: 2, y: 2 })
    expect(events).toEqual([
      { type: 'moved', from: { x: 3, y: 2 }, to: { x: 2, y: 2 } },
      { type: 'braced', direction: 'left' },
    ])
  })

  it('밀려 간 칸이 낮으면 떨어진다', () => {
    const state = gusty(
      {
        heights: [
          [0, 0, 0, 1, 0, 0],
          [0, 0, 0, 1, 0, 0],
          [0, 0, 0, 0, 0, 0],
        ],
      },
      { player: { x: 3, y: 1 } },
    )
    const { state: next, events } = move(state, 'up')

    expect(next.player).toEqual({ x: 2, y: 0 })
    expect(next.moves).toBe(4)
    expect(events.slice(1)).toEqual([
      { type: 'blown', from: { x: 3, y: 0 }, to: { x: 2, y: 0 }, direction: 'left' },
      { type: 'fell', from: { x: 3, y: 0 }, to: { x: 2, y: 0 }, drop: 1 },
    ])
  })

  it('밀려 간 칸이 버섯이면 튄다', () => {
    const state = gusty({ mushroom: ['..#...', '......', '......'] }, { player: { x: 3, y: 1 } })
    const { state: next, events } = move(state, 'up')

    expect(next.player).toEqual({ x: 0, y: 0 })
    expect(next.moves).toBe(4)
    expect(events.slice(1)).toEqual([
      { type: 'blown', from: { x: 3, y: 0 }, to: { x: 2, y: 0 }, direction: 'left' },
      { type: 'moved', from: { x: 3, y: 0 }, to: { x: 0, y: 0 } },
    ])
  })

  it('밀려 간 칸이 늪이면 빠져서 버둥을 처음부터 한다', () => {
    const state = gusty({ swamp: ['..#...', '......', '......'] }, { player: { x: 3, y: 1 } })
    const { state: next } = move(state, 'up')

    expect(next.player).toEqual({ x: 2, y: 0 })
    expect(next.struggles).toBe(0)
    expect(next.sinks).toBe(1)
  })

  it('빈손으로 밀려 들어간 사다리와 씨앗 칸에서는 줍는다', () => {
    const ladder = move(
      gusty({ entities: [{ type: 'ladder', x: 2, y: 0 }] }, { player: { x: 3, y: 1 } }),
      'up',
    )
    const seed = move(
      gusty({ entities: [{ type: 'seed', x: 2, y: 0 }] }, { player: { x: 3, y: 1 } }),
      'up',
    )

    expect(ladder.state.carrying).toBe('ladder')
    expect(ladder.events.at(-1)).toEqual({ type: 'pickedUp', at: { x: 2, y: 0 }, item: 'ladder' })
    expect(seed.state.carrying).toBe('seed')
  })

  it('밀려 간 칸이 짝 칸이면 옮겨 간다', () => {
    const state = gusty(
      {
        entities: [
          { type: 'warp', id: 'a', x: 2, y: 0 },
          { type: 'warp', id: 'a', x: 0, y: 2 },
        ],
      },
      { player: { x: 3, y: 1 } },
    )
    const { state: next, events } = move(state, 'up')

    expect(next.player).toEqual({ x: 0, y: 2 })
    expect(events.at(-1)).toEqual({ type: 'warped', from: { x: 2, y: 0 }, to: { x: 0, y: 2 } })
  })

  it('밀려 간 칸이 구멍이면 끝난다', () => {
    const state = gusty({ goal: { x: 2, y: 0 } }, { player: { x: 3, y: 1 } })
    const { state: next, events } = move(state, 'up')

    expect(next.cleared).toBe(true)
    expect(events.at(-1)).toEqual({ type: 'cleared' })
  })

  it('이동으로 구멍에 들어간 수에는 불지 않는다', () => {
    const state = gusty({ goal: { x: 3, y: 0 } }, { player: { x: 3, y: 1 } })
    const { state: next, events } = move(state, 'up')

    expect(next.player).toEqual({ x: 3, y: 0 })
    expect(windy(events)).toBe(false)
  })

  it('씨앗을 들고 한 층 높은 칸 쪽으로 밀려도 심지 않고 버틴다', () => {
    const state = gusty(
      {
        heights: [
          [0, 0, 1, 0, 0, 0],
          [0, 0, 0, 0, 0, 0],
          [0, 0, 0, 0, 0, 0],
        ],
      },
      { player: { x: 3, y: 1 }, carrying: 'seed' },
    )
    const { state: next, events } = move(state, 'up')

    expect(next.carrying).toBe('seed')
    expect(next.planted).toEqual([])
    expect(events.at(-1)).toEqual({ type: 'braced', direction: 'left' })
  })

  it('사다리를 들고 밀려도 놓지 않고 기대 놓인 사다리로 오르지도 않는다', () => {
    const heights = [
      [0, 0, 1, 0, 0, 0],
      [0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0],
    ]
    const carrying = move(gusty({ heights }, { player: { x: 3, y: 1 }, carrying: 'ladder' }), 'up')
    const leaning = move(
      gusty(
        { heights },
        { player: { x: 3, y: 1 }, leaningLadders: [{ x: 3, y: 0, direction: 'left' }] },
      ),
      'up',
    )

    expect(carrying.state.carrying).toBe('ladder')
    expect(carrying.state.leaningLadders).toEqual([])
    expect(leaning.state.player).toEqual({ x: 3, y: 0 })
    expect(leaning.state.climbs).toBe(0)
  })

  it('같은 수에 솟는 씨앗보다 먼저 밀어 큐브는 안 실린다', () => {
    const state = gusty(
      {},
      { player: { x: 3, y: 1 }, planted: [{ x: 3, y: 0, left: 1, rises: 0 }] },
    )
    const { state: next, events } = move(state, 'up')

    expect(next.player).toEqual({ x: 2, y: 0 })
    expect(standHeight(next, next.player)).toBe(0)
    expect(events).toContainEqual({
      type: 'rose',
      at: { x: 3, y: 0 },
      height: 1,
      lifted: [],
      growing: false,
    })
  })

  it('기댈 자리에서 버티면 같은 수에 솟는 씨앗과 함께 오른다', () => {
    const state = gusty(
      {
        heights: [
          [0, 0, 1, 0, 0, 0],
          [0, 0, 0, 0, 0, 0],
          [0, 0, 0, 0, 0, 0],
        ],
      },
      { player: { x: 3, y: 1 }, planted: [{ x: 3, y: 0, left: 1, rises: 0 }] },
    )
    const { state: next, events } = move(state, 'up')

    expect(next.player).toEqual({ x: 3, y: 0 })
    expect(standHeight(next, next.player)).toBe(1)
    expect(events.map((e) => e.type)).toEqual(['moved', 'braced', 'rose'])
  })

  it('무너지는 칸은 바람이 옮긴 뒤의 자리를 본다', () => {
    // 사다리를 놓아 제자리에 선 수에 바람에 밀려 떠나면 그 칸이 닳는다
    const state = gusty(
      {
        heights: [
          [0, 0, 0, 1, 0, 0],
          [0, 0, 0, 0, 0, 0],
          [0, 0, 0, 0, 0, 0],
        ],
        cracks: ['......', '...2..', '......'],
      },
      { player: { x: 3, y: 1 }, carrying: 'ladder' },
    )
    const { state: next, events } = move(state, 'up')

    expect(next.player).toEqual({ x: 2, y: 1 })
    expect(events).toContainEqual({ type: 'cracked', at: { x: 3, y: 1 }, left: 1, gone: false })
  })

  it('이동으로 밟은 무너지는 칸을 같은 수에 바람에 밀려 떠나면 한 번 닳는다', () => {
    const worn = move(
      gusty({ cracks: ['...2..', '......', '......'] }, { player: { x: 3, y: 1 } }),
      'up',
    )
    const gone = move(
      gusty({ cracks: ['...1..', '......', '......'] }, { player: { x: 3, y: 1 } }),
      'up',
    )

    expect(worn.state.player).toEqual({ x: 2, y: 0 })
    expect(worn.state.cracks).toEqual([{ x: 3, y: 0, left: 1 }])
    expect(worn.events).toContainEqual({
      type: 'cracked',
      at: { x: 3, y: 0 },
      left: 1,
      gone: false,
    })
    expect(gone.state.heights[0][3]).toBe(-1)
    expect(gone.events).toContainEqual({ type: 'cracked', at: { x: 3, y: 0 }, left: 0, gone: true })
  })

  it('이동으로 떠난 무너지는 칸에 바람에 밀려 돌아오면 닳기만 하고 무너지지 않는다', () => {
    const state = gusty(
      { cracks: ['...1..', '......', '......'] },
      { player: { x: 3, y: 0 }, cracks: [{ x: 3, y: 0, left: 1 }] },
    )
    const { state: next, events } = move(state, 'right')

    expect(next.player).toEqual({ x: 3, y: 0 })
    expect(next.heights[0][3]).toBe(0)
    expect(next.cracks).toEqual([{ x: 3, y: 0, left: 0 }])
    expect(events).toContainEqual({ type: 'cracked', at: { x: 3, y: 0 }, left: 0, gone: false })
  })

  it('바람이 오는 쪽 옆 칸에 상자가 있으면 숨어서 버틴다', () => {
    const state = gusty({ entities: [{ type: 'box', x: 4, y: 0 }] }, { player: { x: 3, y: 1 } })
    const { state: next, events } = move(state, 'up')

    expect(next.player).toEqual({ x: 3, y: 0 })
    expect(events.at(-1)).toEqual({ type: 'braced', direction: 'left', sheltered: true })
  })

  it('바람이 오는 쪽 옆 칸이 선 높이보다 높으면 숨어서 버틴다', () => {
    const heights = [
      [0, 0, 0, 0, 1, 0],
      [0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0],
    ]
    const { state: next, events } = move(gusty({ heights }, { player: { x: 3, y: 1 } }), 'up')

    expect(next.player).toEqual({ x: 3, y: 0 })
    expect(events.at(-1)).toEqual({ type: 'braced', direction: 'left', sheltered: true })
  })

  it('바람이 오는 쪽 옆 칸이 같은 높이 바닥이나 낮은 칸이나 구덩이면 그대로 밀린다', () => {
    for (const upwind of [1, 0, -1]) {
      const heights = [
        [1, 1, 1, 1, 1, 1],
        [1, 1, 1, 1, upwind, 1],
        [1, 1, 1, 1, 1, 1],
      ]
      const { state: next, events } = move(gusty({ heights }, { player: { x: 3, y: 0 } }), 'down')

      expect(next.player).toEqual({ x: 2, y: 1 })
      expect(events.at(-2)).toEqual({
        type: 'blown',
        from: { x: 3, y: 1 },
        to: { x: 2, y: 1 },
        direction: 'left',
      })
    }
  })

  it('상자 위에 서 있으면 바람 오는 쪽의 같은 높이 상자는 못 막아 주고 밀려 떨어진다', () => {
    const state = gusty(
      {
        entities: [
          { type: 'box', x: 3, y: 0 },
          { type: 'box', x: 4, y: 0 },
        ],
      },
      { player: { x: 3, y: 1 } },
    )
    const { state: next, events } = move(state, 'up')

    expect(next.player).toEqual({ x: 2, y: 0 })
    expect(events.slice(1)).toEqual([
      { type: 'blown', from: { x: 3, y: 0 }, to: { x: 2, y: 0 }, direction: 'left' },
      { type: 'fell', from: { x: 3, y: 0 }, to: { x: 2, y: 0 }, drop: 1 },
    ])
  })

  it('상자 위에 서 있어도 바람 오는 쪽이 더 높은 벽이면 숨어서 버틴다', () => {
    const heights = [
      [0, 0, 0, 0, 2, 0],
      [0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0],
    ]
    const state = gusty(
      { heights, entities: [{ type: 'box', x: 3, y: 0 }] },
      { player: { x: 3, y: 1 } },
    )
    const { state: next, events } = move(state, 'up')

    expect(next.player).toEqual({ x: 3, y: 0 })
    expect(events.at(-1)).toEqual({ type: 'braced', direction: 'left', sheltered: true })
  })

  it('상자 위에 서 있고 바람 오는 쪽이 낮으면 밀려 떨어진다', () => {
    const state = gusty({ entities: [{ type: 'box', x: 3, y: 0 }] }, { player: { x: 3, y: 1 } })
    const { state: next, events } = move(state, 'up')

    expect(next.player).toEqual({ x: 2, y: 0 })
    expect(events.slice(1)).toEqual([
      { type: 'blown', from: { x: 3, y: 0 }, to: { x: 2, y: 0 }, direction: 'left' },
      { type: 'fell', from: { x: 3, y: 0 }, to: { x: 2, y: 0 }, drop: 1 },
    ])
  })

  it('바람이 없는 판에서는 네 번째 수에도 밀리지 않는다', () => {
    const state = gusty({ rules: undefined }, { player: { x: 3, y: 1 } })
    const { state: next, events } = move(state, 'up')

    expect(next.player).toEqual({ x: 3, y: 0 })
    expect(events).toEqual([{ type: 'moved', from: { x: 3, y: 1 }, to: { x: 3, y: 0 } }])
  })
})
