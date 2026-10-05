import { describe, expect, it } from 'vitest'

import { playerFrame } from './cubeFrame'
import { swampTime } from './swampFrame'
import {
  CHAIN_STAGE,
  DRY_STAGE,
  HOP_STAGE,
  ICE_STAGE,
  PLANT,
  PLUG_STAGE,
  RIDE,
  SEED_STAGE,
  STAGE,
  STONE_STAGE,
  TRAM_STAGE,
  WARP_STAGE,
  WHIRL_STAGE,
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
import {
  FLOAT_RISE,
  FREEZE_SECONDS,
  MELT_SECONDS,
  PLUG,
  PULL_SECONDS,
  SECONDS,
  countDisplay,
  durationOf,
  moveSeconds,
  plugStart,
  pullStart,
  riseProgress,
  stepProgress,
} from './timeFrame'
import { createState, move } from '@/game/rules'
import type { GameEvent, Stage } from '@/game/types'

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

describe('countDisplay', () => {
  const prevGame = createState(STAGE)
  const { state: game, events } = move(prevGame, 'right')
  const count = (state: typeof game) => state.moves * 2
  const at = () => [0.1, 0.2]
  const view = { game, prevGame, events, animating: true, passed: 0 }

  it('연출 중에는 지난 순간 수만큼만 다음 숫자로 다가간다', () => {
    expect(countDisplay(view, count, at)).toEqual({ at: [0.1, 0.2], count: 0 })
    expect(countDisplay({ ...view, passed: 1 }, count, at).count).toBe(1)
    expect(countDisplay({ ...view, passed: 2 }, count, at).count).toBe(2)
  })

  it('연출이 끝났거나 앞 상태가 없으면 지금 숫자다', () => {
    expect(countDisplay({ ...view, animating: false }, count, at)).toEqual({ at: [], count: 2 })
    expect(countDisplay({ ...view, prevGame: null }, count, at)).toEqual({ at: [], count: 2 })
  })

  it('판이 없거나 숫자가 없는 판이면 null이다', () => {
    expect(countDisplay({ ...view, game: null }, count, at)).toEqual({ at: [], count: null })
    expect(countDisplay(view, () => null, at)).toEqual({ at: [], count: null })
  })
})

const pulledOf = (events: GameEvent[]) =>
  events.filter((e): e is Extract<GameEvent, { type: 'pulled' }> => e.type === 'pulled')

describe('pullStart', () => {
  it('땅 위를 걷는 수에 끌린 배는 처음부터 가고 연출 시간은 끌리는 시간이다', () => {
    const { events } = lastMove(WHIRL_STAGE, ['left'])

    expect(pulledOf(events).map((e) => pullStart(events, e))).toEqual([0, 0])
    expect(durationOf(events)).toBeCloseTo(PULL_SECONDS)
  })

  it('큐브가 내린 배와 그 뒤에 붙은 배는 큐브가 반쯤 굴러 나간 뒤 같이 출발한다', () => {
    const { events } = lastMove(WHIRL_STAGE, ['down', 'up'])

    expect(pulledOf(events).map((e) => pullStart(events, e))).toEqual([0.12, 0.12])
    expect(durationOf(events)).toBeCloseTo(0.12 + PULL_SECONDS)
  })

  it('이 수에 띄운 배는 물 칸 위로 다 밀려 온 뒤 출발하고 앞의 배들은 처음부터 간다', () => {
    const { events } = lastMove({ ...WHIRL_STAGE, start: { x: 5, y: 3 } }, ['up'])

    expect(pulledOf(events).map((e) => pullStart(events, e))).toEqual([0, 0, 0.3])
    expect(durationOf(events)).toBeCloseTo(0.3 + PULL_SECONDS)
  })
})

describe('plugStart', () => {
  it('마개 수는 밀기 시작부터 막히기까지 제 시간을 더한다', () => {
    const { events } = lastMove(PLUG_STAGE, ['down'])

    expect(plugStart(events)).toBe(0)
    expect(durationOf(events)).toBeCloseTo(PLUG.push + PLUG.suck + PLUG.close)
  })

  it('막지 않는 수는 null이다', () => {
    expect(plugStart(lastMove(WHIRL_STAGE, ['left']).events)).toBeNull()
  })
})

describe('durationOf 얼음 돌', () => {
  it('얼음 돌을 미는 길은 상자를 미는 길과 같은 시간이고 얼음이 바뀌면 덮이는 시간까지, 물로 들어가면 수면에 닿은 뒤 덮이는 시간까지 이어진다', () => {
    const land = lastMove(
      { ...STONE_STAGE, start: { x: 0, y: 1 }, entities: [{ type: 'iceStone', x: 1, y: 1 }] },
      ['right'],
    )
    const floated = lastMove(STONE_STAGE, ['down'])

    expect(durationOf(land.events)).toBeCloseTo(Math.max(SECONDS.pushed, FREEZE_SECONDS))
    expect(durationOf(floated.events)).toBeCloseTo(SECONDS.floated * FLOAT_RISE + FREEZE_SECONDS)
  })

  it('녹아 사라지는 수는 이동 몫이 끝난 뒤 녹는 시간을 더한다', () => {
    const { events } = lastMove({ ...STONE_STAGE, rules: { melt: 1 } }, ['down', 'left'])

    expect(events).toContainEqual({ type: 'melted', at: { x: 2, y: 2 } })
    expect(durationOf(events)).toBeCloseTo(moveSeconds(events, { lead: 0, tail: 0 }) + MELT_SECONDS)
    expect(
      stepProgress(events, moveSeconds(events, { lead: 0, tail: 0 }) / durationOf(events)),
    ).toBe(1)
  })
})

describe('pullStart 얼음 돌', () => {
  // (4,2) 소용돌이가 왼쪽 줄을 끄는 판, (2,1) 돌을 아래로 띄우면 같은 수에 한 칸 끌림
  const WHIRL_STONE: Stage = {
    ...STONE_STAGE,
    entities: [
      { type: 'whirlpool', x: 4, y: 2 },
      { type: 'iceStone', x: 2, y: 1 },
    ],
  }

  it('이 수에 띄운 돌은 물 위로 다 밀려 온 뒤 끌리기 시작한다', () => {
    const { events } = lastMove(WHIRL_STONE, ['down'])
    const pulled = events.find((e) => e.type === 'stonePulled')

    expect(pulled).toEqual({ type: 'stonePulled', from: { x: 2, y: 2 }, to: { x: 3, y: 2 } })
    expect(pullStart(events, pulled!)).toBeCloseTo(SECONDS.floated * 0.5)
    expect(durationOf(events)).toBeCloseTo(SECONDS.floated * 0.5 + PULL_SECONDS)
  })
})
