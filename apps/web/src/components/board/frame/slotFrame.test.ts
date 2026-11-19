import { describe, expect, it } from 'vitest'

import { pullLanes } from '../view'
import { boardCells } from './cellFrame'
import { cellLook } from './cellLookFrame'
import { NO_CHAIN } from './curveFrame'
import { sceneFrame } from './sceneFrame'
import { bridgeLooks } from './shadowFrame'
import { slotFrame, slotOf } from './slotFrame'
import { swampTime } from './swampFrame'
import { createState, move } from '@/game/rules'
import type { Direction, GameEvent, GameState, Stage } from '@/game/types'

// 판 그리기와 같은 순서로 모은 그 순간 칸 값
const slotsOf = (game: GameState, prevGame: GameState | null, events: GameEvent[], t: number) => {
  const { stage } = game
  const swampSeconds = swampTime(prevGame, game)
  const base = { game, prevGame, events, prevEvents: [], restarting: false, swampSeconds }
  const scene = sceneFrame({
    ...base,
    t,
    chain: NO_CHAIN,
    trams: [],
    filled: [],
    lanes: pullLanes(stage),
  })
  const bridges = bridgeLooks(stage)
  const railDirs = new Map<string, string>()
  const bare = [...bridges.keys()].join(' ')
  const cells = boardCells(game.heights, scene.before.heights, railDirs, new Map(), null, bare)
  const lookOf = cellLook({
    stage,
    game,
    events,
    t,
    swampSeconds,
    fillingKey: null,
    railDirs,
    scene,
    ambient: null,
  })
  const frame = slotFrame({
    game,
    prevGame,
    events,
    guideNight: null,
    guideFrom: null,
    beat: null,
    bridges,
    lookOf,
    t,
    scene,
    cells,
  })
  return {
    frame,
    slot: (key: string) =>
      slotOf(
        frame,
        cells.find((c) => c.key === key)!,
      ),
  }
}

const after = (stage: Stage, dirs: Direction[]) => {
  let prev = createState(stage)
  let result = { state: prev, events: [] as GameEvent[] }
  for (const dir of dirs) {
    prev = result.state
    result = move(prev, dir)
  }
  return { prev, game: result.state, events: result.events }
}

const LINE: Stage = {
  version: 1,
  id: 'test-slot-frame',
  heights: [[0, 0, 0, 0, 0]],
  start: { x: 0, y: 0 },
  goal: { x: 4, y: 0 },
  entities: [],
}

// 21월드부터 도는 어둠 박자, 2칸 다리 하나
const NIGHT: Stage = {
  version: 1,
  id: '21-97',
  heights: [[0, 0, -1, 0, 0, 0, 0, 0]],
  shadow: ['..0.....'],
  start: { x: 0, y: 0 },
  goal: { x: 7, y: 0 },
  entities: [],
}

describe('slotFrame', () => {
  it('밝은 판은 어둠 막과 덮개 없음', () => {
    const { prev, game, events } = after(LINE, ['right'])
    const { frame, slot } = slotsOf(game, prev, events, 0.5)

    expect(frame.night).toBeNull()
    expect(frame.covers).toEqual([])
    expect(slot('3-0').veil).toBeNull()
  })

  it('큐브를 그리는 칸만 장면 값으로 얹어 그림', () => {
    const { prev, game, events } = after(LINE, ['right'])
    const { slot } = slotsOf(game, prev, events, 0.5)

    expect(slot('1-0').content).toBe(true)
    expect(slot('3-0').content).toBe(false)
  })

  it('어둠에는 칸마다 막, 다리 진하기는 다리 칸에만', () => {
    const { prev, game, events } = after(NIGHT, ['right', 'left', 'right', 'left'])
    const { frame, slot } = slotsOf(game, prev, events, 1)

    expect(frame.night?.bridge).toBeGreaterThan(0)
    expect(slot('2-0').shownBridge).toBe(frame.night?.bridge)
    expect(slot('4-0').shownBridge).toBe(0)
    expect(slot('4-0').veil).not.toBeNull()
    expect(frame.playerCover).not.toBeNull()
  })
})
