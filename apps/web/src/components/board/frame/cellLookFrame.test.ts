import { describe, expect, it } from 'vitest'

import { pullLanes } from '../view'
import { boardCells } from './cellFrame'
import { cellLook, sameCellLook } from './cellLookFrame'
import { NO_CHAIN, smooth } from './curveFrame'
import { fillingCellKey } from './fillFrame'
import { sceneFrame } from './sceneFrame'
import { swampTime } from './swampFrame'
import {
  LIFT_STAGE,
  SLUICE_STAGE,
  STONE_STAGE,
  TRAM_STAGE,
  WHIRL_STAGE,
  lastMove,
} from './testStages'
import { SLUICE, durationOf, sluiceStart } from './timeFrame'
import { railDirsOf } from './tramFrame'
import { vineLooks } from './vineFrame'
import { createState } from '@/game/rules'
import type { GameEvent, GameState, Stage, Tram } from '@/game/types'

// (1,0) 상자를 오른쪽 (2,0) 구덩이로 밀어 메우는 판
const FILL_STAGE: Stage = {
  version: 1,
  id: 'test-cell-look-fill',
  heights: [[0, 0, -1, 0, 0]],
  start: { x: 0, y: 0 },
  goal: { x: 4, y: 0 },
  entities: [{ type: 'box', x: 1, y: 0 }],
}

// 물 높이 1, (2,0) 말뚝에 줄 길이 2로 묶인 배가 (2,1)
const TETHER_STAGE: Stage = {
  version: 1,
  id: 'test-cell-look-tether',
  heights: [
    [1, 1, 1, 1, 1, 1, 1],
    [1, 1, 0, 0, 0, 0, 1],
    [1, 1, 0, 0, 0, 0, 1],
    [1, 1, 1, 1, 1, 1, 1],
  ],
  water: 1,
  start: { x: 1, y: 1 },
  goal: { x: 6, y: 3 },
  entities: [
    { type: 'box', x: 2, y: 1 },
    { type: 'post', x: 2, y: 0, length: 2, boat: { x: 2, y: 1 } },
  ],
}

// Board와 같은 순서로 만든 칸마다의 결과
const looks = (
  game: GameState,
  prevGame: GameState | null = null,
  events: GameEvent[] = [],
  t = 1,
  restarting = false,
  ambient: Parameters<typeof cellLook>[0]['ambient'] = null,
) => {
  const trams = game.stage.entities.filter((e): e is Tram => e.type === 'tram')
  const swampSeconds = swampTime(restarting ? null : prevGame, game)
  const scene = sceneFrame({
    game,
    prevGame,
    events,
    t,
    chain: NO_CHAIN,
    restarting,
    swampSeconds,
    trams,
    filled: [],
    lanes: pullLanes(game.stage),
  })
  const railDirs = railDirsOf(trams)
  const vines = vineLooks(game)
  const fillingKey = fillingCellKey(scene.box, events, vines)
  const cells = boardCells(game.heights, scene.before.heights, railDirs, vines, fillingKey)
  const lookOf = cellLook({
    stage: game.stage,
    game,
    events,
    t,
    swampSeconds,
    fillingKey,
    railDirs,
    scene,
    ambient,
  })
  return new Map(cells.map((cell) => [cell.key, lookOf(cell)]))
}

