import { describe, expect, it } from 'vitest'

import { AMBIENT, ambientCells, ambientLoops, ambientPlan } from './ambientView'
import type { ViewBox } from './cameraView'
import { createState } from '@/game/rules'
import type { Stage } from '@/game/types'

const STAGE: Stage = {
  version: 1,
  id: '1-1',
  heights: [
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
  ],
  start: { x: 0, y: 0 },
  goal: { x: 4, y: 3 },
  entities: [],
}

const PAIRS: Stage = {
  ...STAGE,
  id: '3-4',
  entities: [
    { type: 'warp', id: 'a', x: 2, y: 0 },
    { type: 'warp', id: 'a', x: 4, y: 0 },
    { type: 'warp', id: 'b', x: 0, y: 3 },
    { type: 'warp', id: 'b', x: 2, y: 3 },
  ],
}

// 늪 셋과 버섯 둘, 큐브는 (0,0)
const MEADOW: Stage = {
  ...STAGE,
  id: '6-1',
  swamp: ['.#.##', '.....', '.....', '.....'],
  mushroom: ['.....', '#....', '.....', '...#.'],
}

// 물 높이 1, 맨 아래 줄이 물, 얼음 돌 넷 중 (1,3)은 물에 뜬 돌
const ICY: Stage = {
  ...STAGE,
  id: '13-1',
  heights: [
    [1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1],
    [0, 0, 0, 0, 0],
  ],
  water: 1,
  goal: { x: 4, y: 0 },
  entities: [
    { type: 'iceStone', x: 1, y: 0 },
    { type: 'iceStone', x: 3, y: 1 },
    { type: 'iceStone', x: 1, y: 2 },
    { type: 'iceStone', x: 1, y: 3 },
    { type: 'warp', id: 'a', x: 4, y: 2 },
    { type: 'warp', id: 'a', x: 0, y: 2 },
  ],
}

// 불씨 둘과 숯 벽, 숯 다리, 큐브는 (0,0)
const EMBERS: Stage = {
  ...STAGE,
  id: '16-1',
  fire: ['..*..', '.#=..', '....*', '.....'],
}

const key = ({ x, y }: { x: number; y: number }) => `${x}-${y}`

describe('ambientPlan', () => {
  it('짝 칸 없는 1장은 4.35초마다 빛 알갱이만', () => {
    expect(ambientPlan(STAGE, 1)).toEqual({ cycle: 4350, slots: [{ at: 0, kind: 'mote' }] })
  })

  it('짝 칸 판의 1장은 빛 알갱이와 짝 칸 숨이 번갈아, 끝나고 1.4초씩 쉼', () => {
    expect(ambientPlan(PAIRS, 1)).toEqual({
      cycle: 8350,
      slots: [
        { at: 0, kind: 'mote' },
        { at: 4350, kind: 'warp' },
      ],
    })
  })

  it('2장은 나비 다음 그 판의 요소 연출 차례', () => {
    expect(ambientPlan(MEADOW, 2)).toEqual({
      cycle: 12900,
      slots: [
        { at: 0, kind: 'butterfly' },
        { at: 5800, kind: 'bubble' },
        { at: 8800, kind: 'spore' },
      ],
    })
    expect(ambientPlan(STAGE, 2)).toEqual({ cycle: 5800, slots: [{ at: 0, kind: 'butterfly' }] })
  })

  it('얼음 돌 판은 장과 무관하게 찬 김, 짝 칸과 함께면 번갈아', () => {
    expect(ambientPlan(ICY, 3)).toEqual({
      cycle: 2000 + 2550 + 1400 + 2600 + 1400,
      slots: [
        { at: 2000, kind: 'mist' },
        { at: 2000 + 2550 + 1400, kind: 'warp' },
      ],
    })
  })

  it('4장은 재 한 송이 다음 꺼진 불씨 칸 연기 차례, 불씨 칸 없는 판은 재만', () => {
    expect(ambientPlan(EMBERS, 4)).toEqual({
      cycle: 9550,
      slots: [
        { at: 0, kind: 'ash' },
        { at: 4350, kind: 'emberSmoke' },
      ],
    })
    expect(ambientPlan(STAGE, 4)).toEqual({ cycle: 4350, slots: [{ at: 0, kind: 'ash' }] })
  })

  it('바닥 연출이 없는 장은 그 자리를 2초 비우고 요소 연출만', () => {
    expect(ambientPlan(PAIRS, 3)).toEqual({ cycle: 6000, slots: [{ at: 2000, kind: 'warp' }] })
  })

  it('바닥 연출도 요소 연출도 없는 판은 null', () => {
    expect(ambientPlan(STAGE, 3)).toBeNull()
  })

  it('연출이 끝나고 1.4초 넘게 쉰 뒤 다음 차례, 한 번에 하나', () => {
    for (const stage of [STAGE, PAIRS, MEADOW, ICY, EMBERS]) {
      for (const chapter of [1, 2, 3, 4]) {
        const plan = ambientPlan(stage, chapter)
        plan?.slots.forEach((slot, i) => {
          const next = plan.slots[i + 1]?.at ?? plan.cycle + plan.slots[0].at
          expect(slot.at + AMBIENT[slot.kind].life + 1400).toBeLessThanOrEqual(next)
        })
      }
    }
  })
})

