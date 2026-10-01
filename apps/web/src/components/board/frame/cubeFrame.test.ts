import { describe, expect, it } from 'vitest'

import { directionBetween, playerFrame } from './cubeFrame'
import { CAP_TOP_IDLE, MUSHROOM_STAND } from './mushroomFrame'
import { swampFrame } from './swampFrame'
import { switchCells, switchProgress } from './switchFrame'
import {
  CHAIN_STAGE,
  HOP_STAGE,
  ICE_STAGE,
  LIFT_STAGE,
  PLANT,
  RIDE,
  SEED_AT,
  SEED_STAGE,
  SLIDE_SWITCH_STAGE,
  STAGE,
  STAND_STAGE,
  SWAMP_STAGE,
  TRAM_STAGE,
  WARP_STAGE,
  board,
  gust,
  hop,
  lastMove,
  leaveSwamp,
  ride,
} from './testStages'
import { durationOf, riseProgress } from './timeFrame'
import { tramProgress } from './tramFrame'
import { TILE } from '@/game/iso'
import { createState, move } from '@/game/rules'
import type { GameState, Stage } from '@/game/types'

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

// 한 층 위에서 떨어지며 버섯을 밟는다
const FALL_HOP_STAGE: Stage = {
  ...HOP_STAGE,
  heights: [[1, 0, 0, 0, 0, 0, 0]],
}

// 한 층 위에서 떨어지며 버섯에 올라선다. 착지 칸이 없어 뛰지 못한다
const FALL_STAND_STAGE: Stage = {
  ...HOP_STAGE,
  heights: [[1, 0, 0, -1, 0, 0, 0]],
}

