import { describe, expect, it } from 'vitest'

import { durationOf, moveEase, movingBox, playerFrame, restartDrop, restartDuration } from './frame'
import { createState, move } from '@/game/rules'
import type { Stage } from '@/game/types'

const STAGE: Stage = {
  version: 1,
  id: 'test-frame',
  name: '프레임',
  heights: [[1, 1, 0, -1, 0]],
  start: { x: 0, y: 0 },
  goal: { x: 4, y: 0 },
  entities: [],
}

const ICE_STAGE: Stage = {
  version: 1,
  id: 'test-ice',
  name: '얼음',
  heights: [[0, 0, 0, 0, 0]],
  ice: ['.###.'],
  start: { x: 0, y: 0 },
  goal: { x: 4, y: 0 },
  entities: [],
}

describe('playerFrame', () => {
  it('중간 시점에는 두 칸 사이에서 굴러가는 중이다', () => {
    const prev = createState(STAGE)
    const { state, events } = move(prev, 'right')
    const frame = playerFrame(prev, state, events, 0.5)

    expect(frame.x).toBeCloseTo(0.5)
    expect(frame.angle).toBeCloseTo(Math.PI / 4)
    expect(frame.cell).toEqual({ x: 1, y: 0 })
  })

  it('끝나면 도착 칸에 똑바로 서 있다', () => {
    const prev = createState(STAGE)
    const { state, events } = move(prev, 'right')

    expect(playerFrame(prev, state, events, 1)).toMatchObject({ x: 1, y: 0, level: 1, angle: 0 })
  })

  it('내려갈 때는 앞부분에서 높이를 유지하다가 뒤에서 떨어진다', () => {
    const prev = { ...createState(STAGE), player: { x: 1, y: 0 } }
    const { state, events } = move(prev, 'right')

    expect(playerFrame(prev, state, events, 0.3).level).toBe(1)
    expect(playerFrame(prev, state, events, 0.95).level).toBeLessThan(1)
  })

  it('막히면 제자리에서 기울었다 돌아온다', () => {
    const prev = createState(STAGE)
    const { state, events } = move(prev, 'left')

    expect(playerFrame(prev, state, events, 0.5).angle).toBeGreaterThan(0)
    expect(playerFrame(prev, state, events, 0.5).x).toBe(0)
  })
})

// 큐브가 한 층 높은 스위치에서 올라간 발판으로 옮겨 서면 발판과 함께 내려앉는다
const LIFT_STAGE: Stage = {
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

describe('playerFrame 발판', () => {
  it('발판을 타고 내려앉는 이동은 끝에서 최종 높이에 닿는다', () => {
    const prev = move(createState(LIFT_STAGE), 'down').state
    const { state, events } = move(prev, 'right')

    expect(playerFrame(prev, state, events, 0)).toMatchObject({ level: 1 })
    expect(playerFrame(prev, state, events, 0.99).level).toBeCloseTo(0, 1)
    expect(playerFrame(prev, state, events, 1)).toMatchObject({ x: 2, y: 1, level: 0 })
  })

  it('내려앉는 동안 높이가 되올라가지 않는다', () => {
    const prev = move(createState(LIFT_STAGE), 'down').state
    const { state, events } = move(prev, 'right')
    let last = playerFrame(prev, state, events, 0).level

    for (let t = 0.05; t <= 1; t += 0.05) {
      const { level } = playerFrame(prev, state, events, t)
      expect(level).toBeLessThanOrEqual(last)
      last = level
    }
  })

  it('큐브가 움직이지 않아도 발판이 내려간 만큼 높이가 이어진다', () => {
    const onLift = { ...createState(LIFT_STAGE), player: { x: 2, y: 1 } }
    const pressed = { ...onLift, boxes: [{ x: 1, y: 1 }] }

    expect(playerFrame(pressed, onLift, [], 0.5).level).toBeCloseTo(0.5)
  })
})

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
    expect(movingBox(prev, state, events, 0.99)?.level).toBeCloseTo(0, 1)
  })
})

