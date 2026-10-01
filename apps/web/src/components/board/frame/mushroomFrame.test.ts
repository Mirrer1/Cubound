import { describe, expect, it } from 'vitest'

import { crackProgress } from './crackFrame'
import { playerFrame } from './cubeFrame'
import {
  CAP_TOP_IDLE,
  MUSHROOM_STAND,
  hopLift,
  hopProgress,
  mushroomFrames,
  mushroomPose,
} from './mushroomFrame'
import { swampFrame, swampTime } from './swampFrame'
import { DRY_STAGE, HOP_STAGE, STAGE, STAND_STAGE, gust, hop } from './testStages'
import { durationOf } from './timeFrame'
import { createState, move } from '@/game/rules'
import type { Stage } from '@/game/types'

describe('mushroomFrames', () => {
  it('버섯이 없는 판은 빈 목록이다', () => {
    const prev = createState(STAGE)
    const { state, events } = move(prev, 'right')

    expect(mushroomFrames(prev, state, events, 0.5)).toEqual([])
  })

  it('밟는 동안 갓이 눌렸다가 펴지고 돌아온다', () => {
    const { prev, state, events } = hop(HOP_STAGE)
    const presses = Array.from({ length: 101 }, (_, i) =>
      mushroomFrames(prev, state, events, i / 100).find((f) => f.cell.x === 1),
    ).map((f) => f?.press ?? 0)

    expect(presses[0]).toBe(0)
    expect(Math.max(...presses)).toBeGreaterThan(0.8)
    expect(Math.min(...presses)).toBeLessThan(-0.8)
    expect(presses[presses.length - 1]).toBe(0)
  })

  it('못 뛰어서 올라선 갓은 큐브가 다 올라선 뒤에 눌린다', () => {
    const { prev, state, events } = hop(STAND_STAGE)
    const at = (t: number) => mushroomFrames(prev, state, events, t)[0]

    expect(at(0).press).toBe(0)
    // 큐브가 걸어 들어오는 동안에는 평소 높이 그대로다
    expect(at(0.5).press).toBe(0)
    // 끝자락에서 눌리기 시작해 올라선 채로 끝난다
    expect(at(0.8).press).toBeGreaterThan(0)
    expect(at(0.8).press).toBeLessThan(2)
    expect(at(1).press).toBe(2)
  })

  it('밟힌 버섯은 큐브가 떠난 뒤에 시들고 지나간 순서대로 어긋난다', () => {
    const { prev, state, events } = hop(DRY_STAGE)
    const at = (t: number) => mushroomFrames(prev, state, events, t)
    const first = (t: number) => at(t).find((f) => f.cell.x === 1)!
    const second = (t: number) => at(t).find((f) => f.cell.x === 3)!

    expect(state.mushrooms).toEqual([])
    expect(first(0).wither).toBe(0)
    expect(second(0).wither).toBe(0)
    // 앞선 버섯이 먼저 시든다
    expect(first(0.6).wither).toBeGreaterThan(second(0.6).wither)
    expect(first(1).wither).toBe(1)
    expect(second(1).wither).toBe(1)
  })

  it('시드는 동안에도 갓이 먼저 눌렸다 펴진다', () => {
    const { prev, state, events } = hop(DRY_STAGE)
    const first = (t: number) => mushroomFrames(prev, state, events, t).find((f) => f.cell.x === 1)!
    const sprung = Array.from({ length: 101 }, (_, i) => first(i / 100)).find((f) => f.press < -0.5)

    expect(sprung).toBeDefined()
    expect(sprung!.wither).toBeLessThan(0.5)
  })
})

describe('mushroomPose', () => {
  it('눌리는 차례를 시안 값 그대로 돌려준다', () => {
    expect(mushroomPose(-1, 0)).toEqual({ stem: 18, cap: 0.44, thick: 6, crown: 3 })
    expect(mushroomPose(0, 0)).toEqual({ stem: 14, cap: 0.48, thick: 6, crown: 3 })
    expect(mushroomPose(1, 0)).toEqual({ stem: 9, cap: 0.54, thick: 5, crown: 2 })
    expect(mushroomPose(2, 0)).toEqual({ stem: 2, cap: 0.66, thick: 3, crown: 0 })
  })

  it('시드는 차례도 시안 값 그대로다', () => {
    expect(mushroomPose(0, 0.5)).toEqual({ stem: 8, cap: 0.5, thick: 4, crown: 2 })
    expect(mushroomPose(0, 1)).toEqual({ stem: 3, cap: 0.56, thick: 3, crown: 2 })
  })

  it('큐브가 올라선 높이는 눌린 갓 꼭대기다', () => {
    const pose = mushroomPose(2, 0)

    expect(pose.stem + pose.thick + pose.crown).toBe(MUSHROOM_STAND)
  })
})

