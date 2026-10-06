import { describe, expect, it } from 'vitest'

import { pullLanes } from '../view'
import { same } from './pathFrame'
import { PLUG_STAGE, WHIRL_STAGE, lastMove } from './testStages'
import { PLUG } from './timeFrame'
import { PULL_DIP, leanOf, plugPhase, pulledBeside, whirlFrames, whirlLook } from './whirlpoolFrame'
import { TILE, toScreen } from '@/game/iso'
import { createState, move } from '@/game/rules'
import type { Direction, GameState, Stage } from '@/game/types'

const frames = (stage = WHIRL_STAGE, keys: Direction[] = ['left'], t = 0.5) => {
  const { prev, game, events } = lastMove(stage, keys)
  return whirlFrames({ before: prev, game, events, t, moving: t < 1, dropping: false })
}

const played = (keys: Direction[], stage = WHIRL_STAGE) =>
  keys.reduce((state, d) => move(state, d).state, createState(stage))

const PLUG_TOTAL = PLUG.push + PLUG.suck + PLUG.close

describe('whirlFrames 끌린 배', () => {
  it('반쯤 간 배는 8px 더 잠겨 칸 사이에 있고 뒤로 물테 셋이 남는다', () => {
    const [near, far] = frames().boxes

    expect(near.to).toEqual({ x: 2, y: 1 })
    expect(near.x).toBeCloseTo(toScreen({ x: 2.5, y: 1 }, 0).x)
    expect(near.shown).toBe(0)
    expect(near.y).toBeCloseTo(toScreen({ x: 2.5, y: 1 }, 1).y + PULL_DIP)
    expect(near.wake).toHaveLength(3)
    expect(near.wake[0].opacity).toBeGreaterThan(near.wake[2].opacity)
    expect(near.cell).toEqual({ x: 3, y: 1 })
    expect(far.to).toEqual({ x: 3, y: 1 })
  })

  it('출발과 도착에서는 잠기지 않고 꼬리도 없다', () => {
    const [start] = frames(WHIRL_STAGE, ['left'], 0).boxes

    expect(start.shown).toBe(6)
    expect(start.wake).toEqual([])
  })

  it('끝 무렵 도착 칸에 작은 고리가 퍼진다', () => {
    const [near] = frames(WHIRL_STAGE, ['left'], 0.9).boxes

    expect(near.ring).not.toBeNull()
    expect(near.ring?.x).toBeCloseTo(toScreen({ x: 2, y: 1 }, 0).x)
  })

  it('연출이 끝나면 끌린 배를 따로 그리지 않는다', () => {
    expect(frames(WHIRL_STAGE, ['left'], 1).boxes).toEqual([])
  })

  it('밀어 띄운 상자는 물 칸 위로 다 밀려 올 때까지 끌린 배 그림이 투명하다', () => {
    const keys: Direction[] = ['right', 'right', 'right', 'down', 'down', 'down', 'left', 'up']
    const floated = (t: number) =>
      frames({ ...WHIRL_STAGE, goal: { x: 0, y: 3 } }, keys, t).boxes.filter((frame) =>
        same(frame.to, { x: 4, y: 1 }),
      )

    expect(floated(0.1).map((frame) => frame.opacity)).toEqual([0])
    expect(floated(0.95).map((frame) => frame.opacity)).toEqual([1])
  })

  it('큐브가 내린 배는 큐브가 반쯤 나갈 때까지 제자리이고 제 칸 차례에 그린다', () => {
    const [left] = frames(WHIRL_STAGE, ['down', 'up'], 0.1).boxes

    expect(left.x).toBeCloseTo(toScreen({ x: 3, y: 1 }, 0).x)
    expect(left.cell).toEqual({ x: 3, y: 1 })
  })

  it('앞쪽 칸으로 끌려갈 배도 출발 전에는 제 칸 차례에 그린다', () => {
    // 물 높이 1, (4,1) 소용돌이가 왼쪽 줄을 끌고 (1,1) 배에서 큐브가 위로 내림
    const stage: Stage = {
      ...WHIRL_STAGE,
      heights: [
        [1, 1, 1, 1, 1],
        [1, 0, 0, 0, 0],
        [1, 1, 1, 1, 1],
      ],
      start: { x: 1, y: 0 },
      goal: { x: 4, y: 2 },
      entities: [
        { type: 'whirlpool', x: 4, y: 1 },
        { type: 'box', x: 1, y: 1 },
      ],
    }
    const [boat] = frames(stage, ['down', 'up'], 0.1).boxes

    expect(boat.to).toEqual({ x: 2, y: 1 })
    expect(boat.cell).toEqual({ x: 1, y: 1 })
  })
})

