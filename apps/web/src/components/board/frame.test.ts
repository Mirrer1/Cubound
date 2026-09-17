import { describe, expect, it } from 'vitest'

import { durationOf, moveEase, movingBox, playerFrame } from './frame'
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
