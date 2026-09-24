import { describe, expect, it } from 'vitest'

import {
  boxSink,
  crackFrame,
  crackSink,
  crackThickness,
  durationOf,
  frostAt,
  moveEase,
  movingBox,
  pickUpProgress,
  playerFrame,
  pressProgress,
  restartDrop,
  restartDuration,
  swampFrame,
  swampTime,
  switchCells,
  switchProgress,
  tramProgress,
} from './frame'
import { TILE } from '@/game/iso'
import { createState, move } from '@/game/rules'
import type { Point, Stage } from '@/game/types'

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

  // 재시작은 앞 상태를 넘기지 않아야 처음 자리에 내려앉는다. 넘기면 떠나기 전 칸에 서 있는 프레임이 나온다
  it('앞 상태가 없으면 이동 이벤트가 없어도 새 상태의 자리에 선다', () => {
    const start = createState(STAGE)
    const moved = move(start, 'right').state

    expect(playerFrame(null, start, [], 0.3)).toMatchObject({ x: 0, y: 0, level: 1 })
    expect(playerFrame(moved, start, [], 0.3)).toMatchObject({ x: 1, y: 0 })
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

// 한 칸 걸어 들어간 짝 칸에서 저쪽 짝 칸으로 옮겨 선다
const WARP_STAGE: Stage = {
  version: 1,
  id: 'test-warp',
  name: '짝 칸',
  heights: [[0, 0, 0, 0, 0]],
  start: { x: 0, y: 0 },
  goal: { x: 4, y: 0 },
  entities: [
    { type: 'warp', x: 1, y: 0, id: 'a' },
    { type: 'warp', x: 3, y: 0, id: 'a' },
  ],
}

describe('durationOf 순간이동', () => {
  it('순간이동하는 이동이 같은 길이의 보통 이동보다 길다', () => {
    const bare: Stage = { ...WARP_STAGE, entities: [] }
    const { events } = move(createState(WARP_STAGE), 'right')

    expect(durationOf(events)).toBeGreaterThan(durationOf(move(createState(bare), 'right').events))
  })
})

describe('playerFrame 순간이동', () => {
  const entry = { x: 1, y: 0 }
  const exit = { x: 3, y: 0 }
  const warp = () => {
    const prev = createState(WARP_STAGE)
    return { prev, ...move(prev, 'right') }
  }

  it('들어간 칸에 있다가 나온 칸으로 옮겨간다', () => {
    const { prev, state, events } = warp()
    let warped = false
    for (let t = 0; t <= 1; t += 0.01) {
      const { cell } = playerFrame(prev, state, events, t)
      if (cell.x === exit.x) warped = true
      expect(cell).toEqual(warped ? exit : entry)
    }

    expect(warped).toBe(true)
  })

  it('도중에 안 보이게 흐려졌다가 다시 또렷해진다', () => {
    const { prev, state, events } = warp()
    let faintest = 1
    for (let t = 0; t <= 1; t += 0.005) {
      faintest = Math.min(faintest, playerFrame(prev, state, events, t).fade)
    }

    expect(faintest).toBeLessThan(0.05)
    expect(playerFrame(prev, state, events, 1).fade).toBe(1)
  })

  it('들어간 칸에서 가라앉는다', () => {
    const { prev, state, events } = warp()
    let last = Infinity
    let sinking = 0
    for (let t = 0; t <= 1; t += 0.01) {
      const { cell, level, fade } = playerFrame(prev, state, events, t)
      if (cell.x !== entry.x || fade === 1) continue
      expect(level).toBeLessThan(last)
      last = level
      sinking += 1
    }

    expect(sinking).toBeGreaterThan(1)
  })

  it('나온 칸에서 솟아오른다', () => {
    const { prev, state, events } = warp()
    let last = -Infinity
    let rising = 0
    for (let t = 0; t <= 1; t += 0.01) {
      const { cell, level } = playerFrame(prev, state, events, t)
      if (cell.x !== exit.x) continue
      expect(level).toBeGreaterThan(last)
      last = level
      rising += 1
    }

    expect(rising).toBeGreaterThan(1)
  })

  it('끝나면 나온 칸에 또렷하게 서 있다', () => {
    const { prev, state, events } = warp()

    expect(playerFrame(prev, state, events, 1)).toMatchObject({
      x: 3,
      y: 0,
      level: 0,
      cell: exit,
      fade: 1,
    })
  })

  it('순간이동이 없는 이동에서는 내내 또렷하다', () => {
    const prev = createState(STAGE)
    const { state, events } = move(prev, 'right')

    for (let t = 0; t <= 1; t += 0.05) {
      expect(playerFrame(prev, state, events, t).fade).toBe(1)
    }
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

const TRAM_CELLS: Point[] = [
  { x: 1, y: 1 },
  { x: 2, y: 1 },
  { x: 3, y: 1 },
]

const TRAM_STAGE: Stage = {
  version: 1,
  id: 'test-tram',
  name: '움직이는 발판',
  heights: [
    [0, 0, 0, 0, 0, 0],
    [0, -1, -1, -1, 0, 0],
    [0, 0, 0, 0, 0, 0],
  ],
  start: { x: 0, y: 1 },
  goal: { x: 5, y: 2 },
  entities: [{ type: 'tram', x: 1, y: 1, id: 'tram-a', level: 0, cells: TRAM_CELLS, dir: 1 }],
}

// 상자를 발판 위로 밀어 넣는 판
const PUSH_TRAM_STAGE: Stage = {
  ...TRAM_STAGE,
  start: { x: 5, y: 1 },
  entities: [
    { type: 'tram', x: 3, y: 1, id: 'tram-a', level: 0, cells: TRAM_CELLS, dir: 1 },
    { type: 'box', x: 4, y: 1 },
  ],
}

// 발판에 실린 상자를 구덩이로 밀어 넣는 판
const DROP_TRAM_STAGE: Stage = {
  ...TRAM_STAGE,
  heights: [
    [0, 0, 0, 0, 0, 0],
    [0, -1, -1, -1, 0, 0],
    [0, 0, -1, 0, 0, 0],
  ],
  start: { x: 2, y: 0 },
  entities: [
    { type: 'tram', x: 2, y: 1, id: 'tram-a', level: 0, cells: TRAM_CELLS, dir: 1 },
    { type: 'box', x: 2, y: 1 },
  ],
}

const WALK = durationOf([{ type: 'moved', from: { x: 0, y: 0 }, to: { x: 1, y: 0 } }])

const board = () => {
  const prev = createState(TRAM_STAGE)
  return { prev, ...move(prev, 'right') }
}

const ride = () => {
  const prev = move(createState(TRAM_STAGE), 'right').state
  return { prev, ...move(prev, 'right') }
}

describe('durationOf 움직이는 발판', () => {
  it('발판만 가는 이동은 한 칸 걷는 이동과 길이가 같다', () => {
    const { events } = ride()

    expect(events.every((e) => e.type === 'tram')).toBe(true)
    expect(durationOf(events)).toBe(WALK)
  })

  it('옆에서 걷기만 하는 이동은 발판 때문에 길어지지 않는다', () => {
    const { events } = move(createState(TRAM_STAGE), 'down')

    expect(events.some((e) => e.type === 'tram')).toBe(true)
    expect(durationOf(events)).toBe(WALK)
  })

  it('올라타는 이동은 걷기와 발판 가기를 이어 붙인 길이다', () => {
    const { events } = board()

    expect(durationOf(events)).toBeGreaterThan(WALK)
    expect(durationOf(events)).toBeCloseTo(WALK + durationOf(ride().events))
  })
})

describe('tramProgress', () => {
  it('되돌아가지 않고 끝에서 다 간다', () => {
    const { events } = ride()
    let last = 0

    for (let t = 0; t <= 1; t += 0.05) {
      const p = tramProgress(events, t)
      expect(p).toBeGreaterThanOrEqual(last)
      last = p
    }

    expect(tramProgress(events, 1)).toBe(1)
  })

  it('올라타는 이동에서는 큐브가 발판 칸에 앉은 뒤에 움직인다', () => {
    const { prev, state, events } = board()

    for (let t = 0; t <= 1; t += 0.02) {
      if (tramProgress(events, t) > 0) {
        expect(playerFrame(prev, state, events, t).x).toBeGreaterThanOrEqual(1)
      }
    }
  })

  it('발판이 가지 않는 이동은 1이다', () => {
    expect(tramProgress([{ type: 'blocked', direction: 'left' }], 0.5)).toBe(1)
  })
})

describe('playerFrame 발판에 실려 가기', () => {
  it('발판 위에서 막힌 이동은 발판과 같은 자리를 따라간다', () => {
    const { prev, state, events } = ride()

    expect(prev.player).toEqual({ x: 2, y: 1 })
    expect(state.player).toEqual({ x: 3, y: 1 })
    for (let t = 0; t <= 1; t += 0.05) {
      expect(playerFrame(prev, state, events, t).x).toBeCloseTo(2 + tramProgress(events, t))
    }
  })

  it('실려 가는 동안 구르지 않고 높이도 그대로다', () => {
    const { prev, state, events } = ride()

    for (let t = 0; t <= 1; t += 0.05) {
      expect(playerFrame(prev, state, events, t)).toMatchObject({ angle: 0, level: 0, y: 1 })
    }
  })

  it('올라타는 이동은 걸어 든 칸에서 실려 간 칸까지 이어서 간다', () => {
    const { prev, state, events } = board()
    let last = playerFrame(prev, state, events, 0).x

    expect(last).toBeCloseTo(0)
    for (let t = 0.05; t <= 1; t += 0.05) {
      const { x } = playerFrame(prev, state, events, t)
      expect(x).toBeGreaterThanOrEqual(last)
      last = x
    }

    expect(state.player).toEqual({ x: 2, y: 1 })
    expect(playerFrame(prev, state, events, 1)).toMatchObject({ x: 2, y: 1 })
  })

  it('발판에서 내리는 이동은 발판을 따라가지 않는다', () => {
    const prev = move(createState(TRAM_STAGE), 'right').state
    const { state, events } = move(prev, 'up')

    expect(state.player).toEqual({ x: 2, y: 0 })
    expect(playerFrame(prev, state, events, 0.5)).toMatchObject({ x: 2, y: 0.5 })
  })
})

describe('movingBox 발판에 실려 가기', () => {
  it('밀려서 올라탄 상자는 발판이 멈출 때까지 이어서 간다', () => {
    const prev = createState(PUSH_TRAM_STAGE)
    const { state, events } = move(prev, 'left')
    let last = 4

    expect(state.boxes).toEqual([{ x: 2, y: 1 }])
    for (let t = 0; t < 1; t += 0.02) {
      const frame = movingBox(prev, state, events, t)
      expect(frame).not.toBeNull()
      expect(frame?.x ?? 0).toBeLessThanOrEqual(last)
      expect(frame).toMatchObject({ level: 0, to: { x: 2, y: 1 } })
      last = frame?.x ?? 0
    }

    expect(movingBox(prev, state, events, 0.999)?.x).toBeCloseTo(2, 1)
    expect(movingBox(prev, state, events, 1)).toBeNull()
  })

  it('발판이 가는 동안에는 상자가 밀린 칸을 지나 발판을 따라간다', () => {
    const prev = createState(PUSH_TRAM_STAGE)
    const { state, events } = move(prev, 'left')

    for (let t = 0; t < 1; t += 0.02) {
      const p = tramProgress(events, t)
      if (p > 0) expect(movingBox(prev, state, events, t)?.x).toBeCloseTo(3 - p)
    }
  })
})

describe('movingBox 발판에서 구덩이로', () => {
  const drop = () => {
    const prev = createState(DROP_TRAM_STAGE)
    return { prev, ...move(prev, 'down') }
  }

  it('발판 위의 상자는 발판 높이에서 출발한다', () => {
    const { prev, state, events } = drop()

    expect(state.heights[2][2]).toBe(0)
    expect(movingBox(prev, state, events, 0)).toMatchObject({ x: 2, y: 1, level: 0 })
  })

  it('메우는 상자는 한 층만 내려가고 바닥 아래로 꺼지지 않는다', () => {
    const { prev, state, events } = drop()
    let last = 0

    for (let t = 0; t <= 1; t += 0.02) {
      const frame = movingBox(prev, state, events, t)
      if (!frame) continue
      expect(frame.level).toBeLessThanOrEqual(last + 1e-9)
      expect(frame.level).toBeGreaterThanOrEqual(-1)
      last = frame.level
    }
  })
})

const SWAMP_STAGE: Stage = {
  version: 1,
  id: 'test-swamp',
  name: '늪',
  heights: [[0, 0, 0, 0, 0]],
  swamp: ['..#..'],
  start: { x: 1, y: 0 },
  goal: { x: 4, y: 0 },
  entities: [],
}

// 늪 옆에 선 큐브가 상자를 늪으로 밀어 넣는 판
const SINK_STAGE: Stage = {
  ...SWAMP_STAGE,
  start: { x: 0, y: 0 },
  entities: [{ type: 'box', x: 1, y: 0 }],
}

const enterSwamp = () => {
  const prev = createState(SWAMP_STAGE)
  return { prev, ...move(prev, 'right') }
}

const struggleSwamp = () => {
  const prev = enterSwamp().state
  return { prev, ...move(prev, 'right') }
}

const leaveSwamp = () => {
  const prev = move(struggleSwamp().state, 'right').state
  return { prev, ...move(prev, 'right') }
}

const sinkBox = () => {
  const prev = createState(SINK_STAGE)
  return { prev, ...move(prev, 'right') }
}

// 늪만 없는 같은 판. 상자 밀기가 늪 때문에 달라지지 않았는지 재는 잣대다
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

describe('durationOf 늪', () => {
  it('늪이 없는 판은 지금까지와 길이가 같다', () => {
    const prev = createState(STAGE)
    const { state, events } = move(prev, 'right')

    expect(swampTime(prev, state)).toEqual({ lead: 0, tail: 0 })
    expect(durationOf(events, swampTime(prev, state))).toBe(durationOf(events))
    expect(durationOf(events)).toBe(WALK)
  })

  it('늪에 들어가는 이동은 걷고 나서 가라앉는 만큼 길다', () => {
    const { prev, state, events } = enterSwamp()

    expect(swampTime(prev, state).lead).toBe(0)
    expect(durationOf(events, swampTime(prev, state))).toBeGreaterThan(WALK)
  })

  it('버둥거리는 이동은 제자리라도 연출 시간이 있다', () => {
    const { prev, state, events } = struggleSwamp()

    expect(events).toEqual([{ type: 'struggled', at: { x: 2, y: 0 } }])
    expect(swampTime(prev, state)).toEqual({ lead: 0, tail: 0 })
    expect(durationOf(events)).toBeGreaterThan(0)
  })

  it('늪에서 나오는 이동은 뽑혀 나오기를 기다린 뒤 걷는다', () => {
    const { prev, state, events } = leaveSwamp()

    expect(swampTime(prev, state).lead).toBeGreaterThan(0)
    expect(durationOf(events, swampTime(prev, state))).toBeCloseTo(
      WALK + swampTime(prev, state).lead,
    )
  })

  it('상자가 가라앉는 이동은 밀기가 끝난 뒤까지 이어진다', () => {
    const { prev, state, events } = sinkBox()

    expect(events.some((e) => e.type === 'sank')).toBe(true)
    expect(durationOf(events, swampTime(prev, state))).toBeGreaterThan(WALK)
  })
})

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
    expect(swampFrame(prev, state, events, 1)).toMatchObject({ stage: 0, deep: 1 })
    expect(swamp.tail).toBeGreaterThan(0)
  })

  it('버둥은 다음 단계보다 더 솟았다가 그 단계에서 멈춘다', () => {
    const { prev, state, events } = struggleSwamp()
    let highest = 0

    for (let t = 0; t <= 1; t += 0.02) {
      const frame = swampFrame(prev, state, events, t)
      expect(frame?.deep).toBe(1)
      highest = Math.max(highest, frame?.stage ?? 0)
    }

    expect(swampFrame(prev, state, events, 0)?.stage).toBeCloseTo(0)
    expect(highest).toBeGreaterThan(1)
    expect(swampFrame(prev, state, events, 1)?.stage).toBeCloseTo(1)
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

    expect(swampFrame(null, state, [], 1)).toMatchObject({ stage: 1, deep: 1 })
  })

  it('늪이 없는 판은 잠긴 큐브가 없다', () => {
    const prev = createState(STAGE)
    const { state, events } = move(prev, 'right')

    expect(swampFrame(prev, state, events, 0.5)).toBeNull()
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

describe('playerFrame 늪', () => {
  it('가라앉는 동안에는 들어간 칸에 그린다', () => {
    const prev = move(createState({ ...SWAMP_STAGE, start: { x: 4, y: 0 } }), 'left').state
    const { state, events } = move(prev, 'left')

    expect(state.player).toEqual({ x: 2, y: 0 })
    for (let t = 0; t <= 1; t += 0.02) {
      const frame = swampFrame(prev, state, events, t)
      if (frame && frame.deep > 0) {
        expect(playerFrame(prev, state, events, t).cell).toEqual({ x: 2, y: 0 })
      }
    }
  })

  it('뽑혀 나오는 동안에는 떠나기 전 칸에 그린다', () => {
    const { prev, state, events } = leaveSwamp()

    expect(playerFrame(prev, state, events, 0).cell).toEqual({ x: 2, y: 0 })
  })
})
