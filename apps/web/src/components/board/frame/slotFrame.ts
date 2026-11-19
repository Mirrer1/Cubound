import { type boardCells } from './cellFrame'
import { type cellLook } from './cellLookFrame'
import {
  type MovingCover,
  type NightBeat,
  type NightCell,
  bridgeLight,
  cubeCover,
  movingBoxCover,
  nightCellOf,
  nightScene,
  sinkingBoxCovers,
  stillBoxCover,
} from './nightFrame'
import { same } from './pathFrame'
import { type sceneFrame } from './sceneFrame'
import { type BridgeLook, sinkingNow } from './shadowFrame'
import type { GameEvent, GameState, Point } from '@/game/types'

type Cell = ReturnType<typeof boardCells>[number]
type Scene = ReturnType<typeof sceneFrame>
type LookOf = ReturnType<typeof cellLook>
type Look = ReturnType<LookOf>

interface SlotView {
  game: GameState
  prevGame: GameState | null
  events: GameEvent[]
  guideNight: GameState | null // 가이드가 보여 주는 어둠 장면
  guideFrom: GameState | null // 가이드가 열리거나 닫혀 어둠이 바뀌기 전 장면, 수 없이 이어 바꿈
  beat: NightBeat | null
  bridges: Map<string, BridgeLook>
  lookOf: LookOf
  t: number
  scene: Scene
  cells: Cell[]
}

export interface Tap {
  cell: Point
  device: Point
  look: Look['look']
}

// 이 칸 수면 뒤에 비치는 물에 잠긴 골, x와 y는 골 칸 윗면 중심
export interface BehindGoal {
  x: number
  y: number
  parity: boolean
  sunk: number
  depth: number
}

export interface SlotFrame {
  guideShift: boolean // 수 없이 가이드로 어둠이 바뀌는 중
  game: GameState
  beat: NightBeat | null
  bridges: Map<string, BridgeLook>
  scene: Scene
  night: ReturnType<typeof nightScene>
  lookOf: LookOf
  taps: Tap[]
  sunkGoal: BehindGoal | null
  boxCover: MovingCover | null
  playerCover: MovingCover | null
  sinkCovers: MovingCover[]
  covers: MovingCover[] // 바닥 막에서 모양을 잘라 내는 지나가는 것 모두
}

export interface Slot extends Look {
  cell: Cell
  taps: Tap[]
  sinkingBox: boolean
  bridge: BridgeLook | undefined
  shownBridge: number
  bridgeFade: boolean // 가이드가 열리고 닫힐 때 그림자 다리를 칸 어둠과 같은 박자로 나타내고 지움
  bridgeLit: number
  bridgeBox: ReturnType<typeof stillBoxCover> | null
  veil: NightCell | null
  behindGoal: BehindGoal | null
  content: boolean // 칸 위에 그 순간 장면 값으로 얹어 그리는 것
  beat: NightBeat | null // 화로와 까마귀 칸의 어둠 세기, 그 밖 칸은 null
  shade: ShadeLook | null // 막 대신 타일 색 자체를 어둡게 칠하는 평범한 바닥 칸
}

// 원시값 묶음이라 빛 지도가 그대로인 프레임은 칸을 다시 그리지 않음
export interface ShadeLook {
  veil: string // 윗면 빛 지도, 쉼표로 이음
  sides: string // 옆면 빛 지도, 윗면과 같으면 빈 글자
  depth: number
  deco: boolean // 바닥 위 장식이 있는 칸, 장식 모양대로 어둠 막을 씌움
  beat: NightBeat | null
}

// 그 순간 판 전체에서 칸마다 쓰는 값
export const slotFrame = ({
  game,
  prevGame,
  events,
  guideNight,
  guideFrom,
  beat,
  bridges,
  lookOf,
  t,
  scene,
  cells,
}: SlotView): SlotFrame => {
  const night = nightScene({
    prev: guideFrom ?? guideNight ?? prevGame,
    game: guideNight ?? game,
    events: guideNight || guideFrom ? [] : events,
    t,
    cube: scene.cube,
    dropping: scene.dropping,
  })
  // 물에 잠긴 골, 앞줄 칸이 자기 수면 위에 다시 비추는 자리
  const goalCell = cells.find((cell) => same(cell.p, game.stage.goal))
  const goalLook = goalCell ? lookOf(goalCell).look : null
  const sunkGoal =
    goalLook && goalLook.sluice.sunk > 0
      ? {
          x: goalLook.x,
          y: goalLook.y,
          parity: goalLook.parity,
          sunk: goalLook.sluice.sunk,
          depth: goalLook.water.depth,
        }
      : null
  // 장치 위로 올라온 물건 앞에 다시 그리는 꼭지
  const taps = scene.taps.flatMap((tap) => {
    const device = cells.find((cell) => same(cell.p, tap.device))
    return device ? [{ ...tap, look: lookOf(device).look }] : []
  })
  const movingFrame = scene.box && scene.boxFrames.find((frame) => same(frame.to, scene.box!.to))
  const boxCover =
    night && movingFrame ? movingBoxCover(night, movingFrame, scene.box!, events) : null
  const playerCover = night ? cubeCover(night, prevGame, game, scene) : null
  const sinkCovers = night && night.sink < 1 ? sinkingBoxCovers(night, game) : []
  return {
    guideShift: guideFrom !== null,
    game,
    beat,
    bridges,
    scene,
    night,
    lookOf,
    taps,
    sunkGoal,
    boxCover,
    playerCover,
    sinkCovers,
    covers: [boxCover, playerCover, ...sinkCovers].flatMap((c) => (c ? [c] : [])),
  }
}