describe('whirlFrames 마개', () => {
  const at = (seconds: number) => frames(PLUG_STAGE, ['down'], seconds / PLUG_TOTAL)

  it('밀기 구간에는 땅 높이 그대로 소용돌이 칸으로 간다', () => {
    const [box] = at(PLUG.push).boxes

    expect(box.to).toEqual({ x: 1, y: 2 })
    expect(box.y).toBeCloseTo(toScreen({ x: 1, y: 2 }, 2).y)
    expect(box.shown).toBe(TILE.layer)
  })

  it('빨려 드는 동안 소용돌이가 사라지고 그 뒤 상자가 수면 아래로 사라지며 물길이 흐려진다', () => {
    const sucked = at(PLUG.push + PLUG.suck)
    const gone = at(PLUG_TOTAL - 0.001)

    expect(sucked.boxes[0].shown).toBe(0)
    expect(sucked.openings[0]).toEqual({ eye: 0, lane: 1, ghost: 0 })
    expect(gone.boxes[0].opacity).toBeCloseTo(0, 2)
    expect(gone.openings[0].eye).toBeCloseTo(0, 2)
    expect(gone.openings[0].ghost).toBeCloseTo(1, 2)
  })

  it('마개 수는 상자 연출을 맡는다고 알린다', () => {
    expect(at(0.1).plugging).toBe(true)
    expect(frames().plugging).toBe(false)
  })

  it('막힌 뒤에는 비침만 남고 재시작하면 소용돌이가 서서히 돌아온다', () => {
    const plugged = played(['down'], PLUG_STAGE)
    const still = whirlFrames({
      before: plugged,
      game: plugged,
      events: [],
      t: 1,
      moving: false,
      dropping: false,
    })
    const back = whirlFrames({
      before: plugged,
      game: createState(PLUG_STAGE),
      events: [],
      t: 0.5,
      moving: true,
      dropping: true,
    })

    expect(still.openings[0]).toEqual({ eye: 0, lane: 0, ghost: 1 })
    expect(back.openings[0]).toEqual({ eye: 0.5, lane: 0.5, ghost: 0.5 })
  })
})

describe('plugPhase', () => {
  it('구간마다 0에서 1로 차례대로 간다', () => {
    const { events } = lastMove(PLUG_STAGE, ['down'])

    const pushed = plugPhase(events, PLUG.push / PLUG_TOTAL)

    expect(pushed?.push).toBeCloseTo(1)
    expect(pushed?.suck).toBeCloseTo(0)
    expect(plugPhase(events, 1)).toEqual({ push: 1, suck: 1, close: 1 })
    expect(plugPhase(lastMove(WHIRL_STAGE, ['left']).events, 0.5)).toBeNull()
  })
})

describe('leanOf', () => {
  const lanes = pullLanes(WHIRL_STAGE)
  const look = (game: GameState) =>
    whirlFrames({ before: game, game, events: [], t: 1, moving: false, dropping: false })

  it('소용돌이 앞 칸에 멈춘 배만 소용돌이 쪽으로 쏠린다', () => {
    const game = played(['left', 'right'])

    expect(leanOf(lanes.get('2-1'), game, { x: 2, y: 1 }, look(game))).toBe('left')
    expect(leanOf(lanes.get('3-1'), game, { x: 3, y: 1 }, look(game))).toBeNull()
  })

  it('큐브가 탄 배도 쏠림 방향은 남는다', () => {
    const game = played(['left', 'down'])

    expect(game.player).toEqual({ x: 2, y: 1 })
    expect(leanOf(lanes.get('2-1'), game, { x: 2, y: 1 }, look(game))).toBe('left')
  })
})

describe('pulledBeside', () => {
  it('큐브와 같은 깊이 옆 칸에 그리는 배가 있을 때만 참이다', () => {
    const [boat] = frames().boxes
    const at = (cell: { x: number; y: number }) => [{ ...boat, cell }]
    const cube = { x: 2, y: 1 }

    expect(pulledBeside(at({ x: 1, y: 2 }), cube)).toBe(true)
    expect(pulledBeside(at({ x: 1, y: 1 }), cube)).toBe(false)
    expect(pulledBeside(at({ x: 0, y: 3 }), cube)).toBe(false)
  })
})

describe('whirlLook', () => {
  it('소용돌이 칸은 보이고 물길 칸은 방향과 진하기를 받는다', () => {
    const game = createState(WHIRL_STAGE)
    const all = whirlFrames({
      before: game,
      game,
      events: [],
      t: 1,
      moving: false,
      dropping: false,
    })
    const lanes = pullLanes(WHIRL_STAGE)

    expect(whirlLook(WHIRL_STAGE, { x: 1, y: 1 }, undefined, all)).toEqual({
      eye: 1,
      ghost: 0,
      lane: null,
      laneOpacity: 0,
    })
    expect(whirlLook(WHIRL_STAGE, { x: 4, y: 1 }, lanes.get('4-1'), all)).toEqual({
      eye: 0,
      ghost: 0,
      lane: 'x',
      laneOpacity: 1,
    })
  })
})