describe('playerFrame 버섯', () => {
  it('포물선으로 떠올랐다 내려앉는다', () => {
    const { prev, state, events } = hop(HOP_STAGE)
    const lifts = []

    for (let t = 0; t <= 1; t += 0.05) lifts.push(playerFrame(prev, state, events, t).lift)

    expect(playerFrame(prev, state, events, 0).lift).toBe(0)
    expect(playerFrame(prev, state, events, 1).lift).toBe(0)
    // 한 층(30)보다 높이 떠야 벽을 넘는 것이 보인다
    expect(Math.max(...lifts)).toBeGreaterThan(TILE.layer)
  })

  it('두 층 벽은 한 층 벽보다 한 층만큼 더 높이 넘고 구덩이는 한 층 벽과 같다', () => {
    const peak = (stage: Stage) => {
      const { prev, state, events } = hop(stage)
      return Math.max(
        ...Array.from({ length: 201 }, (_, i) => playerFrame(prev, state, events, i / 200).lift),
      )
    }
    const low = peak(HOP_STAGE)

    expect(peak({ ...HOP_STAGE, heights: [[0, 0, 2, 0, 0, 0, 0]] }) - low).toBeCloseTo(
      TILE.layer,
      -1,
    )
    expect(peak({ ...HOP_STAGE, heights: [[0, 0, -1, 0, 0, 0, 0]] })).toBeCloseTo(low)
  })

  it('갓으로 걸어 들어가는 한 칸은 구르고 날아가는 동안은 안 구른다', () => {
    const { prev, state, events } = hop(HOP_STAGE)
    const angleAt = (t: number) => playerFrame(prev, state, events, t).angle
    const angles = Array.from({ length: 101 }, (_, i) => angleAt(i / 100))
    const last = angles.length - 1 - [...angles].reverse().findIndex((a) => a > 0)

    expect(angleAt(0)).toBe(0)
    // 구르는 것은 처음 한 번뿐이고 갓에 올라선 뒤로는 멈춘다
    for (let i = 1; i <= last; i += 1) expect(angles[i]).toBeGreaterThan(angles[i - 1])
    expect(angles.slice(last + 1).every((a) => a === 0)).toBe(true)
    // 갓에 닿기 직전에는 거의 다 돌아 있고, 그 지점은 이동의 앞부분이다
    expect(angles[last]).toBeGreaterThan((Math.PI / 2) * 0.8)
    expect(last).toBeLessThan(40)
  })

  it('갓 위에서 출발하면 걸어 들어가는 칸이 없어 구르지 않는다', () => {
    // 두 칸 뜀은 이미 갓에 올라선 채로 시작한다
    const { prev, state, events } = hop({ ...HOP_STAGE, mushroom: ['#......'] })

    expect(state.player).toEqual({ x: 2, y: 0 })
    for (let t = 0; t <= 1; t += 0.05) expect(playerFrame(prev, state, events, t).angle).toBe(0)
  })

  it('한 층 위에서 떨어져 밟아도 갓에 닿을 때는 평지와 같은 자리다', () => {
    const flat = hop(HOP_STAGE)
    const fell = hop(FALL_HOP_STAGE)
    // 갓을 딛기 전에 내려앉는다. 그러지 않으면 큐브가 한 층 떠서 갓과 벌어진다
    const above = (r: ReturnType<typeof hop>, t: number) =>
      playerFrame(r.prev, r.state, r.events, t).level * TILE.layer +
      playerFrame(r.prev, r.state, r.events, t).lift

    expect(above(fell, 0)).toBeCloseTo(TILE.layer)
    for (let t = 0.3; t <= 1; t += 0.05) expect(above(fell, t)).toBeCloseTo(above(flat, t))
  })

  it('착지 칸이 출발과 같은 높이여도 갓에 닿을 때는 붙는다', () => {
    // 상자 위에서 낮은 갓을 딛고 같은 높이 칸에 내린다. 떨어지는 것이 아니라 건너가는 수다
    const same: Stage = {
      ...HOP_STAGE,
      heights: [[1, 0, 0, 0, 1, 0, 0]],
      mushroom: ['..#....'],
      entities: [{ type: 'box', x: 1, y: 0 }],
    }
    const prev = move(createState(same), 'right').state
    const r = move(prev, 'right')

    expect(prev.player).toEqual({ x: 1, y: 0 })
    expect(r.events.some((e) => e.type === 'fell')).toBe(false)
    // 갓을 딛는 동안 큐브는 갓이 있는 칸의 높이에 내려서 있다
    for (let t = 0.3; t <= 0.5; t += 0.05) {
      const f = playerFrame(prev, r.state, r.events, t)
      expect(f.level).toBeCloseTo(0)
    }
  })

  it('갓으로 내려앉는 동안 도로 떠오르지 않는다', () => {
    const above = (r: ReturnType<typeof hop>, t: number) =>
      playerFrame(r.prev, r.state, r.events, t).level * TILE.layer +
      playerFrame(r.prev, r.state, r.events, t).lift

    // 가속하며 내리면 갓에 닿기 직전까지 떠 있다가 뚝 떨어진다
    for (const stage of [FALL_HOP_STAGE, FALL_STAND_STAGE]) {
      const r = hop(stage)
      const path = Array.from({ length: 31 }, (_, i) => above(r, i / 100))

      for (let i = 1; i < path.length; i += 1) expect(path[i]).toBeLessThanOrEqual(path[i - 1])
    }
  })

  it('상자 위에서 버섯으로 가도 갓에 닿을 때는 평지와 같은 자리다', () => {
    const onBox: Stage = {
      ...HOP_STAGE,
      heights: [[1, 0, 0, 0, 0, 0, 0]],
      mushroom: ['..#....'],
      entities: [{ type: 'box', x: 1, y: 0 }],
    }
    const flat = hop({
      ...onBox,
      heights: [[0, 0, 0, 0, 0, 0, 0]],
      entities: [],
      start: { x: 1, y: 0 },
    })
    const start = move(createState(onBox), 'right').state
    const stepped = move(start, 'right')
    const above = (prev: GameState, r: typeof stepped, t: number) =>
      playerFrame(prev, r.state, r.events, t).level * TILE.layer +
      playerFrame(prev, r.state, r.events, t).lift

    expect(start.player).toEqual({ x: 1, y: 0 })
    for (let t = 0.3; t <= 1; t += 0.05)
      expect(above(start, stepped, t)).toBeCloseTo(
        playerFrame(flat.prev, flat.state, flat.events, t).level * TILE.layer +
          playerFrame(flat.prev, flat.state, flat.events, t).lift,
      )
  })

  it('한 층 위에서 떨어져 올라서도 갓에 닿을 때는 평지와 같은 자리다', () => {
    const flat = hop({ ...FALL_STAND_STAGE, heights: [[0, 0, 0, -1, 0, 0, 0]] })
    const fell = hop(FALL_STAND_STAGE)
    const above = (r: ReturnType<typeof hop>, t: number) =>
      playerFrame(r.prev, r.state, r.events, t).level * TILE.layer +
      playerFrame(r.prev, r.state, r.events, t).lift

    expect(flat.state.player).toEqual({ x: 1, y: 0 })
    expect(fell.state.player).toEqual({ x: 1, y: 0 })
    for (let t = 0.6; t <= 1; t += 0.05) expect(above(fell, t)).toBeCloseTo(above(flat, t))
  })

  it('연쇄는 갓을 딛는 자리에서만 멈추고 뒤로 가지 않는다', () => {
    const { prev, state, events } = hop(CHAIN_STAGE)
    const xs = Array.from({ length: 201 }, (_, i) => playerFrame(prev, state, events, i / 200).x)

    for (let i = 1; i < xs.length; i += 1) expect(xs[i]).toBeGreaterThanOrEqual(xs[i - 1])
    // 멈춰 있는 프레임은 두 갓 자리에만 있다
    const held = [...new Set(xs.filter((x, i) => i > 0 && x === xs[i - 1]))]
    // 두 갓 자리(1, 3)뿐이고 사이 칸에서는 멈추지 않는다
    expect(held.sort((m, n) => m - n)).toEqual([1, 3])
    expect(playerFrame(prev, state, events, 1).x).toBe(5)
  })

  it('연쇄 중간 버섯에서는 눌린 갓을 딛고 지나간다', () => {
    const { prev, state, events } = hop(CHAIN_STAGE)
    const middle = Array.from({ length: 201 }, (_, i) => i / 200)
      .map((t) => playerFrame(prev, state, events, t))
      .reduce((best, frame) => (Math.abs(frame.x - 3) < Math.abs(best.x - 3) ? frame : best))

    // 바닥에 닿지 않고 갓 높이를 스쳐 지나간다
    expect(middle.lift).toBeGreaterThan(10)
    expect(middle.lift).toBeLessThan(TILE.layer)
  })

  it('못 뛰면 평소 높이 갓에 올라선 뒤 눌려 내려앉는다', () => {
    const { prev, state, events } = hop(STAND_STAGE)
    const lift = (t: number) => playerFrame(prev, state, events, t).lift

    expect(state.player).toEqual({ x: 1, y: 0 })
    expect(lift(0)).toBe(0)
    expect(lift(1)).toBe(MUSHROOM_STAND)
    // 다 올라서기 전에는 평소 높이 갓을 딛는다
    expect(lift(0.5)).toBeGreaterThan(MUSHROOM_STAND)
    // 튕겨 나갈 때처럼 갓보다 높이 떠오르지는 않는다
    for (let t = 0; t <= 1; t += 0.05) {
      expect(lift(t)).toBeLessThanOrEqual(CAP_TOP_IDLE)
    }
  })

  it('올라선 버섯에서 튕겨 나가면 눌린 갓 위에서 출발한다', () => {
    const stood = hop(STAND_STAGE).state
    const { state, events } = move(stood, 'down')

    expect(state.player).toEqual({ x: 1, y: 2 })
    expect(playerFrame(stood, state, events, 0).lift).toBe(MUSHROOM_STAND)
    expect(playerFrame(stood, state, events, 1).lift).toBe(0)
  })
})

