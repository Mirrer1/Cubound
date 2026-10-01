import { describe, expect, it } from 'vitest'

import {
  atStage,
  crackFrame,
  crackLeft,
  crackProgress,
  crackSink,
  crackThickness,
  sinkAt,
  standSink,
} from './crackFrame'
import { HOP_STAGE, STAGE, hop } from './testStages'
import { TILE } from '@/game/iso'
import { createState, move } from '@/game/rules'

describe('crackFrame', () => {
  it('남은 횟수가 줄수록 닳은 단계가 오른다', () => {
    expect(crackFrame(2, 2, 1).stage).toBe(0)
    expect(crackFrame(1, 1, 1).stage).toBe(1)
    expect(crackFrame(0, 0, 1).stage).toBe(2)
  })

  it('세 번 이상 남은 칸도 멀쩡한 단계로 그려 단계마다 뜻이 하나로 남는다', () => {
    expect(crackFrame(5, 5, 1).stage).toBe(0)
  })

  it('단계가 오르는 동안 값이 이어지고 되돌아가지 않는다', () => {
    let last = crackFrame(2, 1, 0).stage
    expect(last).toBe(0)
    for (let t = 0.05; t <= 1; t += 0.05) {
      const { stage } = crackFrame(2, 1, t)
      expect(stage).toBeGreaterThanOrEqual(last)
      last = stage
    }
    expect(last).toBeCloseTo(1)
  })

  it('무너지지 않는 칸은 제자리에 또렷하게 남는다', () => {
    for (const t of [0, 0.5, 1]) {
      expect(crackFrame(2, 1, t)).toMatchObject({ fall: 0, opacity: 1, shadow: 0 })
    }
  })

  it('무너지는 칸은 큐브가 떠나자마자 가라앉고 이동이 끝날 때 사라진다', () => {
    expect(crackFrame(0, -1, 0.1)).toMatchObject({ fall: 0, opacity: 1 })
    expect(crackFrame(0, -1, 0.4).fall).toBeGreaterThan(0)
    expect(crackFrame(0, -1, 0.4).opacity).toBeLessThan(1)
    expect(crackFrame(0, -1, 1)).toMatchObject({ opacity: 0 })
  })

  it('무너지는 동안 그림자가 짙어졌다가 자리와 함께 사라진다', () => {
    expect(crackFrame(0, -1, 0.1).shadow).toBe(0)
    expect(crackFrame(0, -1, 0.5).shadow).toBeGreaterThan(0.3)
    expect(crackFrame(0, -1, 1).shadow).toBe(0)
  })

  it('무너지는 동안 계속 내려가고 되올라가지 않는다', () => {
    let last = crackFrame(0, -1, 0).fall
    for (let t = 0.05; t <= 1; t += 0.05) {
      const { fall } = crackFrame(0, -1, t)
      expect(fall).toBeGreaterThanOrEqual(last)
      last = fall
    }
  })

  it('재시작으로 돌아온 칸은 떨어지지 않고 단계가 낮아진다', () => {
    expect(crackFrame(-1, 2, 0.5)).toMatchObject({ fall: 0, opacity: 1 })
    expect(crackFrame(-1, 2, 1).stage).toBe(0)
  })
})

describe('crackSink', () => {
  it('닳은 단계가 오를수록 칸이 더 내려앉는다', () => {
    expect(crackSink(0)).toBe(0)
    expect(crackSink(1)).toBeGreaterThan(crackSink(0))
    expect(crackSink(2)).toBeGreaterThan(crackSink(1))
  })

  it('단계 사이에서는 앞뒤 단계 사이 값으로 이어진다', () => {
    expect(crackSink(0.5)).toBeCloseTo((crackSink(0) + crackSink(1)) / 2)
    expect(crackSink(1.5)).toBeCloseTo((crackSink(1) + crackSink(2)) / 2)
  })
})

