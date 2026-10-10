import { CUBE_HEAT, type Lane, cubeHeatBands, floatShownAt, rollingCubeFaces } from '../view'
import { boxFramesOf, movingBox } from './boxFrame'
import { bowlLift, brazierScene } from './brazierFrame'
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
import { fireScene } from './fireFrame'
import { burnRect, guideRect, lockRect } from './guideFrame'
import {
  iceCovers,
  iceCoversAt,
  icePhase,
  iceSink,
  laneShown,
  restartStones,
  stoneFrames,
  thawingBoxes,
} from './iceStoneFrame'
import { mushroomFrames } from './mushroomFrame'
import { cellsOf, has, playerPath, same, totalSeconds } from './pathFrame'
import { restartDrop } from './restartFrame'
import { plantTiltOf, plantedSeedAt, plantingSeed, seedFrames } from './seedFrame'
import { fadeLanes, sluiceScene, tapFronts } from './sluiceFrame'
import { boxSink, swampFrame } from './swampFrame'
import { moorLooks, tetherFrames } from './tetherFrame'
import { type SwampTime, elapsedAt, playerSegments, pullStart, stepProgress } from './timeFrame'
import { behindCube, tramBeside, tramFramesOf, tramProgress } from './tramFrame'
import { vineFrames } from './vineFrame'
import { rippleOf } from './waterFrame'
import { leanOf, pulledBeside, whirlFrames } from './whirlpoolFrame'
import { ownProgress } from './windFrame'
import { TILE, toScreen } from '@/game/iso'
import { fadedCells, occludingCells } from '@/game/occlusion'
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
  const sluice = sluiceScene({
    before,
    game,
    events,
    t,
    swamp: swampSeconds,
    moving,
    dropping,
    lanes,
  })
  const cubeCell = { x: Math.round(cube.x), y: Math.round(cube.y) }
  const whirl = whirlFrames({
    before,
    game,
    events,
    t,
    swamp: swampSeconds,
    moving,
    dropping,
    waterAt: sluice.waterAt,
  })
  // 마개 상자는 떠오르지 않고 빨려 드는 whirl 몫
  const moved = whirl.plugging ? null : movingBox(prevGame, game, events, t, chain)
  // 밀어 띄운 상자가 끌려가기 시작하면 끌린 배 그림 몫
  const handed =
    moved !== null &&
    events.some(
      (e) =>
        e.type === 'pulled' &&
        same(e.from, moved.to) &&
        elapsedAt(events, swampSeconds, t) >= pullStart(events),
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
  // 미끄러지는 수는 큐브보다 두 칸 앞까지 미리, 지나온 칸은 수가 끝날 때까지 흐린 앞 칸
  // 한 칸 미끄러지는 0.14초가 흐려지는 0.32초보다 짧은 탓
  const slid = moving
    ? playerPath(events)
        .filter((e) => e.type === 'slid')
        .flatMap((e) => {
          const dx = Math.sign(e.to.x - e.from.x)
          const dy = Math.sign(e.to.y - e.from.y)
          const gone = (cube.x - e.from.x) * dx + (cube.y - e.from.y) * dy
          return Array.from({ length: cellsOf(e) + 1 }, (_, i) => i)
            .filter((i) => i <= gone + 2)
            .map((i) => ({ x: e.from.x + dx * i, y: e.from.y + dy * i }))
        })
    : []
  const faded = [
    ...fadedCells(shown, cubeCell, Math.round(cube.level), game, filled),
    ...slid.flatMap((p) => occludingCells(shown, p, Math.round(cube.level), boxes)),
  ]

  const vineFrame = vineFrames(moving ? before : null, game, events, t, swampSeconds, dropping)

  const cubeDrop = dropping ? restartDrop(t, 0, boxes.length, game.stones.length) : null
  const tramPhase = moving ? tramProgress(events, t, swampSeconds) : 1
  const tramFrames = behindCube(
    tramFramesOf({ trams, before, game, tramPhase, fade: cubeDrop?.opacity ?? 1 }),
    cube.cell,
  )
  const nextRails = new Set(tramFrames.map((frame) => `${frame.next.x}-${frame.next.y}`))

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
    leanOf(sluice.lanes.get(`${state.player.x}-${state.player.y}`), state, state.player, whirl)
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
  const fire = fireScene({
    before,
    game,
    events,
    moving,
    dropping,
    t,
    elapsed: moving ? elapsedAt(events, swampSeconds, t) : 0,
    segments: playerSegments(events),
    tail: swampSeconds.tail,
    stepT,
  })
  const brazier = brazierScene({
    before,
    game,
    events,
    moving,
    dropping,
    t,
    stepT,
    spread: fire.spread,
    elapsed: fire.elapsed,
  })

  // 돌이 밀리고 끌리고 녹는 동안 얼고 녹는 칸, 그 위에 선 큐브가 얼음 판 높이로 내려앉는 거리
  const iceT = moving ? icePhase(events, t, swampSeconds) : 1
  const covers = moving
    ? iceCoversAt(before, game, events, t, swampSeconds)
    : iceCovers(game, game, 1)
  const iceStone = {
    covers,
    stones: dropping
      ? restartStones(game, t)
      : stoneFrames({
          prev: prevGame,
          game,
          events,
          t,
          swamp: swampSeconds,
          waterAt: sluice.waterAt,
        }),
    thawing: moving ? thawingBoxes(before, game, iceT) : [],
    lanes: fadeLanes(laneShown(sluice.lanes, before, game, iceT), sluice.laneFade),
  }

  const cubeSink =
    standSink(crackView, cube.x, cube.y) +
    iceSink(covers, game, cube.x, cube.y) -
    bowlLift(stage, cube.x, cube.y)
  const cubeFaces = rollingCubeFaces(cube.x, cube.y, cubeLevel, cube.direction, cube.angle)
  const { glow } = brazier
  const cubeHeat =
    glow.strength > 0
      ? cubeHeatBands(
          cube.x,
          cube.y,
          cubeLevel,
          cube.direction,
          cube.angle,
          CUBE_HEAT.band * glow.height,
        )
      : []
  const carriedBase = carriedBaseOf(cubeScreen, cubeSink, cube)
  const rolling = rollingTilt(cube, chain)
  const bump = carriedTilt({ events, moving, t, swampSeconds, cube, rolling })
  const ladderBump = ladderTilt(bump)
  const planting = moving ? plantingSeed(events, t, swampSeconds) : null
  const plantedSeed = plantedSeedAt({ planting, cubeScreen, cubeSink, cube })
  const plantTilt = plantTiltOf(planting, cube)
  const caps = mushroomFrames(dropping ? null : prevGame, game, events, t, chain).map((cap) =>
    // 재시작하며 다시 펴는 시든 버섯
    dropping && prevGame && !has(prevGame.mushrooms, cap.cell) && has(game.mushrooms, cap.cell)
      ? { ...cap, wither: 1 - smooth(t) }
      : cap,
  )
  const iceDrop = box ? iceSink(covers, game, box.x, box.y) : 0
  const bowl = box ? bowlLift(stage, box.x, box.y) : 0
  const boxFrames = boxFramesOf({ box, sinkingBox, tramFrames, boxes, crackView, iceDrop, bowl })
  const boxShown = box ? floatShownAt(stage, box, sluice.waterAt) : null
  const tethers = tetherFrames({ prev: moving ? prevGame : null, game, box, t, dropping })
  const moor = moorLooks(stage, tethers)
  const guide = guideCell ? (stage.rules?.burnBox ? burnRect : guideRect)(game, guideCell) : null
  const lockGuide = guideCell && stage.rules?.lock ? lockRect(game) : null
  const still = (list: Point[], moved: Point[]) =>
    list.filter((p) => !has(moved, p)).map((p) => ({ ...p, cell: p }))
  const taps = tapFronts(stage, [
    { x: cube.x, y: cube.y, cell: cube.cell },
    ...(box ? [{ x: box.x, y: box.y, cell: box.cell }] : []),
    ...still(game.boxes, box ? [box.to] : []),
    ...still(
      game.stones,
      iceStone.stones.map((s) => s.to),
    ),
  ])

  // 집에 드는 때, 물이 바뀌어도 집 칸이 그대로인 수는 큐브가 닿자마자 물은 클리어 카드 뒤에서 이어짐
  const flood = events.find((e) => e.type === 'sluice')
  const early = flood?.type === 'sluice' && !flood.cells.some((p) => same(p, stage.goal))
  const home =
    game.cleared &&
    (!moving ||
      (early &&
        elapsedAt(events, swampSeconds, t) >=
          totalSeconds(playerSegments(events)) + swampSeconds.tail))

  return {
    moving,
    home,
    before,
    dropping,
    progress,
    stepT,
    ownT,
    pickUpPhase,
    crackPhase,
    tramPhase,
    // 같은 깊이 옆 칸으로 끌려가는 배와 돌이 큐브 아래를 덮지 않는 순서
    cube:
      pulledBeside([...whirl.boxes, ...iceStone.stones.filter((s) => s.pulled)], cube.cell) ||
      tramBeside(tramFrames, cube.cell)
        ? { ...cube, last: true }
        : cube,
    cubeCell,
    cubeLean,
    rowLean,
    cubeDrop,
    cubeLevel,
    cubeScreen,
    cubeSquash,
    cubeSink,
    cubeFaces,
    cubeHeat,
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
    iceStone,
    lanes: sluice.lanes,
    sluice,
    crackView,
    fire,
    brazier,
    seedFrame,
    faded,
    vineFrame,
    tramFrames,
    nextRails,
    caps,
    guide,
    lockGuide,
    taps,
  }
}