describe('ambientCells', () => {
  it('빛 알갱이는 큐브 칸과 상하좌우 칸을 뺀 빈 땅 한 칸', () => {
    const game = createState(STAGE)
    for (let round = 0; round < 20; round++) {
      const cells = ambientCells(game, 'mote', round, 0)
      expect(cells).toHaveLength(1)
      expect(['0-0', '1-0', '0-1', '4-3']).not.toContain(key(cells[0]))
    }
  })

  it('빛 알갱이는 요소, 상자, 얼음, 무너지는 칸 제외', () => {
    const stage: Stage = {
      ...STAGE,
      heights: [[0, 0, 0, 0, 0, 0, 0]],
      ice: ['...#...'],
      cracks: ['....2..'],
      start: { x: 0, y: 0 },
      goal: { x: 6, y: 0 },
      entities: [
        { type: 'box', x: 2, y: 0 },
        { type: 'switch', target: 'd', x: 5, y: 0 },
      ],
    }
    const game = createState(stage)
    for (let round = 0; round < 10; round++) {
      expect(ambientCells(game, 'mote', round, 0)).toEqual([])
    }
  })

  it('같은 판과 바퀴는 늘 같은 칸, 바퀴가 바뀌면 다른 칸도 고름', () => {
    const game = createState(STAGE)
    expect(ambientCells(game, 'mote', 3, 2)).toEqual(ambientCells(game, 'mote', 3, 2))
    const picked = new Set(
      Array.from({ length: 12 }, (_, round) => key(ambientCells(game, 'mote', round, 0)[0])),
    )
    expect(picked.size).toBeGreaterThan(3)
  })

  it('바로 앞 빛 알갱이 칸과 그 상하좌우 칸 제외', () => {
    const game = createState(STAGE)
    for (let round = 0; round < 20; round++) {
      const last = ambientCells(game, 'mote', round, 0)
      const [next] = ambientCells(game, 'mote', round + 1, 0, last)
      expect(Math.abs(next.x - last[0].x) + Math.abs(next.y - last[0].y)).toBeGreaterThan(1)
    }
  })

  it('피할 칸밖에 없으면 피하지 않고 고름', () => {
    const stage: Stage = { ...STAGE, heights: [[0, 0, 0, 0, 0]], goal: { x: 0, y: 0 } }
    const game = { ...createState(stage), player: { x: 1, y: 0 } }
    expect(ambientCells(game, 'mote', 0, 0, [{ x: 3, y: 0 }])).toHaveLength(1)
  })

  it('짝 칸 숨은 한 짝의 두 칸, 바퀴마다 다른 짝', () => {
    const game = createState(PAIRS)
    const first = ambientCells(game, 'warp', 0, 1).map(key)
    const second = ambientCells(game, 'warp', 1, 1).map(key)
    expect(first).toHaveLength(2)
    expect(second).toHaveLength(2)
    expect(new Set([...first, ...second]).size).toBe(4)
  })

  it('큐브가 선 짝 칸도 숨 쉼', () => {
    const game = { ...createState(PAIRS), player: { x: 2, y: 0 } }
    const pairs = [0, 1].map((round) => ambientCells(game, 'warp', round, 1).map(key).join())
    expect(pairs).toContain('2-0,4-0')
  })

  it('늪 기포는 남은 늪 칸 하나, 큐브 칸과 상하좌우 칸 제외', () => {
    const game = { ...createState(MEADOW), player: { x: 2, y: 0 } }
    const picked = new Set(
      Array.from({ length: 20 }, (_, round) => key(ambientCells(game, 'bubble', round, 0)[0])),
    )
    expect([...picked].sort()).toEqual(['4-0'])
    const sunk = { ...createState(MEADOW), swamps: [{ x: 1, y: 0 }], player: { x: 2, y: 3 } }
    expect(ambientCells(sunk, 'bubble', 0, 0).map(key)).toEqual(['1-0'])
  })

  it('버섯 포자는 남은 버섯 하나, 큐브 칸과 상하좌우 칸과 시든 버섯 제외', () => {
    const game = createState(MEADOW)
    for (let round = 0; round < 10; round++) {
      expect(ambientCells(game, 'spore', round, 0).map(key)).toEqual(['3-3'])
    }
    expect(ambientCells({ ...game, mushrooms: [] }, 'spore', 0, 0)).toEqual([])
  })

  it('찬 김은 땅 위 돌과 물에 뜬 돌 하나, 큐브 옆 돌과 소용돌이에 끌려갈 돌도 후보', () => {
    const game = createState(ICY)
    const picks = (state: typeof game) =>
      [
        ...new Set(
          Array.from({ length: 30 }, (_, round) => key(ambientCells(state, 'mist', round, 0)[0])),
        ),
      ].sort()
    expect(picks(game)).toEqual(['1-0', '1-2', '1-3', '3-1'])
    // 땅 돌 (1,2)를 빼 물이 얼지 않아 (1,3)이 다음 수에 끌려가는 물길
    const lane = ICY.entities.filter((e) => !(e.type === 'iceStone' && e.x === 1 && e.y === 2))
    const whirled = createState({ ...ICY, entities: [...lane, { type: 'whirlpool', x: 4, y: 3 }] })
    expect(picks(whirled)).toEqual(['1-0', '1-3', '3-1'])
  })

  it('나비는 빛 알갱이처럼 빈 땅 한 칸', () => {
    const game = createState(MEADOW)
    for (let round = 0; round < 20; round++) {
      const [cell] = ambientCells(game, 'butterfly', round, 0)
      expect(['0-0', '1-0', '0-1', '3-0', '4-0', '0-1', '3-3', '4-3']).not.toContain(key(cell))
    }
  })

  it('지금 화면에 보이는 칸만, 짝은 한 칸이라도 보이면 후보, 큐브 구역과 무관', () => {
    const stage: Stage = { ...PAIRS, zones: [{ x: 2, y: 0, w: 3, h: 4 }], start: { x: 4, y: 0 } }
    const game = createState(stage)
    // 화면에 빈 칸 (1,3) 둘레만, 짝 칸 (0,3) 둘레만 보이는 viewBox
    const floor: ViewBox = [-160, 40, 110, 110]
    const pair: ViewBox = [-210, 20, 110, 110]
    for (let round = 0; round < 10; round++) {
      expect(ambientCells(game, 'mote', round, 0, [], floor).map(key)).toEqual(['1-3'])
      expect(ambientCells(game, 'warp', round, 1, [], pair).map(key)).toEqual(['0-3', '2-3'])
    }
  })
})