describe('cellLook', () => {
  it('요소 없는 칸은 요소마다 없는 칸의 기본값을 받는다', () => {
    const { look, over } = looks(createState(FILL_STAGE)).get('3-0')!
    expect(look).toMatchObject({
      vine: { kind: null, growth: 1, rise: 1, opacity: 1 },
      seed: { on: 0, treeP: 1, stakeP: 1 },
      swamp: { risen: -1 },
      tether: { post: 0, range: -1 },
      whirl: { eye: 0, ghost: 0, lane: null, laneOpacity: 0, lean: null },
      water: { depth: 0 },
      pit: { wallLeft: -1, wallRight: -1 },
      ground: { blockOpacity: 1 },
      ladder: { leaning: '' },
      device: { entity: null },
      box: false,
    })
    expect(over.overlay).toBe(false)
  })

  it('밟힌 스위치는 얕게, 빈 스위치는 깊게 그린다', () => {
    const idle = looks(createState(LIFT_STAGE)).get('1-1')!
    expect(idle.look.device.entity).toBe('switch')
    expect(idle.look.device.switchDepth).toBe(9)
    const { game } = lastMove(LIFT_STAGE, ['down'])
    expect(looks(game).get('1-1')!.look.device.switchDepth).toBe(2)
  })

  it('얼음 돌이 얹힌 스위치도 얕게 그린다', () => {
    const game = { ...createState(LIFT_STAGE), stones: [{ x: 1, y: 1 }] }
    expect(looks(game).get('1-1')!.look.device.switchDepth).toBe(2)
  })

  it('미끄러져 지나치는 스위치와 그 문은 살짝 내려갔다 돌아온다', () => {
    const stage: Stage = {
      version: 1,
      id: 'test-cell-look-pass',
      heights: [
        [0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0],
      ],
      ice: ['.###.', '.....'],
      start: { x: 0, y: 0 },
      goal: { x: 4, y: 1 },
      entities: [
        { type: 'switch', x: 2, y: 0, target: 'a' },
        { type: 'door', id: 'a', x: 0, y: 1 },
      ],
    }
    const { prev, game, events } = lastMove(stage, ['right'])
    const frames = Array.from({ length: 101 }, (_, i) => looks(game, prev, events, i / 100))
    const device = (i: number, key: string) => frames[i].get(key)!.look.device

    expect(Math.min(...frames.map((_, i) => device(i, '2-0').switchDepth))).toBeLessThan(9)
    expect(Math.min(...frames.map((_, i) => device(i, '0-1').doorDepth))).toBeLessThan(30)
    expect(device(100, '2-0').switchDepth).toBe(9)
    expect(device(100, '0-1').doorDepth).toBe(30)
  })

  it('옆에서 밀어 메우는 칸은 상자가 닿는 동안 숨긴다', () => {
    const { prev, game, events } = lastMove(FILL_STAGE, ['right'])
    expect(looks(game, prev, events, 0.5).get('2-0')!.look.hidden).toBe(true)
    expect(looks(game).get('2-0')!.look.hidden).toBe(false)
  })

  it('재시작으로 다시 구멍이 되는 메운 칸은 제자리에서 옅어진다', () => {
    const { game: moved } = lastMove(FILL_STAGE, ['right'])
    const { look } = looks(createState(FILL_STAGE), moved, [], 0.1, true).get('2-0')!
    expect(look.ground.filled).toBe(true)
    expect(look.ground.blockOpacity).toBeCloseTo(1 - smooth(0.4))
  })

  it('발판이 선 칸은 위에 발판을 얹어 그린다', () => {
    const { look, over } = looks(createState(TRAM_STAGE)).get('1-1')!
    expect(look.pit.rail).not.toBe('')
    expect(over.tram).not.toBeNull()
    expect(over.overlay).toBe(true)
  })

  it('큐브가 선 칸은 위에 큐브를 얹어 그린다', () => {
    const cells = looks(createState(FILL_STAGE))
    expect(cells.get('0-0')!.over.drawCube).toBe(true)
    expect(cells.get('1-0')!.over.drawCube).toBe(false)
    expect(cells.get('1-0')!.look.box).toBe(true)
  })

  it('묶인 배가 갈 수 있는 물 칸에만 범위 값을 둔다', () => {
    const cells = looks(createState(TETHER_STAGE))
    expect(cells.get('3-1')!.look.tether.range).toBe(0)
    expect(cells.get('5-2')!.look.tether.range).toBe(-1)
    expect(cells.get('2-0')!.look.tether.post).toBeGreaterThan(0)
  })

  it('분위기 연출은 고른 칸에만 종류와 시작을 두고 다른 칸은 없는 값', () => {
    const ambient = { kind: 'mote' as const, cells: [{ x: 3, y: 0 }], at: 24000, cycle: 36000 }
    const cells = looks(createState(FILL_STAGE), null, [], 1, false, ambient)
    expect(cells.get('3-0')!.look.ambient).toEqual({
      kind: 'mote',
      at: 24000,
      cycle: 36000,
      leave: false,
    })
    expect(cells.get('4-0')!.look.ambient).toEqual({ kind: null, at: 0, cycle: 0, leave: false })
  })

  it('나비는 옆 칸에 큐브가 오면 leave', () => {
    const ambient = { kind: 'butterfly' as const, cells: [{ x: 4, y: 0 }], at: 0, cycle: 5800 }
    const far = looks(createState(FILL_STAGE), null, [], 1, false, ambient)
    expect(far.get('4-0')!.look.ambient.leave).toBe(false)
    const game = { ...createState(FILL_STAGE), player: { x: 3, y: 0 } }
    expect(looks(game, null, [], 1, false, ambient).get('4-0')!.look.ambient.leave).toBe(true)
  })

  it('찬 김은 돌이 그 칸을 떠나면 leave', () => {
    const ambient = { kind: 'mist' as const, cells: [{ x: 4, y: 0 }], at: 0, cycle: 6000 }
    const game = { ...createState(FILL_STAGE), stones: [{ x: 4, y: 0 }], player: { x: 3, y: 0 } }
    expect(looks(game, null, [], 1, false, ambient).get('4-0')!.look.ambient.leave).toBe(false)
    const moved = { ...game, stones: [{ x: 3, y: 0 }] }
    expect(looks(moved, null, [], 1, false, ambient).get('4-0')!.look.ambient.leave).toBe(true)
  })
})