describe('durationOf', () => {
  it('이벤트 중 가장 긴 연출 시간을 쓴다', () => {
    expect(
      durationOf([
        { type: 'moved', from: { x: 0, y: 0 }, to: { x: 1, y: 0 } },
        { type: 'cleared' },
      ]),
    ).toBe(0.24)
    expect(durationOf([])).toBe(0)
  })

  it('미끄러지면 첫 칸 뒤에 미끄러진 칸 수만큼 시간이 더 붙는다', () => {
    const prev = createState(ICE_STAGE)
    const { events } = move(prev, 'right')

    expect(events.some((e) => e.type === 'slid')).toBe(true)
    expect(durationOf(events)).toBeCloseTo(0.24 + 0.09 * 3)
  })

  it('미끄러지는 속도는 칸 수와 상관없이 같다', () => {
    const slideSeconds = (ice: string) => {
      const { events } = move(createState({ ...ICE_STAGE, ice: [ice] }), 'right')
      return durationOf(events) - 0.24
    }

    expect(slideSeconds('.#...') / 1).toBeCloseTo(slideSeconds('.###.') / 3)
  })

  it('한 칸 미끄러지는 시간이 한 칸 걷는 시간보다 짧다', () => {
    const stage: Stage = { ...ICE_STAGE, ice: ['.#...'] }
    const prev = createState(stage)
    const { events } = move(prev, 'right')

    expect(durationOf(events)).toBeLessThan(0.24 * 2)
  })
})

describe('playerFrame 미끄러짐', () => {
  it('첫 칸은 굴러 들어가고 미끄러지는 동안에는 구르지 않는다', () => {
    const prev = createState(ICE_STAGE)
    const { state, events } = move(prev, 'right')
    const rolling = playerFrame(prev, state, events, 0.15)
    const sliding = playerFrame(prev, state, events, 0.6)

    expect(rolling.angle).toBeGreaterThan(0)
    expect(rolling.x).toBeLessThan(1)
    expect(sliding.angle).toBe(0)
    expect(sliding.x).toBeGreaterThan(1)
  })

  it('미끄러지는 동안 앞으로만 가고 마지막 칸에서 멈춘다', () => {
    const prev = createState(ICE_STAGE)
    const { state, events } = move(prev, 'right')
    let last = -1
    for (let t = 0; t < 1; t += 0.02) {
      const frame = playerFrame(prev, state, events, t)
      expect(frame.x).toBeGreaterThanOrEqual(last)
      last = frame.x
    }

    expect(playerFrame(prev, state, events, 1)).toMatchObject({ x: 4, y: 0 })
  })

  it('끝에서 감속한다', () => {
    const prev = createState(ICE_STAGE)
    const { state, events } = move(prev, 'right')
    const speed = (t: number) =>
      (playerFrame(prev, state, events, t + 0.01).x - playerFrame(prev, state, events, t).x) / 0.01

    expect(speed(0.98)).toBeLessThan(speed(0.7))
  })

  it('미끄러지다 낮은 칸으로 떨어지면 마지막에 높이가 낮아진다', () => {
    const stage: Stage = {
      ...ICE_STAGE,
      heights: [[1, 1, 1, 1, 0, 0]],
      ice: ['.###..'],
      goal: { x: 5, y: 0 },
    }
    const prev = createState(stage)
    const { state, events } = move(prev, 'right')

    expect(playerFrame(prev, state, events, 0.5).level).toBe(1)
    expect(playerFrame(prev, state, events, 1)).toMatchObject({ x: 4, y: 0, level: 0 })
  })

  it('큐브가 지나는 칸보다 앞쪽 칸에 그린다', () => {
    const prev = createState(ICE_STAGE)
    const { state, events } = move(prev, 'right')

    expect(playerFrame(prev, state, events, 0.6).cell).toEqual({ x: 4, y: 0 })
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
    expect(movingBox(prev, state, events, 0.9)?.x).toBeGreaterThan(3)
    expect(movingBox(prev, state, events, 0.9)?.to).toEqual({ x: 5, y: 0 })
  })
})

