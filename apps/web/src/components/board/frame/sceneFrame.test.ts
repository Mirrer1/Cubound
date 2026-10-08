import { describe, expect, it } from 'vitest'

import { pullLanes } from '../view'
import { movingBox } from './boxFrame'
import { playerFrame } from './cubeFrame'
import { NO_CHAIN } from './curveFrame'
import { guideRect } from './guideFrame'
import { SECONDS } from './pathFrame'
import { restartDrop } from './restartFrame'
import { sceneFrame } from './sceneFrame'
import { swampTime } from './swampFrame'
import { LOCK_STAGE, PLUG_STAGE, SLUICE_STAGE, WHIRL_STAGE, lastMove } from './testStages'
import { tetherFrames } from './tetherFrame'
import { SLUICE, durationOf, sluiceStart } from './timeFrame'
import { createState } from '@/game/rules'
import type { GameEvent, GameState, Point, Stage } from '@/game/types'

// (1,0) 상자를 오른쪽으로 미는 판
const BOX_STAGE: Stage = {
  version: 1,
  id: 'test-scene-frame',
  heights: [[0, 0, 0, 0, 0]],
  start: { x: 0, y: 0 },
  goal: { x: 4, y: 0 },
  entities: [{ type: 'box', x: 1, y: 0 }],
}

const sceneOf = (
  game: GameState,
  prevGame: GameState | null,
  events: GameEvent[],
  t: number,
  more: { restarting?: boolean; guideCell?: Point } = {},
) =>
  sceneFrame({
    game,
    prevGame,
    events,
    t,
    chain: NO_CHAIN,
    restarting: more.restarting ?? false,
    swampSeconds: swampTime(prevGame, game),
    trams: [],
    filled: [],
    lanes: pullLanes(game.stage),
    guideCell: more.guideCell,
  })

describe('sceneFrame', () => {
  it('멈춘 판은 진행이 끝난 값과 지금 상태를 모은다', () => {
    const game = createState(BOX_STAGE)
    const scene = sceneOf(game, null, [], 1)
    expect(scene.moving).toBe(false)
    expect(scene.before).toBe(game)
    expect(scene.progress).toBe(1)
    expect(scene.stepT).toBe(1)
    expect(scene.box).toBeNull()
    expect(scene.cube).toEqual(playerFrame(null, game, [], 1, NO_CHAIN))
    expect(scene.cubeCell).toEqual({ x: 0, y: 0 })
  })

  it('움직이는 중에는 앞 상태와 요소 frame 결과를 그 순간 값으로 모은다', () => {
    const { prev, game, events } = lastMove(BOX_STAGE, ['right'])
    const scene = sceneOf(game, prev, events, 0.5)
    expect(scene.moving).toBe(true)
    expect(scene.before).toBe(prev)
    expect(scene.progress).toBe(0.5)
    expect(scene.cube).toEqual(playerFrame(prev, game, events, 0.5, NO_CHAIN))
    expect(scene.box).toEqual(movingBox(prev, game, events, 0.5, NO_CHAIN))
    expect(scene.tethers).toEqual(
      tetherFrames({ prev, game, box: scene.box, t: 0.5, dropping: false }),
    )
  })

  it('재시작으로 내려앉는 동안은 앞 상태 없이 큐브를 들어 올린 높이로 둔다', () => {
    const { game: moved } = lastMove(BOX_STAGE, ['right'])
    const game = createState(BOX_STAGE)
    const scene = sceneOf(game, moved, [], 0.5, { restarting: true })
    const drop = restartDrop(0.5, 0, game.boxes.length)
    expect(scene.dropping).toBe(true)
    expect(scene.cubeDrop).toEqual(drop)
    expect(scene.cube).toEqual(playerFrame(null, game, [], 0.5, NO_CHAIN))
    expect(scene.cubeLevel).toBe(scene.cube.level + drop.lift)
  })

  it('재시작 연출이 끝나면 내려앉는 값이 없다', () => {
    const game = createState(BOX_STAGE)
    const scene = sceneOf(game, game, [], 1, { restarting: true })
    expect(scene.dropping).toBe(false)
    expect(scene.cubeDrop).toBeNull()
  })

  it('가이드 칸이 있으면 그 칸의 사각형, 없으면 null을 낸다', () => {
    const game = createState(BOX_STAGE)
    const scene = sceneOf(game, null, [], 1, { guideCell: { x: 1, y: 0 } })
    expect(scene.guide).toEqual(guideRect(game, { x: 1, y: 0 }))
    expect(sceneOf(game, null, [], 1).guide).toBeNull()
  })
})