describe('sameCellLook', () => {
  const base = () => {
    const { look } = looks(createState(LIFT_STAGE)).get('1-1')!
    return { ...look, children: undefined }
  }

  it('묶음 객체가 새로 만들어져도 안의 값이 같으면 같다', () => {
    const a = base()
    const b = { ...a, crack: { ...a.crack }, device: { ...a.device } }
    expect(b.crack).not.toBe(a.crack)
    expect(sameCellLook(a, b)).toBe(true)
  })

  it('묶음 안 값 하나만 달라도 다르다', () => {
    const a = base()
    expect(sameCellLook(a, { ...a, device: { ...a.device, switchDepth: 3 } })).toBe(false)
    expect(sameCellLook(a, { ...a, vine: { ...a.vine, opacity: 0.5 } })).toBe(false)
  })

  it('원시값 속성이 다르면 다르다', () => {
    const a = base()
    expect(sameCellLook(a, { ...a, y: a.y + 1 })).toBe(false)
  })

  it('children은 참조가 다르면 내용이 같아도 다르다', () => {
    const a = { ...base(), children: { type: 'g', props: {} } }
    expect(sameCellLook(a, { ...a, children: { type: 'g', props: {} } })).toBe(false)
    expect(sameCellLook(a, { ...a })).toBe(true)
  })
})

describe('cellLook 소용돌이', () => {
  it('끌려가는 배가 닿을 칸은 연출 중 정지 상자를 숨기고 끌린 배를 칸 위에 얹는다', () => {
    const { prev, game, events } = lastMove(WHIRL_STAGE, ['left'])
    const all = looks(game, prev, events, 0.5)

    expect(all.get('2-1')!.look.box).toBe(false)
    expect(all.get('3-1')!.look.box).toBe(false)
    expect(all.get('3-1')!.over.whirlBoxes.map((frame) => frame.to)).toEqual([{ x: 2, y: 1 }])
    expect(all.get('2-1')!.look.whirl).toMatchObject({ lane: 'x', laneOpacity: 1 })
    expect(all.get('1-1')!.look.whirl.eye).toBe(1)
  })

  it('멈춘 판의 앞 칸 배는 소용돌이 쪽으로 쏠린다', () => {
    const { game } = lastMove(WHIRL_STAGE, ['left', 'right'])

    expect(looks(game).get('2-1')!.look.whirl.lean).toBe('left')
    expect(looks(game).get('3-1')!.look.whirl.lean).toBeNull()
  })
})

describe('cellLook 얼음 돌', () => {
  it('땅 위 돌 칸과 언 칸과 얼어붙은 배 칸은 얼음 돌 묶음으로 받는다', () => {
    const stage: Stage = {
      ...STONE_STAGE,
      entities: [
        ...STONE_STAGE.entities,
        { type: 'box', x: 3, y: 2 },
        { type: 'iceStone', x: 3, y: 1 },
      ],
    }
    const map = looks(createState(stage))

    expect(map.get('2-1')!.look.iceStone).toMatchObject({ stone: 'land', cover: 0 })
    expect(map.get('2-2')!.look.iceStone).toMatchObject({ stone: null, cover: 1, from: 'up' })
    expect(map.get('2-2')!.look.water.idle).toBe(-1)
    expect(map.get('3-2')!.look.iceStone).toMatchObject({ boat: 1, iced: false })
    expect(map.get('3-3')!.look.iceStone).toMatchObject({ cover: 0, boat: 0 })
  })

  it('물에 뜬 돌은 칸 그림 몫이고 밀려 가는 동안은 칸 위에 얹어 그린다', () => {
    const { prev, game, events } = lastMove(STONE_STAGE, ['down'])
    const resting = looks(game).get('2-2')!
    const moving = looks(game, prev, events, 0.5)

    expect(resting.look.iceStone.stone).toBe('float')
    expect(moving.get('2-2')!.look.iceStone.stone).toBeNull()
    expect([...moving.values()].flatMap(({ over }) => over.stones)).toHaveLength(1)
  })
})

