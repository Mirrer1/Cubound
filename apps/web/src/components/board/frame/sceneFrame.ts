import { type Lane, floatShownAt, rollingCubeFaces } from '../view'
import { boxFramesOf, movingBox } from './boxFrame'
import {
  carriedBaseOf,
  carriedOpacityOf,
  carriedTilt,
  ladderTilt,
  pickUpProgress,
  rollingTilt,
} from './carryFrame'
import { crackProgress, standSink } from './crackFrame'
import { SLIDE_DEG, playerFrame, squashTransform } from './cubeFrame'
import { type Chain, smooth } from './curveFrame'
import { guideRect } from './guideFrame'
import { mushroomFrames } from './mushroomFrame'
import { restartDrop } from './restartFrame'
import { plantTiltOf, plantedSeedAt, plantingSeed, seedFrames } from './seedFrame'
import { boxSink, swampFrame } from './swampFrame'
import { moorLooks, tetherFrames } from './tetherFrame'
import { type SwampTime, elapsedAt, pullStart, same, stepProgress } from './timeFrame'
import { tramFramesOf, tramProgress } from './tramFrame'
import { vineFrames } from './vineFrame'
import { rippleOf } from './waterFrame'
import { leanOf, pulledBeside, whirlFrames } from './whirlpoolFrame'
import { ownProgress } from './windFrame'
import { TILE, toScreen } from '@/game/iso'
import { fadedCells } from '@/game/occlusion'
import type { GameEvent, GameState, Point, Tram } from '@/game/types'

interface SceneView {
  game: GameState
  prevGame: GameState | null
  events: GameEvent[]
  t: number
  chain: Chain
  restarting: boolean
  swampSeconds: SwampTime
  trams: Tram[]
  filled: Point[]
  lanes: Map<string, Lane>
  guideCell?: Point
}