describe('버섯과 다른 요소', () => {
  // 튕겨 날아가 늪에 내린다. 버섯 칸과 늪 칸은 겹치지 않는다
  const SWAMP_LANDING: Stage = {
    ...HOP_STAGE,
    heights: [[0, 0, 0, 0, 0, 0, 0]],
    swamp: ['...#...'],
  }

  it('늪에 착지하면 날아온 뒤에 가라앉는다', () => {
    const prev = createState(SWAMP_LANDING)
    const { state, events } = move(prev, 'right')
    const swamp = swampTime(prev, state)
    const dry = hop({ ...SWAMP_LANDING, swamp: undefined })

    expect(state.player).toEqual({ x: 3, y: 0 })
    expect(swamp.tail).toBeGreaterThan(0)
    // 가라앉는 시간이 뒤에 붙을 뿐 나는 시간은 그대로다
    expect(durationOf(events, swamp)).toBeCloseTo(durationOf(dry.events) + swamp.tail)
    expect(playerFrame(prev, state, events, 1)).toMatchObject({ x: 3, lift: 0 })
    expect(swampFrame(prev, state, events, 1)?.deep).toBe(1)
  })

  it('무너지는 칸에 착지하면 내려앉기 시작한 뒤에 닳는다', () => {
    const stage: Stage = {
      ...HOP_STAGE,
      heights: [[0, 0, 0, 0, 0, 0, 0]],
      cracks: ['...2...'],
    }
    const { events } = hop(stage)

    expect(crackProgress(events, 0.3)).toBe(0)
    expect(crackProgress(events, 1)).toBe(1)
  })
})

describe('버섯 갓에 머무는 차례', () => {
  const IDLE = mushroomPose(0, 0)
  const PRESSED = mushroomPose(1, 0)
  const SPRUNG = mushroomPose(-1, 0)
  const topOf = (pose: { stem: number; thick: number; crown: number }) =>
    pose.stem + pose.thick + pose.crown

  const trace = () => {
    const { prev, state, events } = hop(HOP_STAGE)
    return Array.from({ length: 401 }, (_, i) => i / 400).map((t) => ({
      t,
      x: playerFrame(prev, state, events, t).x,
      lift: playerFrame(prev, state, events, t).lift,
      press: mushroomFrames(prev, state, events, t).find((f) => f.cell.x === 1)!.press,
    }))
  }

  it('갓을 딛는 동안 큐브가 가로로 멈춰 있다', () => {
    const onCap = trace().filter((f) => f.x === 1)

    expect(onCap.length).toBeGreaterThan(20)
    // 올라선 첫 프레임은 갓이 아직 평소 높이다
    expect(onCap[0].press).toBeLessThan(0.05)
    expect(onCap[0].lift).toBeCloseTo(topOf(IDLE), 0)
    // 머무는 동안 다 눌렸다가 다 펴진다
    expect(Math.max(...onCap.map((f) => f.press))).toBeGreaterThan(0.99)
    expect(Math.min(...onCap.map((f) => f.press))).toBeLessThan(-0.99)
    // 날아가기 직전에는 다 펴져 있다
    expect(onCap[onCap.length - 1].press).toBeLessThan(-0.9)
  })

  it('올라섬 → 눌림 → 펴짐 → 날아감 차례로 일어난다', () => {
    const frames = trace()
    const firstAt = (hit: (f: (typeof frames)[number]) => boolean) =>
      frames.findIndex((f) => hit(f))
    const arrive = firstAt((f) => f.x === 1)
    const pressed = firstAt((f) => f.press >= 0.99)
    const sprung = firstAt((f) => f.press <= -0.99)
    const flying = firstAt((f) => f.x > 1)

    expect(arrive).toBeGreaterThan(0)
    expect(pressed).toBeGreaterThan(arrive)
    expect(sprung).toBeGreaterThan(pressed)
    expect(flying).toBeGreaterThan(sprung)
  })

  it('큐브가 갓을 따라 내려갔다 올라온 뒤에 날아오른다', () => {
    const onCap = trace().filter((f) => f.x === 1)
    const lifts = onCap.map((f) => f.lift)

    // 평소 갓에서 눌린 갓까지 내려갔다가 펴진 갓까지 올라온다
    expect(Math.min(...lifts)).toBeCloseTo(topOf(PRESSED), 0)
    expect(Math.max(...lifts)).toBeCloseTo(topOf(SPRUNG), 0)
    expect(lifts[0]).toBeGreaterThan(Math.min(...lifts))
    expect(lifts[lifts.length - 1]).toBeCloseTo(topOf(SPRUNG), 0)
  })
})