describe('재시작하며 처음 모습으로 돌아가는 칸', () => {
  const restart = (stage: Stage, moves: Parameters<typeof lastMove>[1], t: number) =>
    looks(createState(stage), lastMove(stage, moves).game, [], t, true)
  const between = (v: number) => {
    expect(v).toBeGreaterThan(0)
    expect(v).toBeLessThan(1)
  }

  it('주운 사다리는 제자리에 서서히 나타나고 기대 놓은 사다리는 서서히 사라진다', () => {
    const stage: Stage = {
      version: 1,
      id: 'test-restart-ladder',
      heights: [[0, 0, 1, 1]],
      start: { x: 0, y: 0 },
      goal: { x: 3, y: 0 },
      entities: [{ type: 'ladder', x: 1, y: 0 }],
    }
    const { ladder } = restart(stage, ['right', 'right'], 0.5).get('1-0')!.look

    between(ladder.flat)
    expect(ladder.leaning).toMatch(/^right:/)
    between(Number(ladder.leaning.split(':')[1]))
  })

  it('늪을 메운 상자가 사라지면 늪이 서서히 드러난다', () => {
    const stage: Stage = {
      version: 1,
      id: 'test-restart-swamp',
      heights: [[0, 0, 0, 0]],
      swamp: ['..#.'],
      start: { x: 0, y: 0 },
      goal: { x: 3, y: 0 },
      entities: [{ type: 'box', x: 1, y: 0 }],
    }

    between(restart(stage, ['right'], 0.5).get('2-0')!.look.swamp.filled)
  })

  it('시든 버섯은 서서히 다시 편다', () => {
    const stage: Stage = {
      version: 1,
      id: 'test-restart-cap',
      heights: [[0, 0, 0, 0, 0]],
      mushroom: ['.#...'],
      start: { x: 0, y: 0 },
      goal: { x: 4, y: 0 },
      entities: [],
      rules: { mushroomWither: true },
    }

    between(restart(stage, ['right'], 0.5).get('1-0')!.look.mushroom.wither)
  })

  it('스위치와 엘리베이터 발판은 감속하며 처음 자리로 돌아간다', () => {
    const switchCell = restart(LIFT_STAGE, ['down'], 0.25).get('1-1')!.look

    expect(switchCell.device.switchDepth).toBeCloseTo(2 + 7 * smooth(0.25))
  })

  it('처음 자리로 돌아간 움직이는 발판은 큐브처럼 서서히 나타난다', () => {
    const tram = [...restart(TRAM_STAGE, ['right'], 0.02).values()].find(({ over }) => over.tram)!
      .over.tram!

    between(tram.opacity)
  })
})

describe('cellLook 수위', () => {
  it('물이 오르는 동안 잠기는 줄은 그 순간 물 깊이, 장치 칸은 수위 묶음', () => {
    const { prev, game, events } = lastMove(SLUICE_STAGE, ['left'])
    const t = (sluiceStart(events)! + SLUICE.tap + SLUICE.level / 2) / durationOf(events)
    const cells = looks(game, prev, events, t)

    expect(cells.get('1-1')!.look.water.depth).toBeCloseTo(0.5)
    expect(cells.get('0-1')!.look.water.depth).toBeCloseTo(1.5)
    expect(cells.get('0-0')!.look.sluice).toMatchObject({ device: true, open: 1 })
    expect(cells.get('2-0')!.look.sluice.device).toBe(false)
  })
})

describe('cellLook 화로', () => {
  // (1,0) 화로 위 상자, 큐브가 (0,0)
  const BRAZIER_STAGE: Stage = {
    version: 1,
    id: 'test-cell-look-brazier',
    heights: [[0, 0, 0, 0]],
    fire: ['.@..'],
    start: { x: 0, y: 1 },
    goal: { x: 3, y: 0 },
    entities: [{ type: 'box', x: 1, y: 0 }],
  }

  it('화로 칸은 그릇과 그 위 상자 높이, 상자가 덮어 그릇 불티를 거둠', () => {
    const game = createState({
      ...BRAZIER_STAGE,
      heights: [
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ],
    })
    const cells = looks(game)
    expect(cells.get('1-0')!.look.brazier).toMatchObject({ on: true, lift: 8, covered: 1 })
    expect(cells.get('2-0')!.look.brazier).toMatchObject({ on: false, lift: 0, burn: -1 })
  })
})