describe('playerFrame 씨앗', () => {
  it('솟는 칸에 들어선 큐브는 이동이 끝난 뒤 칸과 같이 오른다', () => {
    const { prev, game, events } = lastMove(SEED_STAGE, RIDE)

    expect(playerFrame(prev, game, events, 0.4)).toMatchObject({ ...SEED_AT, level: 0 })
    expect(playerFrame(prev, game, events, 0.7).level).toBeCloseTo(riseProgress(events, 0.7))
    expect(playerFrame(prev, game, events, 0.7).cell).toEqual(SEED_AT)
    expect(playerFrame(prev, game, events, 1).level).toBe(1)
  })

  it('버섯에 튕겨 솟는 칸에 내려선 큐브도 내려선 뒤에 오른다', () => {
    const stage: Stage = {
      version: 1,
      id: 'test-seed-hop',
      heights: [[0, 0, 0, 0, 0, 0]],
      mushroom: ['.#....'],
      start: { x: 0, y: 0 },
      goal: { x: 5, y: 0 },
      entities: [],
    }
    const from: GameState = { ...createState(stage), planted: [{ x: 3, y: 0, left: 1, rises: 0 }] }
    const { prev, game, events } = lastMove(stage, ['right'], from)
    const landed = 1 - 0.36 / durationOf(events)

    expect(game.player).toEqual({ x: 3, y: 0 })
    expect(playerFrame(prev, game, events, landed).level).toBeCloseTo(0)
    expect(playerFrame(prev, game, events, 1).level).toBe(1)
  })
})