describe('hopProgress', () => {
  it('갓을 딛는 동안 간 칸 수가 멈춘다', () => {
    // 세 칸 뜀은 머무름까지 4칸이고 갓은 1칸째다
    expect(hopProgress(3, 0)).toBe(0)
    expect(hopProgress(3, 1 / 4) * 3).toBeCloseTo(1)
    expect(hopProgress(3, 1.5 / 4) * 3).toBeCloseTo(1)
    expect(hopProgress(3, 2 / 4) * 3).toBeCloseTo(1)
    expect(hopProgress(3, 3 / 4) * 3).toBeCloseTo(2)
    expect(hopProgress(3, 1)).toBe(1)
  })

  it('연쇄는 갓마다 한 번씩 멈춘다', () => {
    // 다섯 칸 연쇄는 머무름까지 7칸이고 갓은 1칸째와 3칸째다
    const held = Array.from({ length: 701 }, (_, i) => hopProgress(5, i / 700) * 5)
    const stops = new Set(held.filter((u, i) => i > 0 && u === held[i - 1]))

    expect([...stops].sort((a, b) => a - b)).toEqual([1, 3])
  })

  it('버섯 위에서 출발하면 눌리는 몫 없이 펴지기만 한다', () => {
    // 두 칸 뜀은 이미 눌린 갓에서 시작해 펴지는 0.45칸만 머문다
    expect(hopProgress(2, 0)).toBe(0)
    expect(hopProgress(2, 0.45 / 2.45) * 2).toBeCloseTo(0)
    expect(hopProgress(2, 1)).toBe(1)
  })
})

describe('mushroomFrames 바람', () => {
  it('밀려 버섯을 밟으면 걸어서 밟은 것처럼 갓이 눌렸다 튕긴다', () => {
    const { prev, game, events } = gust({ mushroom: ['..#..', '.....'] })
    const own = 0.24 / durationOf(events)
    const press = (t: number) =>
      mushroomFrames(prev, game, events, t).find((f) => f.cell.x === 2)?.press ?? 0
    const blown = Array.from({ length: 50 }, (_, i) => press(own + ((1 - own) * i) / 50))

    expect(game.player).toEqual({ x: 0, y: 0 })
    expect(press(own)).toBe(0)
    expect(Math.max(...blown)).toBeGreaterThan(0.5)
    expect(Math.min(...blown)).toBeLessThan(0)
  })
})

describe('hopLift', () => {
  it('걸어 들어가는 한 칸은 평소 갓 꼭대기까지 오른다', () => {
    expect(hopLift(3, 0, 0)).toBe(0)
    expect(hopLift(3, 0.5, 0)).toBeCloseTo(CAP_TOP_IDLE / 2)
    expect(hopLift(3, 1, 0)).toBeCloseTo(CAP_TOP_IDLE)
  })

  it('갓에 머무는 동안 눌렸다가 다 펴진 꼭대기에서 날아오른다', () => {
    expect(hopLift(3, 1.55, 0)).toBeCloseTo(16)
    expect(hopLift(3, 2, 0)).toBeCloseTo(27)
  })

  it('나는 동안 포물선 꼭대기를 지나 땅에 내린다', () => {
    expect(hopLift(3, 3, 0)).toBeCloseTo(45.5)
    expect(hopLift(3, 4, 0)).toBeCloseTo(0)
  })

  it('이미 올라서 있던 갓은 눌린 높이에서 시작한다', () => {
    expect(hopLift(2, 0, 0)).toBeCloseTo(MUSHROOM_STAND)
  })

  it('연쇄에서는 다음 갓에 평소 높이로 내려선다', () => {
    expect(hopLift(5, 4, 0)).toBeCloseTo(CAP_TOP_IDLE)
  })

  it('마지막에 갓 위에 내려서면 눌린 갓 높이에 선다', () => {
    expect(hopLift(3, 4, 5)).toBeCloseTo(MUSHROOM_STAND)
  })
})