describe('ambientCells 불', () => {
  it('재 한 송이는 불 칸을 뺀 빈 땅 한 칸', () => {
    const game = createState(EMBERS)
    const fire = ['2-0', '1-1', '2-1', '4-2']
    for (let round = 0; round < 40; round++) {
      const [p] = ambientCells(game, 'ash', round, 0)
      expect(fire).not.toContain(key(p))
    }
  })

  it('꺼진 불씨 칸 연기는 아직 안 켠 불씨 칸 하나, 큐브 칸과 상하좌우 칸 제외', () => {
    const game = createState(EMBERS)
    const picked = new Set(
      Array.from({ length: 20 }, (_, round) => key(ambientCells(game, 'emberSmoke', round, 1)[0])),
    )
    expect(picked).toEqual(new Set(['2-0', '4-2']))
    expect(ambientCells({ ...game, sparks: [{ x: 4, y: 2 }] }, 'emberSmoke', 0, 1)).toEqual([
      { x: 4, y: 2 },
    ])
    expect(
      ambientCells(
        { ...game, player: { x: 4, y: 1 }, sparks: [{ x: 4, y: 2 }] },
        'emberSmoke',
        0,
        1,
      ),
    ).toEqual([])
  })
})

describe('ambientLoops', () => {
  it('재 한 송이는 송이가 1.7초에 내려앉고 먼지가 2.9초까지 번지며 사라짐', () => {
    const loops = ambientLoops('ash', 9550)
    expect(loops.map((loop) => loop.shape)).toEqual(['dust', 'flake'])
    for (const { keyframes } of loops) {
      expect(keyframes[0].opacity).toBe(0)
      expect(keyframes.at(-1)!.opacity).toBe(0)
    }
    expect(loops[1].keyframes.at(-2)!.offset).toBeCloseTo(2800 / 9550)
    expect(loops[0].keyframes.at(-2)!.offset).toBeCloseTo(2900 / 9550)
    expect(Math.max(...loops[1].keyframes.map((k) => Number(k.opacity)))).toBe(0.85)
  })

  it('꺼진 불씨 칸 연기는 두 가닥이 0.8초 어긋나 3초에 걸쳐 오르며 사라짐', () => {
    const loops = ambientLoops('emberSmoke', 9550)
    expect(loops.map((loop) => [loop.shape, loop.delay])).toEqual([
      ['smoke', 0],
      ['smoke', 800],
    ])
    for (const { keyframes } of loops) {
      expect(keyframes[0].opacity).toBe(0)
      expect(keyframes.at(-2)!.offset).toBeCloseTo(3000 / 9550)
      expect(keyframes.at(-1)!.opacity).toBe(0)
    }
    expect(Math.max(...loops[0].keyframes.map((k) => Number(k.opacity)))).toBe(0.45)
  })

  it('빛 알갱이 셋은 0.35초씩 늦게, 한 바퀴 안에서 끝나는 키프레임', () => {
    const loops = ambientLoops('mote', 36000)
    expect(loops.map((loop) => loop.delay)).toEqual([0, 350, 700])
    for (const { keyframes } of loops) {
      expect(keyframes[0].opacity).toBe(0)
      expect(keyframes.at(-1)!.opacity).toBe(0)
      expect(Math.max(...keyframes.map((k) => Number(k.opacity)))).toBeCloseTo(0.6)
      expect(keyframes.at(-2)!.offset).toBeCloseTo(2250 / 36000)
    }
  })

  it('늪 기포는 0.9초까지 부풀어 터지고 원판이 1.6초까지 번지며 사라짐', () => {
    const [bubble, disk] = ambientLoops('bubble', 36000)
    expect(bubble.shape).toBe('bubble')
    expect(disk.shape).toBe('disk')
    expect(Math.max(...bubble.keyframes.map((k) => Number(k.opacity)))).toBe(0.7)
    expect(Math.max(...disk.keyframes.map((k) => Number(k.opacity)))).toBe(0.45)
    expect(disk.keyframes.at(-2)!.offset).toBeCloseTo(1600 / 36000)
  })

  it('버섯 포자 다섯은 0.2초씩 늦게 진하기 0.85에서 1.9초에 사라짐', () => {
    const spores = ambientLoops('spore', 36000)
    expect(spores.map((loop) => loop.delay)).toEqual([0, 200, 400, 600, 800])
    for (const { keyframes } of spores) {
      expect(Math.max(...keyframes.map((k) => Number(k.opacity)))).toBe(0.85)
      expect(keyframes.at(-2)!.offset).toBeCloseTo(1900 / 36000)
    }
  })

  it('나비는 두 날개가 같이 4.4초에 날아가 사라짐', () => {
    const wings = ambientLoops('butterfly', 36000)
    expect(wings.map((loop) => loop.shape)).toEqual(['wingLeft', 'wingRight'])
    for (const { keyframes } of wings) {
      expect(keyframes[0].opacity).toBe(0)
      expect(Math.max(...keyframes.map((k) => Number(k.opacity)))).toBe(0.9)
      expect(keyframes.at(-2)!.offset).toBeCloseTo(4400 / 36000)
      expect(keyframes.at(-1)!.opacity).toBe(0)
    }
  })

  it('찬 김은 발치 김 둘과 윗단 김 하나가 2.4초에 사라짐, 오른쪽 발치는 0.15초 늦게', () => {
    const loops = ambientLoops('mist', 36000)
    expect(loops.map((loop) => [loop.shape, loop.delay])).toEqual([
      ['wisp', 0],
      ['sheetLeft', 0],
      ['sheetRight', 150],
    ])
    for (const { keyframes } of loops) {
      expect(keyframes[0].opacity).toBe(0)
      expect(keyframes.at(-2)!.offset).toBeCloseTo(2400 / 36000)
      expect(keyframes.at(-1)!.opacity).toBe(0)
    }
    expect(Math.max(...loops[0].keyframes.map((k) => Number(k.opacity)))).toBe(0.5)
    expect(Math.max(...loops[1].keyframes.map((k) => Number(k.opacity)))).toBe(0.45)
  })

  it('짝 칸 숨은 우묵면과 틀 빛 테가 1.1초에 가장 밝고 2.6초에 꺼짐', () => {
    const [dish, ring] = ambientLoops('warp', 36000)
    for (const { keyframes, delay } of [dish, ring]) {
      expect(delay).toBe(0)
      expect(keyframes[1].offset).toBeCloseTo(1100 / 36000)
      expect(keyframes[2].offset).toBeCloseTo(2600 / 36000)
      expect(keyframes[2].opacity).toBe(0)
    }
    expect(dish.keyframes[1].opacity).toBe(0.85)
    expect(ring.keyframes[1].opacity).toBe(0.7)
  })
})