// 그 순간 판 전체의 연출 값
export const sceneFrame = ({
  game,
  prevGame,
  events,
  t,
  chain,
  restarting,
  swampSeconds,
  trams,
  filled,
  lanes,
  guideCell,
}: SceneView) => {
  const moving = t < 1 && prevGame !== null
  const before = moving ? prevGame : game
  const dropping = restarting && t < 1

  const { stage, heights, boxes } = game
  // 재시작은 처음 자리에 새로 내려앉는 것이라 넘기지 않는 앞 상태
  const cube = playerFrame(dropping ? null : prevGame, game, events, t, chain)
  const cubeCell = { x: Math.round(cube.x), y: Math.round(cube.y) }
  const whirl = whirlFrames({ before, game, events, t, swamp: swampSeconds, moving, dropping })
  // 마개 상자는 떠오르지 않고 빨려 드는 whirl 몫
  const moved = whirl.plugging ? null : movingBox(prevGame, game, events, t, chain)
  // 밀어 띄운 상자가 끌려가기 시작하면 끌린 배 그림 몫
  const handed =
    moved !== null &&
    events.some(
      (e) =>
        e.type === 'pulled' &&
        same(e.from, moved.to) &&
        elapsedAt(events, swampSeconds, t) >= pullStart(events, e),
    )
  const box = handed ? null : moved
  const sunk = swampFrame(dropping ? null : prevGame, game, events, t)
  const sinkingBox = boxSink(events, swampSeconds, t)
  const ripple = moving && !whirl.plugging ? rippleOf(events, t, swampSeconds) : null
  const pickedUp = moving ? events.find((e) => e.type === 'pickedUp') : undefined
  const placed = moving ? events.find((e) => e.type === 'placed') : undefined

  const seedFrame = seedFrames(moving ? before : null, game, events, t, swampSeconds, dropping)
  // 솟는 씨앗 칸은 그 순간 높이로 재는 가림, 다 솟기 전 앞 칸은 흐리기 제외
  const shown = heights.map((row, y) =>
    row.map((h, x) => {
      const frame = seedFrame.get(`${x}-${y}`)
      return frame ? Math.round(frame.level) : h
    }),
  )
  // 가림 처리도 지금 그려지는 자리 기준, 순간이동으로 가라앉는 큐브가 벽에 묻히는 탓
  const faded = fadedCells(shown, cubeCell, Math.round(cube.level), game, filled)

  const vineFrame = vineFrames(moving ? before : null, game, events, t, swampSeconds, dropping)

  const tramPhase = moving ? tramProgress(events, t, swampSeconds) : 1
  const tramFrames = tramFramesOf({ trams, before, game, tramPhase })
  const nextRails = new Set(tramFrames.map((frame) => `${frame.next.x}-${frame.next.y}`))

  const cubeDrop = dropping ? restartDrop(t, 0, boxes.length) : null
  const cubeLevel = cube.level + (cubeDrop?.lift ?? 0)
  const cubeScreen = toScreen({ x: cube.x, y: cube.y }, cubeLevel)
  // 칸 윗면보다 반 층 위인 큐브 가운데
  const cubeSquash =
    cube.squash > 0
      ? squashTransform(
          cubeScreen.x,
          cubeScreen.y - TILE.layer / 2,
          cube.direction === 'up' || cube.direction === 'down' ? -SLIDE_DEG : SLIDE_DEG,
          cube.squash,
        )
      : ''
  // 한 수 안에서 일어나는 변화의 진행도, 씨앗이 솟는 수는 이동 몫이 먼저 끝나는 탓
  const stepT = moving ? stepProgress(events, t, swampSeconds) : 1
  // 놓는 사다리는 바람이 불기 전에 다 놓이는 진행도
  const ownT = moving ? ownProgress(events, t, swampSeconds) : 1
  // 사다리가 손으로 옮겨지기 시작하는 때, 큐브가 그 칸에 닿은 때
  const pickUpPhase = moving ? pickUpProgress(events, t, swampSeconds) : 1
  const carriedOpacity = carriedOpacityOf({ pickedUp, placed, game, pickUpPhase, ownT })
  const carried = game.carrying ?? before.carrying
  const progress = moving ? t : 1
  // 소용돌이 앞 흔들리는 배에 탄 큐브의 쏠림, 오르는 수에 차오르고 저어 떠나는 수에 배와 같이 풀림
  const leanAt = (state: GameState) =>
    leanOf(lanes.get(`${state.player.x}-${state.player.y}`), state, state.player, whirl)
  const riding = leanAt(game)
  const left = moving && !same(before.player, game.player) ? leanAt(before) : null
  const boarding = moving && riding !== null && !same(before.player, game.player)
  const cubeLean = riding
    ? { toward: riding, amp: boarding ? smooth(progress) : 1 }
    : left
      ? { toward: left, amp: 1 - smooth(progress) }
      : null
  const rowed = events.some((e) => e.type === 'rowed' && same(e.from, before.player))
  const rowLean = left && rowed ? cubeLean : null

  const crackPhase = moving ? crackProgress(events, stepT) : 1
  const crackView = { game, before, crackPhase }

  const cubeSink = standSink(crackView, cube.x, cube.y)
  const cubeFaces = rollingCubeFaces(cube.x, cube.y, cubeLevel, cube.direction, cube.angle)
  const carriedBase = carriedBaseOf(cubeScreen, cubeSink, cube)
  const rolling = rollingTilt(cube, chain)
  const bump = carriedTilt({ events, moving, t, swampSeconds, cube, rolling })
  const ladderBump = ladderTilt(bump)
  const planting = moving ? plantingSeed(events, t, swampSeconds) : null
  const plantedSeed = plantedSeedAt({ planting, cubeScreen, cubeSink, cube })
  const plantTilt = plantTiltOf(planting, cube)
  const caps = mushroomFrames(dropping ? null : prevGame, game, events, t, chain)
  const boxFrames = boxFramesOf({ box, sinkingBox, tramFrames, boxes, crackView })
  const boxShown = box ? floatShownAt(stage, box) : null
  const tethers = tetherFrames({ prev: moving ? prevGame : null, game, box, t, dropping })
  const moor = moorLooks(stage, tethers)
  const guide = guideCell ? guideRect(game, guideCell) : null

  return {
    moving,
    before,
    dropping,
    progress,
    stepT,
    ownT,
    pickUpPhase,
    crackPhase,
    tramPhase,
    // 같은 깊이 옆 칸으로 끌려가는 배가 큐브 아래를 덮지 않는 순서
    cube: pulledBeside(whirl.boxes, cube.cell) ? { ...cube, last: true } : cube,
    cubeCell,
    cubeLean,
    rowLean,
    cubeDrop,
    cubeLevel,
    cubeScreen,
    cubeSquash,
    cubeSink,
    cubeFaces,
    pickedUp,
    placed,
    carried,
    carriedOpacity,
    carriedBase,
    bump,
    ladderBump,
    plantedSeed,
    plantTilt,
    box,
    boxFrames,
    boxShown,
    sinkingBox,
    sunk,
    ripple,
    tethers,
    moor,
    whirl,
    lanes,
    crackView,
    seedFrame,
    faded,
    vineFrame,
    tramFrames,
    nextRails,
    caps,
    guide,
  }
}
