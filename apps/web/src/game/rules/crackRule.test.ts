import { describe, expect, it } from 'vitest'

import type { GameState, Point, Stage } from '../types'
import { move } from './moveRule'
import { createState } from './stateRule'
import { play } from './testStages'

const CRACK_STAGE: Stage = {
  version: 1,
  id: 'test-crack',
  name: '무너지는 칸 테스트',
  heights: [
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  start: { x: 0, y: 1 },
  goal: { x: 3, y: 0 },
  entities: [],
  cracks: ['....', '.2..', '....'],
}

const CRACK: Point = { x: 1, y: 1 }

const withCrackRow = (row: number[]) => [CRACK_STAGE.heights[0], row, CRACK_STAGE.heights[2]]

const leftAt = (state: GameState, p: Point) =>
  state.cracks.find((crack) => crack.x === p.x && crack.y === p.y)?.left

describe('move 무너지는 칸', () => {
  // 왼쪽 끝 무너지는 칸 옆에 얼음 길이 있어 닳아 사라진 자리로 미끄러져 들어갈 수 있다
  const CRACK_ICE_STAGE: Stage = {
    ...CRACK_STAGE,
    heights: [
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
    ],
    start: { x: 0, y: 0 },
    goal: { x: 4, y: 2 },
    cracks: ['.....', '1....', '.....'],
    ice: ['.....', '.##..', '.....'],
  }

  it('올라선 동안에는 남은 횟수가 그대로다', () => {
    const { state, events } = move(createState(CRACK_STAGE), 'right')

    expect(state.player).toEqual(CRACK)
    expect(leftAt(state, CRACK)).toBe(2)
    expect(events.some((e) => e.type === 'cracked')).toBe(false)
  })

  it('떠나면 남은 횟수가 하나 준다', () => {
    const { state, events } = play(CRACK_STAGE, ['right', 'right'])

    expect(leftAt(state, CRACK)).toBe(1)
    expect(state.heights[1][1]).toBe(0)
    expect(events).toContainEqual({ type: 'cracked', at: CRACK, left: 1, gone: false })
  })

  it('남은 횟수를 다 쓰면 바닥 없는 칸이 되어 다시 지나가지 못한다', () => {
    const { state, events } = play(CRACK_STAGE, ['right', 'right', 'left', 'left'])

    expect(state.heights[1][1]).toBe(-1)
    expect(events).toContainEqual({ type: 'cracked', at: CRACK, left: 0, gone: true })
    expect(move(state, 'right').events).toEqual([{ type: 'blocked', direction: 'right' }])
  })

  it('막혀서 제자리로 돌아오면 줄지 않는다', () => {
    const stage: Stage = { ...CRACK_STAGE, cracks: ['....', '2...', '....'] }
    const start = createState(stage)
    const { state, events } = move(start, 'left')

    expect(state).toBe(start)
    expect(events).toEqual([{ type: 'blocked', direction: 'left' }])
  })

  it('상자가 남아 있으면 큐브가 떠나도 줄지 않는다', () => {
    const stage: Stage = {
      ...CRACK_STAGE,
      heights: withCrackRow([0, 0, 1, 0]),
      entities: [{ type: 'box', x: 1, y: 1 }],
    }
    const { state, events } = play(stage, ['right', 'up'])

    expect(state.player).toEqual({ x: 1, y: 0 })
    expect(state.boxes).toEqual([CRACK])
    expect(leftAt(state, CRACK)).toBe(2)
    expect(events.some((e) => e.type === 'cracked')).toBe(false)
  })

  it('상자가 밀려 나가면 남은 횟수가 준다', () => {
    const stage: Stage = { ...CRACK_STAGE, entities: [{ type: 'box', x: 1, y: 1 }] }
    const { state, events } = move(createState(stage), 'right')

    expect(state.boxes).toEqual([{ x: 2, y: 1 }])
    expect(state.player).toEqual(CRACK)
    expect(leftAt(state, CRACK)).toBe(1)
    expect(events).toContainEqual({ type: 'cracked', at: CRACK, left: 1, gone: false })
  })

  it('한 번 남은 칸의 상자를 밀면 큐브가 선 동안은 바닥이 남고 떠날 때 사라진다', () => {
    const stage: Stage = {
      ...CRACK_STAGE,
      cracks: ['....', '.1..', '....'],
      entities: [{ type: 'box', x: 1, y: 1 }],
    }
    const pushed = move(createState(stage), 'right')
    const away = move(pushed.state, 'up')

    expect(pushed.state.heights[1][1]).toBe(0)
    expect(pushed.events).toContainEqual({ type: 'cracked', at: CRACK, left: 0, gone: false })
    expect(away.state.heights[1][1]).toBe(-1)
    expect(away.events).toContainEqual({ type: 'cracked', at: CRACK, left: 0, gone: true })
  })

  it('무너진 칸에 상자를 밀어 넣으면 다시 바닥이 되고 다시 무너지지 않는다', () => {
    const stage: Stage = {
      ...CRACK_STAGE,
      cracks: ['....', '.1..', '....'],
      entities: [{ type: 'box', x: 2, y: 1 }],
    }
    const { state } = play(stage, ['right', 'down', 'right', 'right', 'up', 'left'])
    const onFill = move(state, 'left')
    const offFill = move(onFill.state, 'left')

    expect(state.heights[1][1]).toBe(0)
    expect(state.boxes).toEqual([])
    expect(onFill.state.player).toEqual(CRACK)
    expect(offFill.state.heights[1][1]).toBe(0)
    expect(offFill.events.some((e) => e.type === 'cracked')).toBe(false)
  })

  it('떨어지거나 올라가며 떠나도 남은 횟수가 준다', () => {
    const cliff: Stage = { ...CRACK_STAGE, heights: withCrackRow([1, 1, 0, 0]) }
    const fallen = play(cliff, ['right', 'right'])

    expect(fallen.events).toContainEqual({ type: 'cracked', at: CRACK, left: 1, gone: false })

    const wall: Stage = {
      ...CRACK_STAGE,
      heights: withCrackRow([0, 0, 0, 1]),
      entities: [{ type: 'box', x: 2, y: 1 }],
    }
    const climbed = play(wall, ['right', 'right'])

    expect(climbed.state.player).toEqual({ x: 2, y: 1 })
    expect(climbed.events).toContainEqual({ type: 'cracked', at: CRACK, left: 1, gone: false })
  })

  it('기대 놓은 사다리가 있으면 다 닳아도 무너지지 않는다', () => {
    const stage: Stage = {
      ...CRACK_STAGE,
      heights: withCrackRow([0, 0, 1, 0]),
      cracks: ['....', '.1..', '....'],
      entities: [{ type: 'ladder', x: 0, y: 2 }],
    }
    // 사다리를 주워 와 무너지는 칸에서 오른쪽 턱에 기대 놓고 오른다
    const leaned = play(stage, ['down', 'up', 'right', 'right'])

    expect(leaned.state.leaningLadders).toEqual([{ x: 1, y: 1, direction: 'right' }])
    expect(leaned.state.heights[1][1]).toBe(0)

    const climbed = move(leaned.state, 'right')
    expect(climbed.state.player).toEqual({ x: 2, y: 1 })
    expect(climbed.state.heights[1][1]).toBe(0)
    expect(climbed.events.every((e) => e.type !== 'cracked' || !e.gone)).toBe(true)
  })

  it('다 닳은 칸의 기대 놓은 사다리를 도로 들고 떠나면 그때 무너진다', () => {
    const stage: Stage = {
      ...CRACK_STAGE,
      heights: withCrackRow([0, 0, 1, 0]),
      cracks: ['....', '.1..', '....'],
      entities: [{ type: 'ladder', x: 0, y: 2 }],
    }
    const picked = play(stage, ['down', 'up', 'right', 'right', 'right', 'left'])
    const { state, events } = move(picked.state, 'left')

    expect(picked.state.carrying).toBe('ladder')
    expect(picked.state.leaningLadders).toEqual([])
    expect(picked.state.heights[1][1]).toBe(0)
    expect(state.heights[1][1]).toBe(-1)
    expect(events).toContainEqual({ type: 'cracked', at: CRACK, left: 0, gone: true })
  })

  it('얼음으로 미끄러져 떠나도 남은 횟수가 준다', () => {
    const stage: Stage = { ...CRACK_STAGE, ice: ['....', '..##', '....'] }
    const { state, events } = play(stage, ['right', 'right'])

    expect(state.player).toEqual({ x: 3, y: 1 })
    expect(leftAt(state, CRACK)).toBe(1)
    expect(events).toContainEqual({ type: 'cracked', at: CRACK, left: 1, gone: false })
  })

  it('미끄러져 무너지는 칸에 도착해 멈추면 줄지 않는다', () => {
    const stage: Stage = {
      ...CRACK_STAGE,
      cracks: ['....', '...2', '....'],
      ice: ['....', '.##.', '....'],
    }
    const { state, events } = move(createState(stage), 'right')

    expect(state.player).toEqual({ x: 3, y: 1 })
    expect(leftAt(state, { x: 3, y: 1 })).toBe(2)
    expect(events.some((e) => e.type === 'cracked')).toBe(false)
  })

  it('순간이동으로 떠나도 남은 횟수가 준다', () => {
    const stage: Stage = {
      ...CRACK_STAGE,
      entities: [
        { type: 'warp', x: 2, y: 1, id: 'a' },
        { type: 'warp', x: 3, y: 2, id: 'a' },
      ],
    }
    const { state, events } = play(stage, ['right', 'right'])

    expect(state.player).toEqual({ x: 3, y: 2 })
    expect(leftAt(state, CRACK)).toBe(1)
    expect(events).toContainEqual({ type: 'cracked', at: CRACK, left: 1, gone: false })
  })

  it('미끄러지다 무너져 사라진 자리를 만나면 그 앞에서 멈춘다', () => {
    const { state, events } = play(CRACK_ICE_STAGE, [
      'down',
      'up',
      'right',
      'right',
      'right',
      'down',
      'left',
    ])

    expect(state.heights[1][0]).toBe(-1)
    expect(state.player).toEqual({ x: 1, y: 1 })
    expect(events).toEqual([
      { type: 'moved', from: { x: 3, y: 1 }, to: { x: 2, y: 1 } },
      { type: 'slid', subject: 'player', from: { x: 2, y: 1 }, to: { x: 1, y: 1 } },
    ])
  })

  it('미끄러지던 상자가 무너져 사라진 자리를 메운다', () => {
    const stage: Stage = { ...CRACK_ICE_STAGE, entities: [{ type: 'box', x: 3, y: 1 }] }
    const { state, events } = play(stage, [
      'down',
      'up',
      'right',
      'right',
      'right',
      'right',
      'down',
      'left',
    ])

    expect(state.boxes).toEqual([])
    expect(state.heights[1][0]).toBe(0)
    expect(state.player).toEqual({ x: 3, y: 1 })
    expect(events).toEqual([
      { type: 'pushed', from: { x: 3, y: 1 }, to: { x: 2, y: 1 }, result: 'slid' },
      { type: 'slid', subject: 'box', from: { x: 2, y: 1 }, to: { x: 1, y: 1 } },
      { type: 'pushed', from: { x: 1, y: 1 }, to: { x: 0, y: 1 }, result: 'filled' },
      { type: 'moved', from: { x: 4, y: 1 }, to: { x: 3, y: 1 } },
    ])
  })

  it('상자가 얼음을 타고 다른 무너지는 칸에 멈추면 떠난 칸만 닳는다', () => {
    const stage: Stage = {
      ...CRACK_ICE_STAGE,
      start: { x: 0, y: 1 },
      cracks: ['.....', '.2.2.', '.....'],
      ice: ['.....', '..#..', '.....'],
      entities: [{ type: 'box', x: 1, y: 1 }],
    }
    const { state, events } = move(createState(stage), 'right')

    expect(state.boxes).toEqual([{ x: 3, y: 1 }])
    expect(leftAt(state, { x: 1, y: 1 })).toBe(1)
    expect(leftAt(state, { x: 3, y: 1 })).toBe(2)
    expect(events.filter((e) => e.type === 'cracked')).toEqual([
      { type: 'cracked', at: { x: 1, y: 1 }, left: 1, gone: false },
    ])
  })

  it('올라가기 제한을 다 써 오르지 못하면 제자리라 남은 횟수가 줄지 않는다', () => {
    const stage: Stage = {
      ...CRACK_STAGE,
      heights: withCrackRow([0, 0, 0, 1]),
      entities: [{ type: 'box', x: 2, y: 1 }],
      rules: { climbLimit: 1 },
    }
    const onCrack = play(stage, ['right', 'right', 'left']).state
    const { state, events } = move(onCrack, 'right')

    expect(onCrack.player).toEqual(CRACK)
    expect(state).toBe(onCrack)
    expect(events).toEqual([
      { type: 'blocked', direction: 'right' },
      { type: 'limit', limit: 'climbs' },
    ])
    expect(leftAt(state, CRACK)).toBe(1)
  })
})
