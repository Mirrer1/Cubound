import { describe, expect, it } from 'vitest'

import {
  atStage,
  crackClip,
  crackFrame,
  crackLeft,
  crackProgress,
  crackSink,
  crackThickness,
  crumbleShown,
  sinkAt,
  standSink,
} from './crackFrame'
import { kegPath } from './kegFrame'
import { SECONDS, boxPath, segmentsOf, totalSeconds } from './pathFrame'
import { crackLeave, durationOf, playerSegments } from './timeFrame'
import { TILE, toScreen } from '@/game/iso'
import { createState, move } from '@/game/rules'
import type { Stage } from '@/game/types'

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

  it('재시작으로 돌아온 무너진 칸은 밟기 전 모습 그대로 옅은 데서 또렷해진다', () => {
    expect(crackFrame(-1, 2, 0.5)).toMatchObject({ stage: 0, fall: 0, opacity: 0.5 })
    expect(crackFrame(-1, 2, 1)).toMatchObject({ stage: 0, opacity: 1 })
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
  // 무너지는 칸을 향해 steps번 오른쪽으로 가는 수의 마지막 이벤트
  const stepRight = (cracks: string, steps = 1) => {
    const stage: Stage = {
      version: 1,
      id: 'test-crack-progress',
      heights: [[0, 0, 0]],
      cracks: [cracks],
      start: { x: 0, y: 0 },
      goal: { x: 2, y: 0 },
      entities: [],
    }
    let result = move(createState(stage), 'right')
    for (let i = 1; i < steps; i++) result = move(result.state, 'right')
    return result.events
  }

  it('큐브가 걸음 절반을 넘기 전에는 닳지 않고 넘은 뒤 닳는 시간 동안 닳는다', () => {
    const events = stepRight('.2.')
    const total = durationOf(events)
    const leave = crackLeave(events)

    expect(total).toBeCloseTo(leave + 0.38)
    expect(crackProgress(events, (leave * 0.9) / total)).toBe(0)
    expect(crackProgress(events, (leave + 0.19) / total)).toBeCloseTo(0.5)
    expect(crackProgress(events, 1)).toBe(1)
  })

  it('미끄러져 들어서는 칸은 큐브가 멈춰 닿은 뒤부터 닳는다', () => {
    const stage: Stage = {
      version: 1,
      id: 'test-crack-slide',
      heights: [[0, 0, 0, 0]],
      cracks: ['...2'],
      ice: ['.##.'],
      start: { x: 0, y: 0 },
      goal: { x: 3, y: 0 },
      entities: [],
    }
    const { events } = move(createState(stage), 'right')

    expect(crackLeave(events)).toBeCloseTo(totalSeconds(playerSegments(events)))
  })

  it('밀린 상자가 들어서는 칸은 상자가 닿은 뒤부터 닳는다', () => {
    const stage: Stage = {
      version: 1,
      id: 'test-crack-box',
      heights: [[0, 0, 0, 0]],
      cracks: ['..2.'],
      start: { x: 0, y: 0 },
      goal: { x: 3, y: 0 },
      entities: [{ type: 'box', x: 1, y: 0 }],
    }
    const { events } = move(createState(stage), 'right')

    expect(crackLeave(events, { x: 2, y: 0 })).toBeCloseTo(
      totalSeconds(segmentsOf(boxPath(events))),
    )
  })

  it('밀린 화약통과 쇠막대가 들어서는 칸도 닿은 뒤부터 닳는다', () => {
    const pushRight = (entities: Stage['entities'], cracks: string) => {
      const stage: Stage = {
        version: 1,
        id: 'test-crack-push',
        heights: [[0, 0, 0, 0, 0]],
        cracks: [cracks],
        start: { x: 0, y: 0 },
        goal: { x: 4, y: 0 },
        entities,
      }
      return move(createState(stage), 'right').events
    }
    const keg = pushRight([{ type: 'keg', x: 1, y: 0 }], '..2..')
    const bar = pushRight([{ type: 'bar', axis: 'x', x: 1, y: 0 }], '...2.')

    expect(totalSeconds(segmentsOf(kegPath(keg)))).toBeGreaterThan(0)
    expect(crackLeave(keg, { x: 2, y: 0 })).toBeCloseTo(totalSeconds(segmentsOf(kegPath(keg))))
    expect(crackLeave(bar, { x: 3, y: 0 })).toBeCloseTo(SECONDS.pushed)
  })

  it('떨어져 들어서는 칸은 큐브가 닿은 뒤부터 닳는다', () => {
    const stage: Stage = {
      version: 1,
      id: 'test-crack-fall',
      heights: [[1, 0, 0]],
      cracks: ['.2.'],
      start: { x: 0, y: 0 },
      goal: { x: 2, y: 0 },
      entities: [],
    }
    const { events } = move(createState(stage), 'right')

    expect(crackLeave(events)).toBeCloseTo(totalSeconds(playerSegments(events)))
  })

  it('다 닳은 칸을 떠나 무너지는 수는 무너짐 시간이 더해진다', () => {
    const events = stepRight('.1.', 2)
    expect(durationOf(events)).toBeCloseTo(crackLeave(events) + 0.44)
  })

  it('무너지는 칸과 상관없는 이동은 그대로 끝까지 간다', () => {
    expect(crackProgress(stepRight('...'), 1)).toBe(1)
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

  it('범위 밖은 양 끝 단계 값에서 멈춘다', () => {
    expect(atStage(STEPS, 3)).toBe(30)
    expect(atStage(STEPS, -1)).toBe(0)
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

describe('crackClip', () => {
  const sunk = (cracks: { x: number; y: number; left: number }[]) => ({
    game: { cracks },
    before: { cracks },
    crackPhase: 1,
  })
  const FLAT = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ]
  const ys = (points: string) => points.split(' ').map((p) => Number(p.split(',')[1]))

  it('내려앉은 칸에 걸치지 않으면 자르지 않는다', () => {
    expect(crackClip(sunk([{ x: 1, y: 1, left: 1 }]), FLAT, 0, 0)).toBeNull()
  })

  it('같은 높이 앞 칸이 있으면 내려앉은 칸 앞 가장자리에서 자른다', () => {
    const clip = crackClip(sunk([{ x: 1, y: 1, left: 1 }]), FLAT, 1, 1)
    expect(clip).not.toBeNull()
    expect(Math.max(...ys(clip ?? ''))).toBeCloseTo(toScreen({ x: 1.5, y: 1.5 }, 0).y)
  })

  it('앞 칸이 모두 구덩이면 자르지 않는다', () => {
    const pits = [
      [0, 0, -1],
      [0, 0, -1],
      [-1, -1, -1],
    ]
    expect(crackClip(sunk([{ x: 1, y: 1, left: 1 }]), pits, 1, 1)).toBeNull()
  })

  it('앞 칸도 내려앉았으면 그만큼 낮춘 선에서 자른다', () => {
    const both = sunk([
      { x: 1, y: 1, left: 0 },
      { x: 2, y: 1, left: 1 },
    ])
    const pits = [
      [0, 0, 0],
      [0, 0, 0],
      [-1, -1, -1],
    ]
    const clip = crackClip(both, pits, 1, 1)
    const drop = sinkAt(both, { x: 2, y: 1 })
    // 네 번째 점은 x = 1.5 가장자리 선 위의 점
    expect(drop).toBeGreaterThan(0)
    expect(ys(clip ?? '')[3]).toBeCloseTo(toScreen({ x: 1.5, y: -18.5 }, 0).y + drop)
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

describe('crumbleShown', () => {
  const at = { x: 1, y: 1 }
  const view = (was: number, left: number, phase: number) => ({
    game: { cracks: left >= 0 ? [{ ...at, left }] : [] },
    before: { cracks: was >= 0 ? [{ ...at, left: was }] : [] },
    crackPhase: phase,
  })

  it('이 수에 무너지는 칸은 무너지는 진하기를 따른다', () => {
    expect(crumbleShown(view(0, -1, 0.7), at)).toBe(crackFrame(0, -1, 0.7).opacity)
    expect(crumbleShown(view(0, -1, 0.7), at)).toBeLessThan(1)
  })

  it('무너지지 않는 칸은 1이다', () => {
    expect(crumbleShown(view(1, 0, 0.7), at)).toBe(1)
    expect(crumbleShown(view(-1, -1, 0.7), at)).toBe(1)
  })
})
