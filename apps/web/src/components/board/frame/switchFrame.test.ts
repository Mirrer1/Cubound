import { describe, expect, it } from 'vitest'

import { movingBox } from './boxFrame'
import { passDip, pressProgress, switchCells, switchProgress } from './switchFrame'
import { LIFT_STAGE, SLIDE_SWITCH_STAGE } from './testStages'
import { createState, move } from '@/game/rules'
import type { Stage } from '@/game/types'

describe('switchProgress', () => {
  const push = () => {
    const prev = createState(SLIDE_SWITCH_STAGE)
    return { prev, ...move(prev, 'right') }
  }
  const cells = switchCells(SLIDE_SWITCH_STAGE, 'a')

  it('상자가 스위치에 닿기 전에는 움직이지 않는다', () => {
    const { prev, state, events } = push()

    for (let t = 0; t <= 1; t += 0.02) {
      if (movingBox(prev, state, events, t) !== null) {
        expect(switchProgress(events, cells, true, t)).toBe(0)
      }
    }
  })

  it('상자가 닿은 뒤에 움직이기 시작해 이동이 끝나면 다 움직인다', () => {
    const { prev, state, events } = push()
    let started = 0
    let last = 0
    for (let t = 0; t <= 1; t += 0.02) {
      const progress = switchProgress(events, cells, true, t)
      expect(progress).toBeGreaterThanOrEqual(last)
      if (progress > 0 && started === 0) started = t
      last = progress
    }

    expect(movingBox(prev, state, events, started)).toBeNull()
    expect(switchProgress(events, cells, true, 1)).toBeCloseTo(1)
  })

  it('이 이동과 상관없는 칸은 이동 전체에 걸쳐 섞는다', () => {
    const { events } = push()

    expect(switchProgress(events, [{ x: 0, y: 1 }], true, 0.3)).toBeCloseTo(0.3)
    expect(switchProgress(events, [], true, 0.3)).toBeCloseTo(0.3)
  })

  it('큐브가 떠나서 풀리는 스위치는 이동이 시작할 때부터 움직인다', () => {
    const prev = move(createState(LIFT_STAGE), 'down').state
    const { events } = move(prev, 'right')
    const cells = switchCells(LIFT_STAGE, 'a')

    expect(switchProgress(events, cells, false, 0)).toBe(0)
    expect(switchProgress(events, cells, false, 0.2)).toBeGreaterThan(0)
    expect(switchProgress(events, cells, false, 1)).toBeCloseTo(1)
  })
})

describe('pressProgress', () => {
  const at = { x: 4, y: 0 }
  const push = () => {
    const prev = createState(SLIDE_SWITCH_STAGE)
    return { prev, ...move(prev, 'right') }
  }

  it('상자가 자리에 앉는 때에는 이미 다 눌려 있다', () => {
    const { prev, state, events } = push()
    let landed = 1
    for (let t = 1; t >= 0; t -= 0.01) {
      if (movingBox(prev, state, events, t) !== null) break
      landed = t
    }

    expect(pressProgress(events, at, true, landed)).toBeCloseTo(1)
  })

  it('상자가 오는 동안 눌리기 시작해 줄곧 깊어진다', () => {
    const { events } = push()
    let last = 0
    let started = 1
    for (let t = 0; t <= 1; t += 0.01) {
      const progress = pressProgress(events, at, true, t)
      expect(progress).toBeGreaterThanOrEqual(last)
      if (progress > 0 && last === 0) started = t
      last = progress
    }

    expect(started).toBeGreaterThan(0)
    expect(last).toBeCloseTo(1)
  })

  it('문과 발판보다 먼저 다 눌린다', () => {
    const { events } = push()
    const cells = switchCells(SLIDE_SWITCH_STAGE, 'a')
    const full = (read: (t: number) => number) => {
      for (let t = 0; t <= 1; t += 0.01) if (read(t) >= 1) return t
      return 1
    }

    expect(full((t) => pressProgress(events, at, true, t))).toBeLessThan(
      full((t) => switchProgress(events, cells, true, t)),
    )
  })

  it('이 이동과 상관없는 칸은 이동 전체에 걸쳐 섞는다', () => {
    const { events } = push()

    expect(pressProgress(events, { x: 0, y: 1 }, true, 0.3)).toBeCloseTo(0.3)
  })
})

describe('passDip', () => {
  const stage: Stage = {
    version: 1,
    id: 'test-pass-switch',
    name: '지나치는 스위치',
    heights: [
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
    ],
    ice: ['.###.', '.....'],
    start: { x: 0, y: 0 },
    goal: { x: 4, y: 1 },
    entities: [
      { type: 'switch', x: 2, y: 0, target: 'a' },
      { type: 'door', id: 'a', x: 0, y: 1 },
    ],
  }
  const at = { x: 2, y: 0 }
  const dips = (from: typeof stage.start, dir: 'right' | 'left') => {
    const { events } = move(createState({ ...stage, start: from }), dir)
    return Array.from({ length: 101 }, (_, i) => passDip(events, at, i / 100))
  }

  it('미끄러져 지나가는 동안 살짝 눌렸다가 돌아온다', () => {
    const values = dips({ x: 0, y: 0 }, 'right')

    expect(Math.max(...values)).toBeCloseTo(1, 1)
    expect(values[0]).toBe(0)
    expect(values[100]).toBe(0)
  })

  it('미끄러지지 않고 닿지 않는 칸은 그대로다', () => {
    const { events } = move(createState(stage), 'down')

    expect(passDip(events, at, 0.5)).toBe(0)
    expect(Math.max(...dips({ x: 3, y: 0 }, 'right'))).toBe(0)
  })

  it('걸어 들어온 스위치 칸에서 바로 미끄러져 나가도 같다', () => {
    const { events } = move(createState({ ...stage, start: { x: 4, y: 0 } }), 'left')
    const values = Array.from({ length: 101 }, (_, i) => passDip(events, { x: 3, y: 0 }, i / 100))

    expect(Math.max(...values)).toBeGreaterThan(0.5)
    expect(values[100]).toBe(0)
  })

  it('스위치 위에서 출발해 미끄러지면 지나친 것으로 치지 않는다', () => {
    const { events } = move(createState({ ...stage, start: { x: 2, y: 0 } }), 'right')

    expect(Math.max(...Array.from({ length: 101 }, (_, i) => passDip(events, at, i / 100)))).toBe(0)
  })

  it('지나가는 상자도 같다', () => {
    const boxStage: Stage = {
      ...stage,
      entities: [...stage.entities, { type: 'box', x: 1, y: 0 }],
    }
    const { events } = move(createState(boxStage), 'right')
    const values = Array.from({ length: 101 }, (_, i) => passDip(events, at, i / 100))

    expect(Math.max(...values)).toBeGreaterThan(0.5)
  })
})
