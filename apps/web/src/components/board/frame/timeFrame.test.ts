import { describe, expect, it } from 'vitest'

import { playerFrame } from './cubeFrame'
import { swampTime } from './swampFrame'
import {
  CHAIN_STAGE,
  DRY_STAGE,
  HOP_STAGE,
  ICE_STAGE,
  PLANT,
  RIDE,
  SEED_STAGE,
  STAGE,
  TRAM_STAGE,
  WARP_STAGE,
  board,
  enterSwamp,
  gust,
  hop,
  lastMove,
  leaveSwamp,
  ride,
  sinkBox,
  struggleSwamp,
} from './testStages'
import { durationOf, riseProgress, stepProgress } from './timeFrame'
import { createState, move } from '@/game/rules'
import type { Stage } from '@/game/types'

const slide = (ice: string) => {
  const prev = createState({ ...ICE_STAGE, ice: [ice] })
  return { prev, ...move(prev, 'right') }
}

// durationOf로 알 수 없는 큐브가 멈추는 때, 서리가 다 옅어질 때까지 이어지는 연출 탓
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

describe('durationOf 순간이동', () => {
  it('순간이동하는 이동이 같은 길이의 보통 이동보다 길다', () => {
    const bare: Stage = { ...WARP_STAGE, entities: [] }
    const { events } = move(createState(WARP_STAGE), 'right')

    expect(durationOf(events)).toBeGreaterThan(durationOf(move(createState(bare), 'right').events))
  })
})

const WALK = durationOf([{ type: 'moved', from: { x: 0, y: 0 }, to: { x: 1, y: 0 } }])

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

describe('durationOf 버섯', () => {
  it('간 칸 수와 갓에 머문 횟수만큼 길어진다', () => {
    const one = hop(HOP_STAGE)
    const two = hop(CHAIN_STAGE)

    expect(one.state.player).toEqual({ x: 3, y: 0 })
    expect(two.state.player).toEqual({ x: 5, y: 0 })
    // 세 칸과 머무름 한 번이 4, 다섯 칸과 머무름 두 번이 7
    expect(durationOf(two.events) / durationOf(one.events)).toBeCloseTo(7 / 4)
    expect(durationOf(two.events)).toBeGreaterThan(durationOf(one.events))
  })

  it('머무름이 없는 이동은 길이가 그대로다', () => {
    const prev = createState(STAGE)

    expect(durationOf(move(prev, 'right').events)).toBeCloseTo(0.24)
  })

  it('버섯이 없는 이동은 길이가 그대로다', () => {
    const prev = createState(STAGE)
    const { events } = move(prev, 'right')

    expect(durationOf(events)).toBeCloseTo(0.24)
  })

  it('시드는 것은 이동을 길게 만들지 않는다', () => {
    expect(durationOf(hop(DRY_STAGE).events)).toBeCloseTo(durationOf(hop(CHAIN_STAGE).events))
  })
})

describe('durationOf 씨앗', () => {
  it('심는 수는 턱에 부딪히고 씨앗이 떨어질 때까지 0.44초다', () => {
    const { events } = lastMove(SEED_STAGE, PLANT)

    expect(durationOf(events)).toBeCloseTo(0.44)
  })

  it('남은 수만 줄어드는 수는 늘어나지 않는다', () => {
    const { events } = lastMove(SEED_STAGE, [...PLANT, 'left'])

    expect(durationOf(events)).toBeCloseTo(0.24)
  })

  it('솟는 수에만 이동 뒤에 솟는 시간을 더한다', () => {
    const { events } = lastMove(SEED_STAGE, RIDE)

    expect(durationOf(events)).toBeCloseTo(0.24 + 0.36)
  })
})

describe('stepProgress', () => {
  it('솟는 수는 이동 몫이 끝날 때 1이 된다', () => {
    const { events } = lastMove(SEED_STAGE, RIDE)

    expect(stepProgress(events, 0.2)).toBeCloseTo(0.5)
    expect(stepProgress(events, 0.4)).toBeCloseTo(1)
    expect(stepProgress(events, 0.8)).toBe(1)
  })

  it('솟지 않는 수는 t 그대로다', () => {
    const { events } = lastMove(SEED_STAGE, [...PLANT, 'left'])

    expect(stepProgress(events, 0.3)).toBeCloseTo(0.3)
  })
})

describe('riseProgress', () => {
  it('이동이 끝난 뒤에 시작해 끝에서 1이 된다', () => {
    const { events } = lastMove(SEED_STAGE, RIDE)

    expect(riseProgress(events, 0)).toBe(0)
    expect(riseProgress(events, 0.4)).toBeCloseTo(0)
    expect(riseProgress(events, 0.7)).toBeGreaterThan(0)
    expect(riseProgress(events, 0.7)).toBeLessThan(1)
    expect(riseProgress(events, 1)).toBe(1)
  })

  it('처음과 끝에서 느려 튀지 않는다', () => {
    const { events } = lastMove(SEED_STAGE, RIDE)
    const at = (seconds: number) => riseProgress(events, (0.24 + seconds) / 0.6)

    expect(at(0.036)).toBeLessThan(0.05)
    expect(1 - at(0.324)).toBeLessThan(0.05)
  })
})

describe('durationOf 바람', () => {
  it('밀리는 한 칸과 버팀은 내 이동 연출 뒤에 제 시간을 더한다', () => {
    const blown = gust()
    const braced = gust({
      heights: [
        [0, 0, 1, 0, 0],
        [0, 0, 0, 0, 0],
      ],
    })

    expect(durationOf(blown.events)).toBeCloseTo(0.24 + 0.3)
    expect(durationOf(braced.events)).toBeCloseTo(0.24 + 0.3)
  })
})
