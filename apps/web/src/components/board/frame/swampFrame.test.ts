import { describe, expect, it } from 'vitest'

import { movingBox } from './boxFrame'
import { playerFrame } from './cubeFrame'
import { boxSink, swampCollar, swampFrame, swampSink, swampTime } from './swampFrame'
import { STAGE, SWAMP_STAGE, enterSwamp, leaveSwamp, sinkBox, struggleSwamp } from './testStages'
import { durationOf } from './timeFrame'
import { createState, move } from '@/game/rules'
import type { Stage } from '@/game/types'

// 늪에 times번 빠져 마지막 늪에 막 들어선 상태, n번째 늪의 버둥은 n+1수
const deepSwamp = (times: number) => {
  let state = createState({ ...SWAMP_STAGE, rules: { swampDeepen: true } })
  let side: 'left' | 'right' = 'right'

  for (let n = 1; n <= times; n += 1) {
    state = move(state, side).state
    if (n === times) break
    for (let done = 0; done <= n; done += 1) state = move(state, side).state
    state = move(state, side).state
    side = side === 'right' ? 'left' : 'right'
  }
  return state
}

// 늪만 없는 같은 판, 상자 밀기가 늪 때문에 달라지지 않았는지 재는 잣대
const PUSH_STAGE: Stage = {
  version: 1,
  id: 'test-push',
  name: '밀기',
  heights: [[0, 0, 0, 0, 0]],
  start: { x: 0, y: 0 },
  goal: { x: 4, y: 0 },
  entities: [{ type: 'box', x: 1, y: 0 }],
}

const pushBox = () => {
  const prev = createState(PUSH_STAGE)
  return { prev, ...move(prev, 'right') }
}

describe('swampFrame', () => {
  it('들어가는 이동은 큐브가 칸에 닿은 뒤에 가라앉는다', () => {
    const { prev, state, events } = enterSwamp()
    const swamp = swampTime(prev, state)

    for (let t = 0; t <= 1; t += 0.02) {
      const frame = swampFrame(prev, state, events, t)
      if (!frame) continue
      if (frame.deep > 0) expect(playerFrame(prev, state, events, t).x).toBeCloseTo(2)
    }

    expect(swampFrame(prev, state, events, 0)?.deep).toBe(0)
    expect(swampFrame(prev, state, events, 1)).toMatchObject({ risen: 0, deep: 1 })
    expect(swamp.tail).toBeGreaterThan(0)
  })

  it('버둥은 다음 단계보다 더 솟았다가 그 단계에서 멈춘다', () => {
    const { prev, state, events } = struggleSwamp()
    let highest = 0

    for (let t = 0; t <= 1; t += 0.02) {
      const frame = swampFrame(prev, state, events, t)
      expect(frame?.deep).toBe(1)
      highest = Math.max(highest, frame?.risen ?? 0)
    }

    expect(swampFrame(prev, state, events, 0)?.risen).toBeCloseTo(0)
    expect(highest).toBeGreaterThan(0.5)
    expect(swampFrame(prev, state, events, 1)?.risen).toBeCloseTo(0.5)
  })

  it('나오는 이동은 다 올라오기 전에는 떠나기 전 칸에 그대로 선다', () => {
    const { prev, state, events } = leaveSwamp()

    expect(swampFrame(prev, state, events, 0)).toMatchObject({ cell: { x: 2, y: 0 }, deep: 1 })
    for (let t = 0; t <= 1; t += 0.02) {
      const frame = swampFrame(prev, state, events, t)
      if (frame && frame.deep > 0) expect(playerFrame(prev, state, events, t).x).toBeCloseTo(2)
    }

    expect(swampFrame(prev, state, events, 1)).toBeNull()
  })

  it('늪에 선 큐브는 이동이 없으면 그 단계 깊이에 머문다', () => {
    const { state } = struggleSwamp()

    expect(swampFrame(null, state, [], 1)).toMatchObject({ risen: 0.5, deep: 1 })
  })

  it('늪이 없는 판은 잠긴 큐브가 없다', () => {
    const prev = createState(STAGE)
    const { state, events } = move(prev, 'right')

    expect(swampFrame(prev, state, events, 0.5)).toBeNull()
  })

  it('깊어지는 늪은 버둥이 6수여도 제일 깊은 곳에서 시작해 마지막 버둥에서 다 올라온다', () => {
    let state = deepSwamp(5)

    expect(swampFrame(null, state, [], 1)).toMatchObject({ risen: 0, deep: 1 })

    for (let done = 1; done <= 6; done += 1) {
      const prev = state
      const result = move(prev, 'right')
      state = result.state
      expect(swampFrame(prev, state, result.events, 1)?.risen).toBeCloseTo(done / 6, 6)
    }
  })
})

