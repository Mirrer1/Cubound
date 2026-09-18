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

describe('movingBox', () => {
  it('밀린 상자는 두 칸 사이를 미끄러진다', () => {
    const stage: Stage = { ...STAGE, heights: [[0, 0, 0]], entities: [{ type: 'box', x: 1, y: 0 }] }
    const prev = createState(stage)
    const { events } = move(prev, 'right')

    expect(movingBox(prev, events, 0.5)).toMatchObject({ x: 1.5, level: 0, to: { x: 2, y: 0 } })
    expect(movingBox(prev, events, 1)).toBeNull()
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