describe('sceneFrame 마개', () => {
  it('마개 수의 상자는 떠오르는 상자 연출과 고리 대신 빨려 드는 상자로 그린다', () => {
    const { prev, game, events } = lastMove(PLUG_STAGE, ['down'])
    const scene = sceneOf(game, prev, events, 0.5)

    expect(scene.box).toBeNull()
    expect(scene.ripple).toBeNull()
    expect(scene.whirl.boxes.map((frame) => frame.to)).toEqual([{ x: 1, y: 2 }])
  })
})

describe('sceneFrame 끌린 배', () => {
  it('밀어 띄운 상자는 끌려가기 시작하면 끌린 배 그림이 이어받는다', () => {
    const stage: Stage = { ...WHIRL_STAGE, start: { x: 5, y: 3 } }
    const { prev, game, events } = lastMove(stage, ['up'])
    const at = (t: number) => sceneOf(game, prev, events, t)

    expect(at(0.2).box).not.toBeNull()
    expect(at(0.7).box).toBeNull()
  })

  // 물 높이 1, x 1 세로줄이 물이고 (1,3) 소용돌이, (1,1) 배에 탄 큐브가 오른쪽 땅으로 내리는 판
  const DISMOUNT_STAGE: Stage = {
    version: 1,
    id: 'test-scene-dismount',
    heights: [
      [1, 0, 1],
      [1, 0, 1],
      [1, 0, 1],
      [1, 0, 1],
    ],
    water: 1,
    start: { x: 0, y: 1 },
    goal: { x: 2, y: 3 },
    entities: [
      { type: 'whirlpool', x: 1, y: 3 },
      { type: 'box', x: 1, y: 1 },
    ],
  }

  // 물 높이 1, (1,0) 소용돌이 앞 (1,1)에 멈춘 배, 큐브는 (0,1) 땅에서 오르고 아래 (1,2)로 저어 감
  const LEAN_STAGE: Stage = {
    ...DISMOUNT_STAGE,
    id: 'test-scene-lean',
    heights: [
      [1, 0, 1],
      [1, 0, 1],
      [1, 0, 1],
      [1, 1, 1],
    ],
    entities: [
      { type: 'whirlpool', x: 1, y: 0 },
      { type: 'box', x: 1, y: 1 },
    ],
  }

  it('소용돌이 앞 흔들리는 배에 오르는 동안 큐브 쏠림이 차오르고 탄 채로는 그대로 쏠린다', () => {
    const { prev, game, events } = lastMove(LEAN_STAGE, ['right'])

    expect(sceneOf(game, prev, events, 0.5).cubeLean).toEqual({ toward: 'up', amp: 0.5 })
    expect(sceneOf(game, null, [], 1).cubeLean).toEqual({ toward: 'up', amp: 1 })
    expect(sceneOf(createState(LEAN_STAGE), null, [], 1).cubeLean).toBeNull()
  })

  it('탄 채 저어 떠나는 동안 큐브와 배의 쏠림이 같이 풀린다', () => {
    const { prev, game, events } = lastMove(LEAN_STAGE, ['right', 'down'])
    const scene = sceneOf(game, prev, events, 0.5)

    expect(scene.cubeLean).toEqual({ toward: 'up', amp: 0.5 })
    expect(scene.rowLean).toEqual(scene.cubeLean)
    expect(sceneOf(game, null, [], 1).rowLean).toBeNull()
  })

  it('큐브가 내린 배가 같은 깊이 옆 칸으로 끌려가는 동안 큐브는 같은 깊이 맨 뒤에 그린다', () => {
    const { prev, game, events } = lastMove(DISMOUNT_STAGE, ['right', 'right'])

    expect(sceneOf(game, prev, events, 0.8).cube.last).toBe(true)
    expect(sceneOf(game, null, [], 1).cube.last).toBeFalsy()
  })
})