describe('playerFrame 심기', () => {
  it('심는 수에 큐브가 턱 쪽으로 기울었다가 돌아온다', () => {
    const { prev, game, events } = lastMove(SEED_STAGE, PLANT)

    expect(playerFrame(prev, game, events, 0).angle).toBe(0)
    expect(playerFrame(prev, game, events, 0.25)).toMatchObject({ direction: 'right', ...SEED_AT })
    expect(playerFrame(prev, game, events, 0.25).angle).toBeGreaterThan(0.2)
    expect(playerFrame(prev, game, events, 0.5).angle).toBeCloseTo(0)
    expect(playerFrame(prev, game, events, 1).angle).toBeCloseTo(0)
  })
})

describe('playerFrame 숨기', () => {
  it('바람 오는 쪽에 막힌 것이 있어 숨으면 기울지 않고 기대면 기운다', () => {
    const mid = (0.24 / 0.54 + 1) / 2
    const hidden = gust({ entities: [{ type: 'box', x: 4, y: 0 }] })
    const leaning = gust({
      heights: [
        [0, 0, 1, 0, 0],
        [0, 0, 0, 0, 0],
      ],
    })

    // 구르기를 마친 90도는 반듯하게 선 모습과 같다
    const tilt = (angle: number) => Math.abs(Math.sin(angle * 2))
    expect(tilt(playerFrame(hidden.prev, hidden.game, hidden.events, mid).angle)).toBeCloseTo(0)
    expect(
      tilt(playerFrame(leaning.prev, leaning.game, leaning.events, mid).angle),
    ).toBeGreaterThan(0.4)
  })
})

describe('playerFrame 바람', () => {
  it('내 이동이 끝난 뒤에 구르지 않고 바람 쪽으로 기울며 미끄러진다', () => {
    const { prev, game, events } = gust()
    const own = 0.24 / 0.54
    const mid = (own + 1) / 2

    expect(playerFrame(prev, game, events, own)).toMatchObject({ x: 3, y: 0 })
    expect(playerFrame(prev, game, events, own).angle).toBeCloseTo(0)
    expect(playerFrame(prev, game, events, mid).x).toBeGreaterThan(2)
    expect(playerFrame(prev, game, events, mid).x).toBeLessThan(3)
    expect(playerFrame(prev, game, events, mid)).toMatchObject({ direction: 'left' })
    expect(playerFrame(prev, game, events, mid).angle).toBeCloseTo(0.24)
    expect(playerFrame(prev, game, events, 0.999).angle).toBeLessThan(0.05)
  })

  it('버틸 때는 제자리에서 바람 쪽으로 기울었다 돌아온다', () => {
    const { prev, game, events } = gust({
      heights: [
        [0, 0, 1, 0, 0],
        [0, 0, 0, 0, 0],
      ],
    })
    const mid = (0.24 / 0.54 + 1) / 2

    expect(playerFrame(prev, game, events, mid)).toMatchObject({ x: 3, y: 0, direction: 'left' })
    expect(playerFrame(prev, game, events, mid).angle).toBeCloseTo(0.24)
    expect(playerFrame(prev, game, events, 0.999).angle).toBeLessThan(0.05)
  })

  it('밀려 떨어지는 칸은 미끄러진 뒤에 내려간다', () => {
    const { prev, game, events } = gust({
      heights: [
        [0, 0, 0, 1, 0],
        [0, 0, 0, 1, 0],
      ],
    })
    const at = (t: number) => playerFrame(prev, game, events, t)
    const total = durationOf(events)
    const own = 0.24 / total

    expect(at(own).level).toBeCloseTo(1)
    expect(at(own + 0.1 / total).level).toBeCloseTo(1)
    expect(at(1).level).toBe(0)
  })
})

describe('directionBetween', () => {
  it('두 칸 사이 방향을 돌려준다', () => {
    const at = { x: 1, y: 1 }

    expect(directionBetween(at, { x: 2, y: 1 })).toBe('right')
    expect(directionBetween(at, { x: 0, y: 1 })).toBe('left')
    expect(directionBetween(at, { x: 1, y: 2 })).toBe('down')
    expect(directionBetween(at, { x: 1, y: 0 })).toBe('up')
  })

  it('가로와 세로가 다 다르면 가로 방향을 먼저 본다', () => {
    expect(directionBetween({ x: 0, y: 0 }, { x: 1, y: 1 })).toBe('right')
  })
})