const frontOfGoal = (goal: Point, p: Point) =>
  p.x - goal.x >= 0 &&
  p.y - goal.y >= 0 &&
  p.x - goal.x + p.y - goal.y > 0 &&
  p.x - goal.x <= 1 &&
  p.y - goal.y <= 1

// 타일 블록 하나로 그리고 바닥 장식이 없는 칸, 그 밖 칸은 막으로
const plainFloor = (cell: Cell, look: Look['look']) =>
  !cell.pit &&
  (!look.goal || look.sluice.sunk === 0) &&
  !look.crack.on &&
  look.seed.land === 0 &&
  look.seed.leaves === 0 &&
  (!look.ground.filled || look.h <= 0) &&
  look.water.depth === 0 &&
  !look.swamp.on &&
  !look.ice.on &&
  look.ice.frost === 0 &&
  look.iceStone.cover === 0 &&
  !look.mushroom.on &&
  !look.device.lift &&
  !look.device.warp &&
  look.tether.post === 0 &&
  look.vine.kind === null &&
  look.whirl.eye === 0 &&
  look.whirl.ghost === 0 &&
  look.whirl.lane === null &&
  look.sluice.channel === null &&
  look.tide.wet === 0 &&
  look.tide.band === 0

// 불씨와 꼬리 불, 화로 그릇, 재 자국은 칠 조각으로 따로
const decorated = (look: Look['look']) =>
  look.fire.kind !== null || look.trail.flame > 0 || look.brazier.on

const shadeOf = (veil: NightCell, look: Look['look'], beat: NightBeat | null): ShadeLook => ({
  veil: veil.veil,
  sides: veil.sides,
  depth: veil.depth,
  deco: decorated(look),
  beat,
})

// 칸 하나를 그리는 값
export const slotOf = (frame: SlotFrame, cell: Cell): Slot => {
  const { game, bridges, night, covers } = frame
  const drawn = frame.lookOf(cell)
  const taps = frame.taps.filter((tap) => same(tap.cell, cell.p))
  const sinking = night?.sinking.some((p) => same(p, cell.p)) ?? false
  const bridge = bridges.get(cell.key)
  const sinkingBox = sinkingNow(sinking, night?.sink ?? 1)
  // 다리 위에 멈춘 상자, 구덩이 칸이라 칸 그림이 그리지 않는 자리
  const bridgeBox =
    night && bridge && !sinking && !drawn.over.overlay && game.boxes.some((p) => same(p, cell.p))
      ? stillBoxCover(night, cell, bridge.level)
      : null
  const nightVeil =
    night && !cell.bare && !sinkingBox
      ? nightCellOf(night, game, cell.p, drawn.look.h, covers, frame.scene.dropping)
      : null
  const shade =
    nightVeil && plainFloor(cell, drawn.look) ? shadeOf(nightVeil, drawn.look, frame.beat) : null
  // 칠하는 칸의 가만히 놓인 상자는 덮개 없이 상자 색을 직접 어둡게(BoardBox dim)
  const painted =
    shade !== null &&
    drawn.look.box &&
    !drawn.look.iceStone.iced &&
    drawn.look.iceStone.boat === 0 &&
    drawn.look.water.depth === 0
  const veil = nightVeil && painted ? { ...nightVeil, cover: '' } : nightVeil
  return {
    ...drawn,
    cell,
    taps,
    sinkingBox,
    bridge,
    shownBridge: bridge ? (frame.guideShift ? 1 : (night?.bridge ?? 0)) : 0,
    bridgeFade: frame.guideShift,
    bridgeLit: bridge ? bridgeLight(night, cell.p, bridge.level) : 0,
    bridgeBox,
    veil,
    behindGoal: frame.sunkGoal && frontOfGoal(game.stage.goal, cell.p) ? frame.sunkGoal : null,
    content: drawn.over.overlay || taps.length > 0 || sinkingBox,
    beat: drawn.look.brazier.on || drawn.look.ambient.kind === 'crow' ? frame.beat : null,
    shade,
  }
}
