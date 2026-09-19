import { describe, expect, it } from 'vitest'

import {
  crackFrame,
  crackSink,
  crackThickness,
  durationOf,
  frostAt,
  moveEase,
  movingBox,
  pickUpProgress,
  playerFrame,
  restartDrop,
  restartDuration,
  switchCells,
  switchProgress,
} from './frame'
import { TILE } from '@/game/iso'
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

const slide = (ice: string) => {
  const prev = createState({ ...ICE_STAGE, ice: [ice] })
  return { prev, ...move(prev, 'right') }
}

// 서리가 다 옅어질 때까지 연출이 이어져서 durationOf로는 큐브가 언제 멈추는지 알 수 없다
const slideSeconds = (ice: string) => {
  const { prev, state, events } = slide(ice)
  let lo = 0
  let hi = 1
  for (let i = 0; i < 40; i += 1) {
    const mid = (lo + hi) / 2
    if (playerFrame(prev, state, events, mid).x >= state.player.x) hi = mid
    else lo = mid
  }
  return hi * durationOf(events) - 0.24
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

// 밀린 상자가 얼음을 건너 스위치에 닿으면 큐브가 선 발판이 올라간다
const SLIDE_SWITCH_STAGE: Stage = {
  version: 1,
  id: 'test-slide-switch',
  name: '미끄러지는 스위치',
  heights: [
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
  ],
  ice: ['..##.', '.....'],
  start: { x: 0, y: 0 },
  goal: { x: 4, y: 1 },
  entities: [
    { type: 'box', x: 1, y: 0 },
    { type: 'lift', x: 1, y: 0, id: 'a' },
    { type: 'switch', x: 4, y: 0, target: 'a' },
  ],
}

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

describe('playerFrame 발판 타이밍', () => {
  it('큐브는 발판이 오르는 때에 맞춰 같이 오른다', () => {
    const prev = createState(SLIDE_SWITCH_STAGE)
    const { state, events } = move(prev, 'right')
    const cells = switchCells(SLIDE_SWITCH_STAGE, 'a')

    expect(state.player).toEqual({ x: 1, y: 0 })
    for (let t = 0.5; t <= 1; t += 0.05) {
      expect(playerFrame(prev, state, events, t).level).toBeCloseTo(
        switchProgress(events, cells, true, t),
      )
    }
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

  it('미끄러지면 칸 수가 늘수록 연출이 길어진다', () => {
    const prev = createState(ICE_STAGE)
    const { events } = move(prev, 'right')

    expect(events.some((e) => e.type === 'slid')).toBe(true)
    expect(durationOf(events)).toBeGreaterThan(durationOf(slide('.#...').events))
    expect(durationOf(slide('.#...').events)).toBeGreaterThan(0.24)
  })

  it('미끄러지는 속도는 칸 수와 상관없이 같다', () => {
    expect(slideSeconds('.#...')).toBeCloseTo(slideSeconds('.###.') / 3, 2)
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

describe('playerFrame 눌림', () => {
  it('미끄러지지 않는 이동에서는 눌리지 않는다', () => {
    const prev = createState(STAGE)
    const { state, events } = move(prev, 'right')

    for (let t = 0; t <= 1; t += 0.05) {
      expect(playerFrame(prev, state, events, t).squash).toBe(0)
    }
  })

  it('미끄러지는 동안 눌리고 시작과 끝에서는 평소 모양이다', () => {
    const prev = createState(ICE_STAGE)
    const { state, events } = move(prev, 'right')
    let deepest = 0
    for (let t = 0; t <= 1; t += 0.02) {
      deepest = Math.max(deepest, playerFrame(prev, state, events, t).squash)
    }

    expect(deepest).toBeGreaterThan(0)
    expect(deepest).toBeLessThanOrEqual(1)
    expect(playerFrame(prev, state, events, 0).squash).toBe(0)
    expect(playerFrame(prev, state, events, 1).squash).toBe(0)
  })

  it('여러 칸을 미끄러지는 동안 중간에 풀렸다 다시 눌리지 않는다', () => {
    const prev = createState(ICE_STAGE)
    const { state, events } = move(prev, 'right')
    let last = 0
    let released = false
    for (let t = 0; t <= 1; t += 0.02) {
      const { squash } = playerFrame(prev, state, events, t)
      if (squash < last) released = true
      if (released) expect(squash).toBeLessThanOrEqual(last)
      last = squash
    }

    expect(released).toBe(true)
  })
})

describe('frostAt', () => {
  const slidEvents = () => move(createState(ICE_STAGE), 'right').events

  it('미끄러지지 않는 이동은 자국을 남기지 않는다', () => {
    const { events } = move(createState(STAGE), 'right')

    expect(frostAt(events, { x: 1, y: 0 }, 0.5)).toBe(0)
  })

  it('미끄러짐이 끝나는 칸에는 자국을 두지 않는다', () => {
    const events = slidEvents()

    for (let t = 0; t <= 1; t += 0.05) {
      expect(frostAt(events, { x: 4, y: 0 }, t)).toBe(0)
    }
  })

  it('아직 지나지 않은 칸에는 자국이 없다', () => {
    expect(frostAt(slidEvents(), { x: 3, y: 0 }, 0)).toBe(0)
  })

  it('자국이 함께 보이는 동안에는 먼저 지나온 칸이 더 옅다', () => {
    const events = slidEvents()
    let together = 0
    for (let t = 0; t <= 1; t += 0.02) {
      const early = frostAt(events, { x: 1, y: 0 }, t)
      const late = frostAt(events, { x: 2, y: 0 }, t)
      if (early > 0 && late > 0) {
        expect(early).toBeLessThan(late)
        together += 1
      }
    }

    expect(together).toBeGreaterThan(0)
  })

  it('자국은 진해졌다 옅어지고 연출이 끝나면 남지 않는다', () => {
    const events = slidEvents()
    let last = 0
    let fading = false
    for (let t = 0; t <= 1; t += 0.02) {
      const frost = frostAt(events, { x: 1, y: 0 }, t)
      if (frost < last) fading = true
      if (fading) expect(frost).toBeLessThanOrEqual(last)
      expect(frost).toBeLessThanOrEqual(1)
      last = frost
    }

    expect(fading).toBe(true)
    expect(frostAt(events, { x: 1, y: 0 }, 1)).toBe(0)
  })

  it('미끄러진 상자도 지나온 칸에 자국을 남긴다', () => {
    const stage: Stage = {
      ...ICE_STAGE,
      heights: [[0, 0, 0, 0, 0, 0, 0]],
      ice: ['..###..'],
      goal: { x: 6, y: 0 },
      entities: [{ type: 'box', x: 1, y: 0 }],
    }
    const { events } = move(createState(stage), 'right')
    let deepest = 0
    for (let t = 0; t <= 1; t += 0.02) {
      deepest = Math.max(deepest, frostAt(events, { x: 3, y: 0 }, t))
    }

    expect(deepest).toBeGreaterThan(0)
  })
})

// 얼음을 타고 여러 칸 미끄러져 사다리가 놓인 칸에 멈춘다
const LADDER_ICE_STAGE: Stage = {
  version: 1,
  id: 'test-ladder-ice',
  name: '미끄러지는 사다리',
  heights: [[0, 0, 0, 0, 0, 0]],
  ice: ['.###..'],
  start: { x: 0, y: 0 },
  goal: { x: 5, y: 0 },
  entities: [{ type: 'ladder', x: 4, y: 0 }],
}

describe('pickUpProgress', () => {
  const slideToLadder = () => {
    const prev = createState(LADDER_ICE_STAGE)
    return { prev, ...move(prev, 'right') }
  }

  it('미끄러져 도착하기 전에는 사다리가 그대로다', () => {
    const { prev, state, events } = slideToLadder()

    expect(state.carrying).toBe(true)
    for (let t = 0; t <= 1; t += 0.02) {
      if (playerFrame(prev, state, events, t).x < state.player.x) {
        expect(pickUpProgress(events, t)).toBe(0)
      }
    }
  })

  it('도착한 뒤에 사라지기 시작해 이동이 끝나면 다 사라진다', () => {
    const { prev, state, events } = slideToLadder()
    let started = 0
    let last = 0
    for (let t = 0; t <= 1; t += 0.02) {
      const progress = pickUpProgress(events, t)
      expect(progress).toBeGreaterThanOrEqual(last)
      if (progress > 0 && started === 0) started = t
      last = progress
    }

    expect(playerFrame(prev, state, events, started).x).toBeCloseTo(state.player.x)
    expect(pickUpProgress(events, 1)).toBeCloseTo(1)
  })

  it('사다리가 없는 이동은 값이 그대로다', () => {
    const bare: Stage = { ...LADDER_ICE_STAGE, entities: [] }
    const { events } = move(createState(bare), 'right')

    expect(pickUpProgress(events, 0.3)).toBeCloseTo(0.3)
    expect(durationOf(events)).toBeLessThan(durationOf(slideToLadder().events))
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