describe('swampSink', () => {
  it('버둥이 2수면 13 / 9.5 / 6 까지 올라오고 진흙 테는 0.72 / 0.69 / 0.66 이다', () => {
    const sink = [13, 9.5, 6]
    const collar = [0.72, 0.69, 0.66]

    for (let done = 0; done <= 2; done += 1) {
      expect(swampSink(done / 2)).toBeCloseTo(sink[done], 6)
      expect(swampCollar(done / 2)).toBeCloseTo(collar[done], 6)
    }
  })

  it('버둥 사이를 잇는 값도 고르게 이어진다', () => {
    expect(swampSink(0.25)).toBeCloseTo(11.25, 6)
    expect(swampCollar(0.25)).toBeCloseTo(0.705, 6)
  })

  it('버둥이 6수여도 같은 깊이에서 같은 깊이까지 고르게 올라온다', () => {
    const sink = [0, 1, 2, 3, 4, 5, 6].map((done) => swampSink(done / 6))

    expect(sink[0]).toBeCloseTo(13, 6)
    expect(sink[6]).toBeCloseTo(6, 6)
    for (let i = 1; i < sink.length; i += 1) expect(sink[i - 1] - sink[i]).toBeCloseTo(7 / 6, 6)

    expect(swampCollar(0)).toBeCloseTo(0.72, 6)
    expect(swampCollar(1)).toBeCloseTo(0.66, 6)
  })
})

describe('boxSink', () => {
  it('상자는 밀리고 나서 다 잠기고 그 자리가 드러난다', () => {
    const { prev, state, events } = sinkBox()
    const swamp = swampTime(prev, state)

    expect(boxSink(events, swamp, 0)).toMatchObject({ at: { x: 2, y: 0 }, deep: 0, filled: 0 })
    expect(boxSink(events, swamp, 1)).toMatchObject({ deep: 1, filled: 1 })
    expect(state.swamps).toEqual([])
  })

  it('상자는 칸에 닿기 전부터 가라앉기 시작한다', () => {
    const { prev, state, events } = sinkBox()
    const swamp = swampTime(prev, state)
    let seen = 0

    for (let t = 0; t <= 1; t += 0.01) {
      const sinking = boxSink(events, swamp, t)
      const frame = movingBox(prev, state, events, t)
      if (sinking && sinking.deep > 0 && frame && frame.x < 2) seen += 1
    }

    expect(seen).toBeGreaterThan(0)
  })

  it('밀리는 길과 걸리는 시간은 늪이 없는 판과 같다', () => {
    const sunk = sinkBox()
    const plain = pushBox()
    const swamp = swampTime(sunk.prev, sunk.state)
    const sinkSeconds = durationOf(sunk.events, swamp)
    const pushSeconds = durationOf(plain.events)
    let seen = 0

    for (let seconds = 0; seconds < pushSeconds; seconds += pushSeconds / 20) {
      const a = movingBox(sunk.prev, sunk.state, sunk.events, seconds / sinkSeconds)
      const b = movingBox(plain.prev, plain.state, plain.events, seconds / pushSeconds)
      if (!a || !b) continue
      expect(a.x).toBeCloseTo(b.x)
      seen += 1
    }

    expect(seen).toBe(20)
    expect(movingBox(sunk.prev, sunk.state, sunk.events, pushSeconds / sinkSeconds)?.x).toBeCloseTo(
      2,
    )
  })

  it('상자는 다 잠길 때까지 그 칸에 남는다', () => {
    const { prev, state, events } = sinkBox()
    const swamp = swampTime(prev, state)
    let seen = 0

    for (let t = 0; t <= 1; t += 0.02) {
      const sinking = boxSink(events, swamp, t)
      if (sinking && sinking.deep > 0 && sinking.deep < 1) {
        expect(movingBox(prev, state, events, t)).toMatchObject({ cell: { x: 2, y: 0 } })
        seen += 1
      }
    }

    expect(seen).toBeGreaterThan(0)
    expect(movingBox(prev, state, events, 1)).toBeNull()
  })

  it('가라앉는 상자가 없으면 null이다', () => {
    expect(boxSink([{ type: 'blocked', direction: 'left' }], { lead: 0, tail: 0 }, 0.5)).toBeNull()
  })
})