describe('sceneFrame 수위', () => {
  it('장치에서 배로 내려선 큐브는 배에 앉은 뒤 수면과 같이 내려간다', () => {
    const { prev, game, events } = lastMove(SLUICE_STAGE, ['left', 'down'])
    const at = (seconds: number) => sceneOf(game, prev, events, seconds / durationOf(events))
    const start = sluiceStart(events)!

    expect(at(start).cubeLevel).toBeCloseTo(2)
    expect(at(start + SLUICE.tap + SLUICE.level / 2).cubeLevel).toBeCloseTo(1.5)
    expect(at(start + SLUICE.tap + SLUICE.level / 2).sluice.waterAt(game.player)).toBeCloseTo(1.5)
    expect(at(durationOf(events)).cubeLevel).toBeCloseTo(1)
  })

  it('갑문 판의 가이드는 장치와 물길이 닿는 두 웅덩이 칸을 같이 감싼다', () => {
    const game = createState(LOCK_STAGE)
    const scene = sceneOf(game, null, [], 1, { guideCell: { x: 3, y: 1 } })
    const pools = [2, 3, 4].map((x) => guideRect(game, { x, y: 1 }))

    expect(scene.lockGuide).not.toBeNull()
    for (const rect of pools) {
      expect(scene.lockGuide!.x).toBeLessThanOrEqual(rect.x)
      expect(scene.lockGuide!.y).toBeLessThanOrEqual(rect.y)
      expect(scene.lockGuide!.x + scene.lockGuide!.width).toBeGreaterThanOrEqual(
        rect.x + rect.width,
      )
      expect(scene.lockGuide!.y + scene.lockGuide!.height).toBeGreaterThanOrEqual(
        rect.y + rect.height,
      )
    }
    expect(
      sceneOf(createState(SLUICE_STAGE), null, [], 1, { guideCell: { x: 0, y: 0 } }).lockGuide,
    ).toBeNull()
  })
})

describe('sceneFrame 집', () => {
  // 높이 2 길 끝 (4,0) 집, 아래 줄은 잠기는 줄이라 넷째 수에 밀물이 참
  const TIDE_HOME: Stage = {
    ...BOX_STAGE,
    heights: [
      [2, 2, 2, 2, 2],
      [1, 1, 1, 1, 1],
    ],
    water: 1,
    rules: { tide: true },
    start: { x: 0, y: 0 },
    goal: { x: 4, y: 0 },
    entities: [],
  }

  it('집에 닿는 수에 물이 바뀌어도 집이 안 잠기면 큐브는 닿자마자 집에 든다', () => {
    const { prev, game, events } = lastMove(TIDE_HOME, ['right', 'right', 'right', 'right'])
    const at = (seconds: number) => seconds / durationOf(events)

    expect(game.cleared).toBe(true)
    expect(events.some((e) => e.type === 'sluice')).toBe(true)
    expect(sceneOf(game, prev, events, at(SECONDS.moved / 2)).home).toBe(false)
    expect(sceneOf(game, prev, events, at(SECONDS.moved + 0.02)).home).toBe(true)
    expect(sceneOf(game, prev, events, at(SECONDS.moved + 0.02)).moving).toBe(true)
  })

  it('물이 그대로인 수는 수가 다 끝난 뒤 집에 든다', () => {
    const { prev, game, events } = lastMove(BOX_STAGE, ['right', 'right', 'right', 'right'])

    expect(game.cleared).toBe(true)
    expect(sceneOf(game, prev, events, 0.99).home).toBe(false)
    expect(sceneOf(game, prev, events, 1).home).toBe(true)
  })
})
