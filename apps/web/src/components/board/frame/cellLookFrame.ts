import { postBands, waterLook } from '../view'
import type { boardCells } from './cellFrame'
import { crackFrame, crackLeft, sinkAt } from './crackFrame'
import { clamp01, lerp, smooth } from './curveFrame'
import { wallHeight } from './fillFrame'
import { frostAt } from './iceFrame'
import { restartDrop } from './restartFrame'
import type { sceneFrame } from './sceneFrame'
import { pressProgress, switchCells, switchProgress } from './switchFrame'
import { type SwampTime, has, same } from './timeFrame'
import { TILE } from '@/game/iso'
import { isDoorOpen, isIce, isLiftRaised } from '@/game/rules'
import type { Entity, GameEvent, GameState, Point, Stage } from '@/game/types'

// 재시작에 메운 바닥이 사라지는 진행도
const RESTORE_FADE = 0.25

interface CellLookView {
  stage: Stage
  game: GameState
  events: GameEvent[]
  t: number
  swampSeconds: SwampTime
  fillingKey: string | null
  railDirs: Map<string, string>
  scene: ReturnType<typeof sceneFrame>
}

// 칸 하나에 넘길 값, over는 칸 위에 얹어 그릴 것
export const cellLook = (
  { stage, game, events, t, swampSeconds, fillingKey, railDirs, scene }: CellLookView,
  cell: ReturnType<typeof boardCells>[number],
) => {
  const { heights, boxes, ladders, leaningLadders } = game
  const walls = { heights, before: scene.before, fillingKey, vineFrame: scene.vineFrame, railDirs }
  // 문과 발판이 움직이기 시작하는 때, 스위치가 눌리거나 풀린 때
  const linkedPhase = (cells: Point[], pressed: boolean) =>
    scene.moving ? switchProgress(events, cells, pressed, t, swampSeconds) : 1
  const entity = stage.entities.find((e) => same(e, cell.p))
  const pressed = (state: GameState) => same(state.player, cell.p) || has(state.boxes, cell.p)
  const doorDepth = (state: GameState) =>
    entity?.type === 'door' && isDoorOpen(state, entity.id) ? 0 : TILE.layer
  // 상자가 얹힌 칸도 찾도록 entity와 따로 보는 발판
  const lift = stage.entities.find(
    (e): e is Extract<Entity, { type: 'lift' }> => e.type === 'lift' && same(e, cell.p),
  )
  const liftLevel = (state: GameState) =>
    lift !== undefined && isLiftRaised(state, lift.id) ? 1 : 0
  const warp = stage.entities.find(
    (e): e is Extract<Entity, { type: 'warp' }> => e.type === 'warp' && same(e, cell.p),
  )
  const capHere = scene.caps.find((capFrame) => same(capFrame.cell, cell.p))
  const water = waterLook(stage, cell.p)
  const rippleHere = scene.ripple && same(scene.ripple.at, cell.p) ? scene.ripple : null
  const swampHere = (stage.swamp?.[cell.p.y]?.[cell.p.x] ?? '.') !== '.'
  // 상자가 가라앉는 동안 남는 진흙, 그 위로 드러나는 메운 자리
  const swamp = swampHere && (has(game.swamps, cell.p) || has(scene.before.swamps, cell.p))
  const sunkHere = scene.sunk && same(scene.sunk.cell, cell.p) ? scene.sunk : null
  const sinkingHere =
    scene.sinkingBox && same(scene.sinkingBox.at, cell.p) ? scene.sinkingBox : null
  const left = crackLeft(game, cell.p)
  const was = crackLeft(scene.before, cell.p)
  // 상자가 만든 바닥, 처음부터 구멍이던 칸과 무너진 뒤 메워진 칸
  const wasCrack = (stage.cracks?.[cell.p.y]?.[cell.p.x] ?? '.') !== '.'
  const isFilled =
    game.heights[cell.p.y][cell.p.x] >= 0 &&
    (stage.heights[cell.p.y][cell.p.x] < 0 || (wasCrack && left < 0))
  const crumble = crackFrame(was, left, scene.crackPhase)
  const liftPhase =
    lift === undefined ? 1 : linkedPhase(switchCells(stage, lift.id), isLiftRaised(game, lift.id))
  const switchPhase =
    entity?.type === 'switch' && scene.moving
      ? pressProgress(events, cell.p, pressed(game), t, swampSeconds)
      : scene.progress
  const doorPhase =
    entity?.type === 'door'
      ? linkedPhase([...switchCells(stage, entity.id), cell.p], isDoorOpen(game, entity.id))
      : scene.progress
  const raised = lerp(liftLevel(scene.before), liftLevel(game), liftPhase)
  const crackFall = crumble.fall * TILE.layer
  // 솟거나 재시작으로 내려가는 씨앗 칸은 그 순간 높이
  const seedHere = scene.seedFrame.get(cell.key)
  const seedShift = seedHere ? cell.h - seedHere.level : 0
  const cellY =
    cell.y -
    raised * TILE.layer +
    sinkAt(scene.crackView, cell.p) +
    crackFall +
    seedShift * TILE.layer
  const pickedHere = scene.pickedUp?.type === 'pickedUp' && same(scene.pickedUp.at, cell.p)
  const flatLadder = has(ladders, cell.p)
    ? 1
    : pickedHere && has(scene.before.ladders, cell.p)
      ? 1 - scene.pickUpPhase
      : 0
  const placedOpacity = (l: Point) =>
    scene.placed?.type === 'placed' && same(scene.placed.ladder, l) ? scene.ownT : 1
  const leaning = [
    ...leaningLadders
      .filter((l) => same(l, cell.p))
      .map((l) => `${l.direction}:${placedOpacity(l)}`),
    ...(pickedHere
      ? scene.before.leaningLadders
          .filter((l) => same(l, cell.p))
          .map((l) => `${l.direction}:${1 - scene.pickUpPhase}`)
      : []),
  ].join('|')

  // 상자가 먼저 메운 길 칸은 덩굴이 못 자라 싹 제외
  const vineHere = scene.vineFrame.get(cell.key)
  const vine =
    vineHere && (cell.pit || vineHere.kind === 'grown' || vineHere.kind === 'root')
      ? vineHere
      : null
  // 판이 차오르거나 내려가는 칸의 드러나는 구덩이 벽
  const pitShown = cell.pit || (vine?.kind === 'grown' && vine.rise < 1)

  const tram = scene.tramFrames.find((frame) => same(frame.cell, cell.p)) ?? null
  const drawCube = same(scene.cube.cell, cell.p) && !(game.cleared && !scene.moving)
  const drawBoxes = scene.boxFrames.filter((frame) => same(frame.cell, cell.p))
  const movedBoxHere = scene.boxFrames.some((frame) => same(frame.to, cell.p))
  const goalEffect = same(cell.p, stage.goal) && game.cleared && !scene.moving
  const droppingBox = scene.dropping ? boxes.findIndex((b) => same(b, cell.p)) : -1
  const boxDrop = droppingBox >= 0 ? restartDrop(t, droppingBox + 1, boxes.length) : null
  // 재시작하면 제자리에서 사라지는 메운 칸, 큐브와 같은 빠르기로 돌아오는 무너졌던 칸
  const restored =
    scene.dropping && !seedHere
      ? Math.sign(scene.before.heights[cell.p.y][cell.p.x] - heights[cell.p.y][cell.p.x])
      : 0
  const overlay =
    drawBoxes.length > 0 || drawCube || goalEffect || boxDrop !== null || tram !== null

  return {
    cellY,
    look: {
      x: cell.x,
      y: cellY,
      h: cell.h - seedShift + raised,
      parity: (cell.p.x + cell.p.y) % 2 === 1,
      goal: same(cell.p, stage.goal),
      filled:
        (isFilled || (restored > 0 && stage.heights[cell.p.y][cell.p.x] < 0)) &&
        vine?.kind !== 'grown',
      ice: isIce(game, cell.p),
      frost: frostAt(events, cell.p, t, swampSeconds),
      crack: Math.max(left, was) >= 0,
      crackStage: crumble.stage,
      crackBroken: crumble.broken,
      crackFall,
      crackShadow: crumble.shadow,
      crackSeed: (cell.p.x * 3 + cell.p.y * 5) % 4,
      hidden: isFilled && movedBoxHere && scene.before.heights[cell.p.y][cell.p.x] < 0,
      swamp,
      swampFilled: swampHere && !has(game.swamps, cell.p) ? (sinkingHere?.filled ?? 1) : 0,
      swampRisen: sunkHere ? sunkHere.risen : -1,
      swampDeep: sunkHere?.deep ?? sinkingHere?.deep ?? 0,
      mushroom: capHere !== undefined,
      mushroomPress: capHere?.press ?? 0,
      mushroomWither: capHere?.wither ?? 0,
      water: water.depth,
      waterBankX: water.bankX,
      waterBankY: water.bankY,
      waterSideLeft: water.sideLeft,
      waterSideRight: water.sideRight,
      waterRing: rippleHere?.size ?? 0,
      waterRingOpacity: rippleHere?.opacity ?? 0,
      moorRange: scene.moor.get(cell.key) ?? -1,
      post: postBands(stage, cell.p),
      faded: has(scene.faded, cell.p),
      entity: entity?.type === 'switch' || entity?.type === 'door' ? entity.type : null,
      lift: lift !== undefined,
      warp: warp !== undefined,
      switchDepth: lerp(pressed(scene.before) ? 2 : 9, pressed(game) ? 2 : 9, switchPhase),
      doorDepth: lerp(doorDepth(scene.before), doorDepth(game), doorPhase),
      box: has(boxes, cell.p) && !movedBoxHere && boxDrop === null,
      rail: cell.rail,
      railNext: scene.nextRails.has(cell.key),
      pitWallLeft: pitShown ? wallHeight(walls, cell.p.x, cell.p.y - 1) : -1,
      pitWallRight: pitShown ? wallHeight(walls, cell.p.x - 1, cell.p.y) : -1,
      blockOpacity:
        restored > 0
          ? 1 - smooth(clamp01(t / RESTORE_FADE))
          : restored < 0
            ? (scene.cubeDrop?.opacity ?? 1)
            : crumble.opacity,
      flatLadder,
      leaning,
      vine: vine?.kind ?? null,
      vineEnter: vine?.enter ?? null,
      vineLeave: vine?.leave ?? null,
      vineGrowth: vine?.growth ?? 1,
      vineRise: vine?.rise ?? 1,
      vineTongue: vine?.tongue ?? 0,
      vineSprout: vine?.sprout ?? 0,
      vineSproutOpacity: vine?.sproutOpacity ?? 1,
      vineHard: vine?.hard ?? 0,
      vineKnot: vine?.knot ?? 0,
      vineOpacity: vine?.opacity ?? 1,
      seed: has(game.seeds, cell.p)
        ? 1
        : pickedHere && has(scene.before.seeds, cell.p)
          ? 1 - scene.pickUpPhase
          : 0,
      seedLand: seedHere?.land ?? 0,
      seedStalk: seedHere?.stalk ?? 0,
      seedBud: seedHere?.bud ?? 0,
      seedLeaves: seedHere?.leaves ?? 0,
      seedTree: seedHere?.tree ?? 0,
      seedTreeNext: seedHere?.treeNext ?? 0,
      seedTreeP: seedHere?.treeP ?? 1,
      seedStakes: seedHere?.stakes ?? 0,
      seedStakesNext: seedHere?.stakesNext ?? 0,
      seedStakeP: seedHere?.stakeP ?? 1,
    },
    over: { tram, drawCube, drawBoxes, boxDrop, goalEffect, overlay, waterDepth: water.depth },
  }
}
