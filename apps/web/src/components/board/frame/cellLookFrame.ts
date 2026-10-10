import { type AmbientKind, ICE, idleRipples, postBands, rippleCycle, waterLook } from '../view'
import { type BrazierLook, brazierLookOf } from './brazierFrame'
import { type LadderLook, ladderLookOf } from './carryFrame'
import type { boardCells } from './cellFrame'
import { crackFrame, crackLeft, sinkAt } from './crackFrame'
import { clamp01, smooth } from './curveFrame'
import { landingCellKey, wallHeight } from './fillFrame'
import { type FireLook, NO_FIRE, fireLookOf } from './fireFrame'
import { frostAt } from './iceFrame'
import { frostGround, frostPatches } from './iceStoneFrame'
import { has, same } from './pathFrame'
import { restartDrop } from './restartFrame'
import type { sceneFrame } from './sceneFrame'
import { type SeedCell, seedCellOf } from './seedFrame'
import { type SluiceLook, sluiceLookOf, stoneSlab } from './sluiceFrame'
import { type SwitchLook, switchLookOf } from './switchFrame'
import { type TideLook, tideLookOf } from './tideFrame'
import { type SwampTime } from './timeFrame'
import { type VineCell, vineCellOf } from './vineFrame'
import { leanOf, whirlLook } from './whirlpoolFrame'
import { TILE } from '@/game/iso'
import { isIce } from '@/game/rules'
import type { Direction, GameEvent, GameState, Point, Stage } from '@/game/types'

// 재시작에 메운 바닥이 사라지는 진행도
const RESTORE_FADE = 0.25

