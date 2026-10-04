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
import type { VineKind } from './vineFrame'
import { TILE } from '@/game/iso'
import { isDoorOpen, isIce, isLiftRaised } from '@/game/rules'
import type { Direction, Entity, GameEvent, GameState, Point, Stage } from '@/game/types'

// 재시작에 메운 바닥이 사라지는 진행도
const RESTORE_FADE = 0.25

export interface CellLook {
  x: number
  y: number
  h: number
  parity: boolean
  goal: boolean
  faded: boolean
  hidden: boolean // 상자가 메우는 중인 칸
  box: boolean
  ground: {
    filled: boolean
    blockOpacity: number // 칸 블록 투명도
  }
  ice: {
    on: boolean
    frost: number // 미끄러져 지나간 자국 진하기
  }
  crack: {
    on: boolean
    stage: number // 닳은 단계 0~2
    broken: number // 네 조각으로 갈라져 벌어진 정도
    fall: number // 무너지며 아래로 내려간 화면 거리
    shadow: number // 무너진 자리에 깔리는 그림자 진하기
    seed: number // 자국 자리를 칸마다 어긋나게 하는 값
  }
  swamp: {
    on: boolean
    filled: number // 상자가 가라앉아 메워진 정도 0~1
    risen: number // 잠긴 큐브가 올라온 정도 0~1, -1이면 가라앉는 상자
    deep: number // 잠긴 정도 0~1, 0이면 잠긴 것 없는 칸
  }
  mushroom: {
    on: boolean
    press: number // 갓이 눌린 정도, -1은 펴짐, 0은 평소, 2는 큐브가 올라선 상태
    wither: number // 시든 정도 0~1
  }
  water: {
    depth: number // 물 깊이 층 수, 0이면 물 없는 칸
    bankX: boolean // 왼쪽 위 가장자리 반사 띠
    bankY: boolean // 오른쪽 위 가장자리 반사 띠
    sideLeft: boolean
    sideRight: boolean
    ring: number // 퍼지는 고리 크기, 0이면 고리 없음
    ringOpacity: number
  }
  tether: {
    post: number // 말뚝 띠 수, 0이면 말뚝 없는 칸
    range: number // 갈 수 있는 범위 칸의 큐브가 탄 정도, -1이면 범위 밖
  }
  device: {
    entity: 'switch' | 'door' | null
    switchDepth: number
    doorDepth: number
    lift: boolean
    warp: boolean
  }
  pit: {
    rail: string // 이웃한 발판 길 칸 방향을 "x,y"로 이은 값, 빈 값이면 길이 아닌 칸
    railNext: boolean // 발판이 다음 수에 들어올 칸
    wallLeft: number // 0 이상이면 위 칸 쪽에 세우는 구덩이 벽, -1이면 벽 없는 칸
    wallRight: number // 0 이상이면 왼 칸 쪽에 세우는 구덩이 벽, -1이면 벽 없는 칸
  }
  ladder: {
    flat: number // 바닥에 놓인 사다리 투명도, 0이면 사다리 없는 칸
    leaning: string // "방향:투명도"를 |로 이은 값
  }
  vine: {
    kind: VineKind | null // 덩굴 뿌리나 길 칸
    enter: Direction | null
    leave: Direction | null
    growth: number // 줄기가 칸을 건너는 진행도
    rise: number // 판이 구덩이에서 차오른 정도
    tongue: number
    sprout: number // 싹 키 px
    sproutOpacity: number
    hard: number // 굳은 정도
    knot: number // 봉오리가 돋은 정도
    opacity: number
  }
  seed: {
    on: number // 바닥에 놓인 씨앗 투명도, 0이면 씨앗 없는 칸
    land: number // 씨앗으로 솟은 볏짚빛 층 수
    stalk: number // 보스 기둥 줄기 층 수, 0이면 기둥 없는 칸
    bud: number // 보스 기둥 봉오리가 돋은 정도 0~1
    leaves: number // 솟은 땅에 남은 잎이 드러난 정도 0~1
    tree: number // 사라지는 나무 단계, 0이면 나무 없는 칸
    treeNext: number // 들어서는 나무 단계, 0이면 나무 없는 칸
    treeP: number
    stakes: number // 사라지는 말뚝 수
    stakesNext: number // 들어서는 말뚝 수
    stakeP: number
  }
}

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
export const cellLook = ({
  stage,
  game,
  events,
  t,
  swampSeconds,
  fillingKey,
  railDirs,
  scene,
}: CellLookView) => {
  const { heights, boxes, ladders, leaningLadders } = game
  const walls = { heights, before: scene.before, fillingKey, vineFrame: scene.vineFrame, railDirs }
  // 문과 발판이 움직이기 시작하는 때, 스위치가 눌리거나 풀린 때
  const linkedPhase = (cells: Point[], pressed: boolean) =>
    scene.moving ? switchProgress(events, cells, pressed, t, swampSeconds) : 1

  return (cell: ReturnType<typeof boardCells>[number]) => {
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

    const look: CellLook = {
      x: cell.x,
      y: cellY,
      h: cell.h - seedShift + raised,
      parity: (cell.p.x + cell.p.y) % 2 === 1,
      goal: same(cell.p, stage.goal),
      faded: has(scene.faded, cell.p),
      hidden: isFilled && movedBoxHere && scene.before.heights[cell.p.y][cell.p.x] < 0,
      box: has(boxes, cell.p) && !movedBoxHere && boxDrop === null,
      ground: {
        filled:
          (isFilled || (restored > 0 && stage.heights[cell.p.y][cell.p.x] < 0)) &&
          vine?.kind !== 'grown',
        blockOpacity:
          restored > 0
            ? 1 - smooth(clamp01(t / RESTORE_FADE))
            : restored < 0
              ? (scene.cubeDrop?.opacity ?? 1)
              : crumble.opacity,
      },
      ice: {
        on: isIce(game, cell.p),
        frost: frostAt(events, cell.p, t, swampSeconds),
      },
      crack: {
        on: Math.max(left, was) >= 0,
        stage: crumble.stage,
        broken: crumble.broken,
        fall: crackFall,
        shadow: crumble.shadow,
        seed: (cell.p.x * 3 + cell.p.y * 5) % 4,
      },
      swamp: {
        on: swamp,
        filled: swampHere && !has(game.swamps, cell.p) ? (sinkingHere?.filled ?? 1) : 0,
        risen: sunkHere ? sunkHere.risen : -1,
        deep: sunkHere?.deep ?? sinkingHere?.deep ?? 0,
      },
      mushroom: {
        on: capHere !== undefined,
        press: capHere?.press ?? 0,
        wither: capHere?.wither ?? 0,
      },
      water: {
        depth: water.depth,
        bankX: water.bankX,
        bankY: water.bankY,
        sideLeft: water.sideLeft,
        sideRight: water.sideRight,
        ring: rippleHere?.size ?? 0,
        ringOpacity: rippleHere?.opacity ?? 0,
      },
      tether: {
        post: postBands(stage, cell.p),
        range: scene.moor.get(cell.key) ?? -1,
      },
      device: {
        entity: entity?.type === 'switch' || entity?.type === 'door' ? entity.type : null,
        switchDepth: lerp(pressed(scene.before) ? 2 : 9, pressed(game) ? 2 : 9, switchPhase),
        doorDepth: lerp(doorDepth(scene.before), doorDepth(game), doorPhase),
        lift: lift !== undefined,
        warp: warp !== undefined,
      },
      pit: {
        rail: cell.rail,
        railNext: scene.nextRails.has(cell.key),
        wallLeft: pitShown ? wallHeight(walls, cell.p.x, cell.p.y - 1) : -1,
        wallRight: pitShown ? wallHeight(walls, cell.p.x - 1, cell.p.y) : -1,
      },
      ladder: {
        flat: flatLadder,
        leaning,
      },
      vine: {
        kind: vine?.kind ?? null,
        enter: vine?.enter ?? null,
        leave: vine?.leave ?? null,
        growth: vine?.growth ?? 1,
        rise: vine?.rise ?? 1,
        tongue: vine?.tongue ?? 0,
        sprout: vine?.sprout ?? 0,
        sproutOpacity: vine?.sproutOpacity ?? 1,
        hard: vine?.hard ?? 0,
        knot: vine?.knot ?? 0,
        opacity: vine?.opacity ?? 1,
      },
      seed: {
        on: has(game.seeds, cell.p)
          ? 1
          : pickedHere && has(scene.before.seeds, cell.p)
            ? 1 - scene.pickUpPhase
            : 0,
        land: seedHere?.land ?? 0,
        stalk: seedHere?.stalk ?? 0,
        bud: seedHere?.bud ?? 0,
        leaves: seedHere?.leaves ?? 0,
        tree: seedHere?.tree ?? 0,
        treeNext: seedHere?.treeNext ?? 0,
        treeP: seedHere?.treeP ?? 1,
        stakes: seedHere?.stakes ?? 0,
        stakesNext: seedHere?.stakesNext ?? 0,
        stakeP: seedHere?.stakeP ?? 1,
      },
    }

    return {
      cellY,
      look,
      over: { tram, drawCube, drawBoxes, boxDrop, goalEffect, overlay, waterDepth: water.depth },
    }
  }
}

const isBundle = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null

const sameBundle = (a: Record<string, unknown>, b: Record<string, unknown>) => {
  const keys = Object.keys(a)
  return keys.length === Object.keys(b).length && keys.every((key) => Object.is(a[key], b[key]))
}

// BoardCell 다시 그리기 판단, 묶음은 안의 값끼리 비교, children은 참조 비교
export const sameCellLook = <T extends object>(prev: T, next: T) => {
  const a = prev as Record<string, unknown>
  const b = next as Record<string, unknown>
  const keys = Object.keys(a)
  return (
    keys.length === Object.keys(b).length &&
    keys.every((key) => {
      if (Object.is(a[key], b[key])) return true
      return (
        key !== 'children' && isBundle(a[key]) && isBundle(b[key]) && sameBundle(a[key], b[key])
      )
    })
  )
}