describe('crackThickness', () => {
  it('닳은 단계가 오를수록 옆면이 얇아진다', () => {
    expect(crackThickness(0)).toBeLessThan(TILE.lip)
    expect(crackThickness(1)).toBeLessThan(crackThickness(0))
    expect(crackThickness(2)).toBeLessThan(crackThickness(1))
  })

  it('단계 사이에서는 앞뒤 단계 사이 값으로 이어진다', () => {
    expect(crackThickness(0.5)).toBeCloseTo((crackThickness(0) + crackThickness(1)) / 2)
  })
})

describe('crackProgress', () => {
  it('버섯이 없는 이동은 진행도를 그대로 쓴다', () => {
    const prev = createState(STAGE)
    const { events } = move(prev, 'right')

    for (let t = 0; t <= 1; t += 0.1) expect(crackProgress(events, t)).toBeCloseTo(t)
  })

  it('튕겨 가는 이동은 내려앉기 시작한 뒤에 닳는다', () => {
    const { events } = hop(HOP_STAGE)

    expect(crackProgress(events, 0.4)).toBe(0)
    expect(crackProgress(events, 1)).toBe(1)
    expect(crackProgress(events, 0.75)).toBeCloseTo(0.5)
  })
})

describe('atStage', () => {
  const STEPS = [0, 10, 30]

  it('정수 단계는 그 자리 값이다', () => {
    expect(atStage(STEPS, 0)).toBe(0)
    expect(atStage(STEPS, 1)).toBe(10)
    expect(atStage(STEPS, 2)).toBe(30)
  })

  it('단계 사이는 앞뒤 값을 섞는다', () => {
    expect(atStage(STEPS, 0.5)).toBe(5)
    expect(atStage(STEPS, 1.5)).toBe(20)
  })
})

describe('crackLeft', () => {
  const state = { cracks: [{ x: 1, y: 0, left: 2 }] }

  it('무너지는 칸이 앞으로 견디는 횟수를 돌려준다', () => {
    expect(crackLeft(state, { x: 1, y: 0 })).toBe(2)
  })

  it('목록에 없는 칸은 -1이다', () => {
    expect(crackLeft(state, { x: 0, y: 0 })).toBe(-1)
  })
})

describe('sinkAt', () => {
  const at = { x: 1, y: 0 }
  const view = (was: number, left: number, crackPhase: number) => ({
    game: { cracks: [{ ...at, left }] },
    before: { cracks: [{ ...at, left: was }] },
    crackPhase,
  })

  it('무너지는 칸은 닳은 단계만큼 내려앉는다', () => {
    expect(sinkAt(view(1, 1, 1), at)).toBe(crackSink(crackFrame(1, 1, 1).stage))
    expect(sinkAt(view(1, 1, 1), at)).toBeGreaterThan(0)
  })

  it('이 수에 닳는 칸은 진행도만큼 내려앉는다', () => {
    expect(sinkAt(view(2, 1, 0.5), at)).toBe(crackSink(crackFrame(2, 1, 0.5).stage))
  })

  it('무너지는 칸이 아니거나 이미 무너진 칸은 0이다', () => {
    expect(sinkAt(view(1, 1, 1), { x: 0, y: 0 })).toBe(0)
    expect(sinkAt(view(-1, -1, 1), at)).toBe(0)
  })

  it('이 수에 무너진 칸은 앞 횟수로 본다', () => {
    expect(sinkAt(view(1, -1, 0.5), at)).toBe(crackSink(crackFrame(1, -1, 0.5).stage))
  })
})

describe('standSink', () => {
  const view = {
    game: { cracks: [{ x: 1, y: 1, left: 1 }] },
    before: { cracks: [{ x: 1, y: 1, left: 1 }] },
    crackPhase: 1,
  }
  const deep = sinkAt(view, { x: 1, y: 1 })

  it('칸 위에 서 있으면 그 칸의 내려앉은 양이다', () => {
    expect(standSink(view, 1, 1)).toBe(deep)
    expect(standSink(view, 0, 1)).toBe(0)
  })

  it('칸 사이를 지나는 동안은 앞뒤 칸을 섞는다', () => {
    expect(standSink(view, 0.5, 1)).toBeCloseTo(deep / 2)
    expect(standSink(view, 1, 0.25)).toBeCloseTo(deep * 0.25)
  })
})