const NO_AMBIENT = { kind: null, at: 0, cycle: 0, leave: false }

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
  iceStone: {
    stone: 'land' | 'float' | null // 멈춰 선 얼음 돌
    frost: boolean // 땅 위 돌 밑 서리 판
    patch: number // 돌이 밀려 떠나거나 도착하는 칸의 땅 서리 진하기
    slab: number // 돌 밑 얼음 판 진하기, 물이 바뀌는 수에는 둘레 언 칸과 같이 얼고 녹는 값
    cover: number // 언 물 판이 덮은 정도, 0이면 안 언 칸
    gloss: number // 언 물 판 반짝임 줄 진하기
    from: Direction // 얼린 돌 쪽 가장자리
    boat: number // 얼어붙은 정도, 언 칸 위로 밀어 올린 상자는 0
    iced: boolean // 언 칸 위로 밀어 올린 상자
  }
  water: {
    depth: number // 물 깊이 층 수, 0이면 물 없는 칸
    bankX: number // 왼쪽 위 가장자리 반사 띠 진하기
    bankY: number // 오른쪽 위 가장자리 반사 띠 진하기
    sideLeft: boolean
    sideRight: boolean
    ring: number // 퍼지는 고리 크기, 0이면 고리 없음
    ringOpacity: number
    idle: number // 가만히 있을 때 잔물결이 이는 차례, -1이면 안 이는 칸
    idleCycle: number // 한 칸의 잔물결 한 바퀴 ms
  }
  sluice: SluiceLook
  tide: TideLook
  tether: {
    post: number // 말뚝 띠 수, 0이면 말뚝 없는 칸
    range: number // 갈 수 있는 범위 칸의 큐브가 탄 정도, -1이면 범위 밖
  }
  whirl: {
    eye: number // 소용돌이가 보이는 정도, 0이면 소용돌이 없는 칸
    ghost: number // 막은 상자가 수면 아래 비치는 정도
    lane: 'x' | 'y' | null // 지나는 물길 방향
    laneOpacity: number
    lean: Direction | null // 앞 칸에 멈춘 배가 쏠리는 소용돌이 쪽
  }
  device: SwitchLook
  pit: {
    rail: string // 이웃한 발판 길 칸 방향을 "x,y"로 이은 값, 빈 값이면 길이 아닌 칸
    railNext: boolean // 발판이 다음 수에 들어올 칸
    wallLeft: number // 0 이상이면 위 칸 쪽에 세우는 구덩이 벽, -1이면 벽 없는 칸
    wallRight: number // 0 이상이면 왼 칸 쪽에 세우는 구덩이 벽, -1이면 벽 없는 칸
  }
  ladder: LadderLook
  fire: FireLook
  brazier: BrazierLook
  vine: VineCell
  seed: SeedCell
  ambient: {
    kind: AmbientKind | null // 이 칸에서 이번 차례에 일어나는 분위기 연출
    at: number // 바퀴 안에서 시작하는 ms
    cycle: number
    leave: boolean // 거둘 때, 나비는 큐브가 이 칸이나 옆 칸에 온 때, 찬 김은 돌이 칸을 떠난 때, 불씨 칸 연기는 켜진 때, 화로 연기와 불티는 큐브나 상자가 올라선 때
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
  ambient: { kind: AmbientKind; cells: Point[]; at: number; cycle: number } | null
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
  ambient,
}: CellLookView) => {
  const { heights, boxes } = game
  const walls = {
    heights,
    before: scene.before,
    fillingKey: fillingKey ?? landingCellKey(scene.box, events),
    vineFrame: scene.vineFrame,
    railDirs,
  }
  // 재시작하며 처음 모습으로 돌아가는 진행도
  const back = scene.dropping ? smooth(clamp01(t)) : 1
  const deviceAt = switchLookOf(scene, { stage, game, events, t, swampSeconds, back })
  const ripples = idleRipples(stage, scene.sluice.still)
  const sluiceAt = sluiceLookOf(scene, { game, events, t, swamp: swampSeconds })
  const tideAt = tideLookOf(scene, { game, t })
  const patches = scene.moving ? frostPatches(scene.before, game, events, t, swampSeconds) : null
  const cycle = rippleCycle(ripples.size)

  return (cell: ReturnType<typeof boardCells>[number]) => {
    const capHere = scene.caps.find((capFrame) => same(capFrame.cell, cell.p))
    const ambientHere = ambient && has(ambient.cells, cell.p) ? ambient : null
    const water = waterLook(stage, cell.p, scene.sluice.waterAt)
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
    const fire = fireLookOf(scene.fire, cell.p)
    const isFilled =
      game.heights[cell.p.y][cell.p.x] >= 0 &&
      (stage.heights[cell.p.y][cell.p.x] < 0 ||
        (wasCrack && left < 0) ||
        (fire.kind === 'bridge' && has(game.ashes, cell.p)))
    const crumble = crackFrame(was, left, scene.crackPhase)
    const { raised, device } = deviceAt(cell)
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

    // 상자가 먼저 메운 길 칸은 덩굴이 못 자라 싹 제외
    const vineHere = scene.vineFrame.get(cell.key)
    const vine =
      vineHere && (cell.pit || vineHere.kind === 'grown' || vineHere.kind === 'root')
        ? vineHere
        : null
    // 판이 차오르거나 내려가는 칸의 드러나는 구덩이 벽
    const pitShown = cell.pit || (vine?.kind === 'grown' && vine.rise < 1)

    const tram = scene.tramFrames.find((frame) => same(frame.cell, cell.p)) ?? null
    const drawCube = same(scene.cube.cell, cell.p) && !scene.home
    const drawBoxes = scene.boxFrames.filter((frame) => same(frame.cell, cell.p))
    const whirlBoxes = scene.whirl.boxes.filter((frame) => same(frame.cell, cell.p))
    const stones = scene.iceStone.stones.filter((frame) => same(frame.cell, cell.p))
    const thawBoxes = scene.iceStone.thawing.filter((box) => same(box.to, cell.p))
    const ice = scene.iceStone.covers.get(cell.key)
    const stoneHere =
      has(game.stones, cell.p) && !scene.iceStone.stones.some((frame) => same(frame.to, cell.p))
    const boxHere = has(boxes, cell.p) && thawBoxes.length === 0
    const movedBoxHere =
      scene.boxFrames.some((frame) => same(frame.to, cell.p)) ||
      scene.whirl.boxes.some((frame) => same(frame.to, cell.p)) ||
      scene.iceStone.stones.some((frame) => same(frame.to, cell.p))
    const lane = scene.lanes.get(cell.key)
    const goalEffect = same(cell.p, stage.goal) && scene.home
    const droppingBox = scene.dropping ? boxes.findIndex((b) => same(b, cell.p)) : -1
    const boxDrop =
      droppingBox >= 0 ? restartDrop(t, droppingBox + 1, boxes.length, game.stones.length) : null
    // 재시작하면 제자리에서 사라지는 메운 칸, 큐브와 같은 빠르기로 돌아오는 무너졌던 칸
    const restored =
      scene.dropping && !seedHere
        ? Math.sign(scene.before.heights[cell.p.y][cell.p.x] - heights[cell.p.y][cell.p.x])
        : 0
    const stillBox = boxHere && !movedBoxHere && boxDrop === null
    const overlay =
      drawBoxes.length > 0 ||
      whirlBoxes.length > 0 ||
      stones.length > 0 ||
      thawBoxes.length > 0 ||
      drawCube ||
      goalEffect ||
      boxDrop !== null ||
      tram !== null

    const look: CellLook = {
      x: cell.x,
      y: cellY,
      h: cell.h - seedShift + raised,
      parity: (cell.p.x + cell.p.y) % 2 === 1,
      goal: same(cell.p, stage.goal),
      faded: has(scene.faded, cell.p),
      hidden: isFilled && movedBoxHere && scene.before.heights[cell.p.y][cell.p.x] < 0,
      box: stillBox,
      ground: {
        filled:
          (isFilled || (restored > 0 && stage.heights[cell.p.y][cell.p.x] < 0)) &&
          vine?.kind !== 'grown',
        // 숯 다리 칸은 땅 블록 대신 장작 판
        blockOpacity:
          fire.kind === 'bridge' && !isFilled
            ? 0
            : restored > 0
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
        filled:
          swampHere && !has(game.swamps, cell.p)
            ? (sinkingHere?.filled ?? 1)
            : swampHere && scene.dropping && !has(scene.before.swamps, cell.p)
              ? 1 - back
              : 0,
        risen: sunkHere ? sunkHere.risen : -1,
        deep: sunkHere?.deep ?? sinkingHere?.deep ?? 0,
      },
      mushroom: {
        on: capHere !== undefined,
        press: capHere?.press ?? 0,
        wither: capHere?.wither ?? 0,
      },
      iceStone: {
        stone: stoneHere ? (water.depth * TILE.layer > ICE.below ? 'float' : 'land') : null,
        frost: stoneHere && frostGround(game, cell.p),
        patch: patches?.get(cell.key) ?? 0,
        slab: stoneHere ? stoneSlab(scene.before, game, scene.sluice.phase, cell.p) : 0,
        cover: ice?.cover ?? 0,
        gloss: ice?.gloss ?? 0,
        from: ice?.from ?? 'up',
        boat: boxHere && !has(game.iced, cell.p) ? (ice?.cover ?? 0) : 0,
        iced: boxHere && has(game.iced, cell.p),
      },
      water: {
        depth: water.depth,
        bankX: water.bankX,
        bankY: water.bankY,
        sideLeft: water.sideLeft,
        sideRight: water.sideRight,
        ring: rippleHere?.size ?? 0,
        ringOpacity: rippleHere?.opacity ?? 0,
        idle: ice || has(game.stones, cell.p) ? -1 : (ripples.get(cell.key) ?? -1),
        idleCycle: cycle,
      },
      sluice: sluiceAt(cell.p),
      tide: tideAt(cell.p),
      tether: {
        post: postBands(stage, cell.p),
        range: scene.moor.get(cell.key) ?? -1,
      },
      whirl: {
        ...whirlLook(stage, cell.p, lane, scene.whirl, scene.iceStone.lanes.get(cell.key) ?? 1),
        lean: leanOf(lane, game, cell.p, scene.whirl),
      },
      device,
      pit: {
        rail: cell.rail,
        railNext: scene.nextRails.has(cell.key),
        wallLeft: pitShown ? wallHeight(walls, cell.p.x, cell.p.y - 1) : -1,
        wallRight: pitShown ? wallHeight(walls, cell.p.x - 1, cell.p.y) : -1,
      },
      ladder: ladderLookOf(scene, game, back, cell, pickedHere),
      fire: isFilled ? NO_FIRE : fire,
      brazier: brazierLookOf({
        scene: scene.brazier,
        game,
        before: scene.before,
        cube: scene.cube,
        box: scene.box,
        boxHere: stillBox,
        p: cell.p,
      }),
      vine: vineCellOf(vine),
      seed: seedCellOf(scene, game, cell, seedHere, pickedHere),
      ambient: ambientHere
        ? {
            kind: ambientHere.kind,
            at: ambientHere.at,
            cycle: ambientHere.cycle,
            leave:
              ambientHere.kind === 'mist'
                ? !has(game.stones, cell.p)
                : ambientHere.kind === 'emberSmoke'
                  ? !has(game.sparks, cell.p)
                  : ambientHere.kind === 'brazierSmoke' || ambientHere.kind === 'brazierSpark'
                    ? same(game.player, cell.p) || has(boxes, cell.p)
                    : Math.abs(cell.p.x - game.player.x) + Math.abs(cell.p.y - game.player.y) <= 1,
          }
        : NO_AMBIENT,
    }

    return {
      cellY,
      look,
      over: {
        tram,
        drawCube,
        drawBoxes,
        whirlBoxes,
        stones,
        thawBoxes,
        boxDrop,
        goalEffect,
        overlay,
        waterDepth: water.depth,
      },
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
