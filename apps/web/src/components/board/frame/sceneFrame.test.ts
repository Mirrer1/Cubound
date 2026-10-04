import { describe, expect, it } from 'vitest'

import { movingBox } from './boxFrame'
import { playerFrame } from './cubeFrame'
import { NO_CHAIN } from './curveFrame'
import { restartDrop } from './restartFrame'
import { sceneFrame } from './sceneFrame'
import { swampTime } from './swampFrame'
import { lastMove } from './testStages'
import { tetherFrames } from './tetherFrame'
import { TILE, toScreen } from '@/game/iso'
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

  it('가이드 칸에 무엇이 서 있으면 위쪽 여유를 두 층 잡는다', () => {
    const game = createState(BOX_STAGE)
    const onBox = sceneOf(game, null, [], 1, { guideCell: { x: 1, y: 0 } })
    expect(onBox.guideScreen).toEqual(toScreen({ x: 1, y: 0 }, 0))
    expect(onBox.guideTop).toBe(TILE.layer * 2)
    const empty = sceneOf(game, null, [], 1, { guideCell: { x: 3, y: 0 } })
    expect(empty.guideTop).toBe(0)
    expect(sceneOf(game, null, [], 1).guideScreen).toBeNull()
  })
})