describe('moveEase', () => {
  it('어떤 이어짐이든 0에서 시작해 1에서 끝난다', () => {
    for (const chain of [
      { in: false, out: false },
      { in: true, out: false },
      { in: false, out: true },
      { in: true, out: true },
    ]) {
      expect(moveEase(0, chain)).toBeCloseTo(0)
      expect(moveEase(1, chain)).toBeCloseTo(1)
    }
  })

  it('앞뒤가 모두 이어지면 일정한 속도로 굴러간다', () => {
    expect(moveEase(0.3, { in: true, out: true })).toBe(0.3)
  })

  it('다음 입력이 기다리면 끝에서 멈추지 않고 빠르게 나간다', () => {
    const slope = (chain: { in: boolean; out: boolean }) => (1 - moveEase(0.95, chain)) / 0.05

    expect(slope({ in: false, out: true })).toBeGreaterThan(slope({ in: false, out: false }))
  })
})

describe('moveEase 이어짐 경계', () => {
  it('가운데에서 위치와 속도가 끊기지 않는다', () => {
    const combos = [
      { in: false, out: false },
      { in: true, out: false },
      { in: false, out: true },
      { in: true, out: true },
    ]
    for (const chain of combos) {
      const left = (moveEase(0.5, chain) - moveEase(0.49, chain)) / 0.01
      const right = (moveEase(0.51, chain) - moveEase(0.5, chain)) / 0.01

      expect(moveEase(0.5, chain)).toBeCloseTo(0.5)
      expect(Math.abs(left - right)).toBeLessThan(0.1)
    }
  })
})

describe('restartDrop', () => {
  it('진행도 0에서는 처음 자리보다 높이 떠 있다', () => {
    expect(restartDrop(0, 0, 2).lift).toBeGreaterThan(0)
  })

  it('진행도 1에서는 큐브와 상자가 모두 정확히 처음 자리에 있다', () => {
    for (const order of [0, 1, 2]) {
      expect(restartDrop(1, order, 2)).toEqual({ lift: 0, opacity: 1 })
    }
  })

  it('상자는 순서가 뒤일수록 늦게 내려오기 시작한다', () => {
    expect(restartDrop(0.3, 1, 2).lift).toBeGreaterThan(restartDrop(0.3, 0, 2).lift)
    expect(restartDrop(0.3, 2, 2).lift).toBeGreaterThan(restartDrop(0.3, 1, 2).lift)
  })

  it('내려오는 동안 높이가 계속 낮아지고 되올라가지 않는다', () => {
    let last = restartDrop(0, 0, 2).lift
    for (let t = 0.05; t <= 1; t += 0.05) {
      const lift = restartDrop(t, 0, 2).lift
      expect(lift).toBeLessThanOrEqual(last)
      last = lift
    }
  })

  it('상자가 많을수록 전체 시간이 길어진다', () => {
    expect(restartDuration(3)).toBeGreaterThan(restartDuration(0))
  })
})

describe('restartDrop 늦게 출발하는 단계', () => {
  it('상자가 많아도 늦출 단계가 두 번까지만 늘어난다', () => {
    expect(restartDuration(1)).toBeGreaterThan(restartDuration(0))
    expect(restartDuration(2)).toBeGreaterThan(restartDuration(1))
    expect(restartDuration(5)).toBe(restartDuration(2))
  })

  it('세 번째부터의 상자는 두 번째 상자와 같은 때 출발한다', () => {
    for (const t of [0.1, 0.4, 0.8]) {
      expect(restartDrop(t, 3, 5)).toEqual(restartDrop(t, 2, 5))
      expect(restartDrop(t, 5, 5)).toEqual(restartDrop(t, 2, 5))
    }
  })

  it('떨어지기 시작하자마자 또렷해져서 빈 자리처럼 보이지 않는다', () => {
    expect(restartDrop(0.1, 0, 0).opacity).toBeGreaterThan(0.5)
    expect(restartDrop(0.2, 0, 0).opacity).toBe(1)
  })
})
