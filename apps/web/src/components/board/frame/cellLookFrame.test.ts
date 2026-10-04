import { describe, expect, it } from 'vitest'

import { boardCells } from './cellFrame'
import { cellLook } from './cellLookFrame'
import { NO_CHAIN, smooth } from './curveFrame'
import { fillingCellKey } from './fillFrame'
import { sceneFrame } from './sceneFrame'
import { swampTime } from './swampFrame'
import { LIFT_STAGE, TRAM_STAGE, lastMove } from './testStages'
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
  })
  const railDirs = railDirsOf(trams)
  const vines = vineLooks(game)
  const fillingKey = fillingCellKey(scene.box, events, vines)
  const cells = boardCells(game.heights, scene.before.heights, railDirs, vines, fillingKey)
  const view = { stage: game.stage, game, events, t, swampSeconds, fillingKey, railDirs, scene }
  return new Map(cells.map((cell) => [cell.key, cellLook(view, cell)]))
}

describe('cellLook', () => {
  it('요소 없는 칸은 요소마다 없는 칸의 기본값을 받는다', () => {
    const { look, over } = looks(createState(FILL_STAGE)).get('3-0')!
    expect(look).toMatchObject({
      vine: null,
      vineGrowth: 1,
      vineRise: 1,
      vineOpacity: 1,
      seed: 0,
      seedTreeP: 1,
      seedStakeP: 1,
      swampRisen: -1,
      moorRange: -1,
      post: 0,
      water: 0,
      pitWallLeft: -1,
      pitWallRight: -1,
      blockOpacity: 1,
      leaning: '',
      entity: null,
      box: false,
    })
    expect(over.overlay).toBe(false)
  })

  it('밟힌 스위치는 얕게, 빈 스위치는 깊게 그린다', () => {
    const idle = looks(createState(LIFT_STAGE)).get('1-1')!
    expect(idle.look.entity).toBe('switch')
    expect(idle.look.switchDepth).toBe(9)
    const { game } = lastMove(LIFT_STAGE, ['down'])
    expect(looks(game).get('1-1')!.look.switchDepth).toBe(2)
  })

  it('옆에서 밀어 메우는 칸은 상자가 닿는 동안 숨긴다', () => {
    const { prev, game, events } = lastMove(FILL_STAGE, ['right'])
    expect(looks(game, prev, events, 0.5).get('2-0')!.look.hidden).toBe(true)
    expect(looks(game).get('2-0')!.look.hidden).toBe(false)
  })

  it('재시작으로 다시 구멍이 되는 메운 칸은 제자리에서 옅어진다', () => {
    const { game: moved } = lastMove(FILL_STAGE, ['right'])
    const { look } = looks(createState(FILL_STAGE), moved, [], 0.1, true).get('2-0')!
    expect(look.filled).toBe(true)
    expect(look.blockOpacity).toBeCloseTo(1 - smooth(0.4))
  })

  it('발판이 선 칸은 위에 발판을 얹어 그린다', () => {
    const { look, over } = looks(createState(TRAM_STAGE)).get('1-1')!
    expect(look.rail).not.toBe('')
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
    expect(cells.get('3-1')!.look.moorRange).toBe(0)
    expect(cells.get('5-2')!.look.moorRange).toBe(-1)
    expect(cells.get('2-0')!.look.post).toBeGreaterThan(0)
  })
})
