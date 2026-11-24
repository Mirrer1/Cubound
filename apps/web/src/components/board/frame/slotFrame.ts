import { VEIL_STEPS } from '../view'
import { type boardCells } from './cellFrame'
import { type cellLook } from './cellLookFrame'
import {
  type MovingCover,
  type NightBeat,
  type NightCell,
  bridgeLight,
  cubeCover,
  movingBoxCover,
  movingKegCover,
  nightCellOf,
  nightScene,
  sinkingBoxCovers,
  stillBoxCover,
  tramCover,
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
  kegCover: MovingCover | null // 밀려 가는 화약통을 따라가는 덮개
  playerCover: MovingCover | null
  sinkCovers: MovingCover[]
  tramCovers: MovingCover[] // 움직이는 발판, to는 발판을 그리는 칸
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
  inner: string // 판 안쪽 칸을 보는 앞 옆면, 'L'은 왼쪽(아래 칸), 'R'은 오른쪽(오른 칸), 받침 띠도 빛대로
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
  const kegCover = night && scene.kegFrame ? movingKegCover(night, scene.kegFrame) : null
  const playerCover = night ? cubeCover(night, prevGame, game, scene) : null
  const sinkCovers = night && night.sink < 1 ? sinkingBoxCovers(night, game) : []
  const tramCovers = night ? scene.tramFrames.map((frame) => tramCover(night, frame)) : []
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
    kegCover,
    playerCover,
    sinkCovers,
    tramCovers,
    covers: [boxCover, kegCover, playerCover, ...sinkCovers, ...tramCovers].flatMap((c) =>
      c ? [c] : [],
    ),
  }
}

const frontOfGoal = (goal: Point, p: Point) =>
  p.x - goal.x >= 0 &&
  p.y - goal.y >= 0 &&
  p.x - goal.x + p.y - goal.y > 0 &&
  p.x - goal.x <= 1 &&
  p.y - goal.y <= 1

// 타일 블록 하나로 그리고 바닥 장식이 없는 칸, 그 밖 칸은 막으로
// 무너지는 칸, 엘리베이터 발판, 짝 칸도 칠함, 막은 칸 윗면보다 솟은 조각과 판 테두리를 못 덮어 밝게 샘
// 발판 길 구덩이 칸도 칠함(상자처럼 한 색), 막은 전환 중 칸 둘레로 잘려 구덩이 테두리가 하얗게 샘
const plainFloor = (cell: Cell, look: Look['look']) =>
  (!cell.pit || cell.rail !== '') &&
  (!look.goal || look.sluice.sunk === 0) &&
  look.seed.land === 0 &&
  look.seed.leaves === 0 &&
  (!look.ground.filled || look.h <= 0) &&
  look.water.depth === 0 &&
  !look.swamp.on &&
  !look.ice.on &&
  look.ice.frost === 0 &&
  look.iceStone.cover === 0 &&
  !look.mushroom.on &&
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

// 앞 옆면이 보는 칸이 판 안의 땅이면 안쪽, 구덩이나 판 밖이면 바깥
const innerFaces = (game: GameState, p: Point) =>
  ((game.heights[p.y + 1]?.[p.x] ?? -1) >= 0 ? 'L' : '') +
  ((game.heights[p.y]?.[p.x + 1] ?? -1) >= 0 ? 'R' : '')

const shadeOf = (
  veil: NightCell,
  look: Look['look'],
  beat: NightBeat | null,
  inner: string,
): ShadeLook => ({
  veil: veil.veil,
  sides: veil.sides,
  inner,
  depth: veil.depth,
  deco: decorated(look),
  beat,
})

// 빛 층을 그리는 이어진 바닥, 같은 높이의 땅이고 금 간 칸, 장치, 숯 더미, 화로가 없는 칸
const bandedFloor = (game: GameState, q: Point, h: number) => {
  if ((game.heights[q.y]?.[q.x] ?? -1) !== h) return false
  if ((game.stage.cracks?.[q.y]?.[q.x] ?? '.') !== '.') return false
  if (game.stage.entities.some((e) => same(e, q))) return false
  const fire = game.stage.fire?.[q.y]?.[q.x] ?? '.'
  return fire !== '#' && fire !== '=' && fire !== '@'
}

// 둘레 네 칸에 빛 층을 그리는 바닥이 없는 혼자인 바닥 칸
const lonelyFloor = (game: GameState, p: Point, h: number) =>
  [
    { x: p.x + 1, y: p.y },
    { x: p.x - 1, y: p.y },
    { x: p.x, y: p.y + 1 },
    { x: p.x, y: p.y - 1 },
  ].every((q) => !bandedFloor(game, q, h))

// 혼자인 바닥 칸이 빛과 대각선이면 빛 고리 모서리만 겹쳐 피라미드처럼 보임
// 빛 쪽 두 이웃 중 땅이 하나뿐이면 그 길에서 빛이 들어오듯 곧은 줄무늬로(빛 쪽 줄 값을 칸 전체에 폄)
// 양쪽 다 땅이거나 둘 다 아니면 그대로
const pathStripe = (game: GameState, p: Point, veil: string) => {
  // 숯 줄 칸은 둘레가 숯과 구덩이뿐이라 늘 혼자인데, 줄무늬로 펴면 타는 숯과 대각선인 칸이 통째로 밝아짐
  if ((game.stage.fire?.[p.y]?.[p.x] ?? '.') !== '.') return veil
  const grid = veil.split(',').map(Number)
  const n = VEIL_STEPS
  if (grid.length !== n * n) return veil
  const mean = (list: number[]) => list.reduce((a, b) => a + b, 0) / list.length
  const row = (j: number) => grid.slice(j * n, j * n + n)
  const col = (i: number) => Array.from({ length: n }, (_, j) => grid[j * n + i])
  const [left, right, top, bottom] = [
    mean(col(0)),
    mean(col(n - 1)),
    mean(row(0)),
    mean(row(n - 1)),
  ]
  // 두 방향으로 다 옅어질 때만 대각선 빛, 한 방향이면 이미 곧은 줄무늬
  if (left === right || top === bottom) return veil
  const sx = left < right ? -1 : 1
  const sy = top < bottom ? -1 : 1
  const ground = (q: Point) => (game.heights[q.y]?.[q.x] ?? -1) >= 0
  const alongX = ground({ x: p.x + sx, y: p.y })
  const alongY = ground({ x: p.x, y: p.y + sy })
  if (alongX === alongY) return veil
  const edge = alongX ? row(sy < 0 ? 0 : n - 1) : col(sx < 0 ? 0 : n - 1)
  return Array.from({ length: n * n }, (_, k) => edge[alongX ? k % n : Math.floor(k / n)]).join(',')
}

// 줄무늬로 바꾼 칸은 옆면과 테두리도 그 줄무늬 값, 옛 고리 값이 남으면 테두리가 빛 밖처럼 까맸음
const striped = (shade: ShadeLook, veil: string): ShadeLook =>
  veil === shade.veil ? shade : { ...shade, veil, sides: '' }

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
  const floorShade =
    nightVeil && plainFloor(cell, drawn.look)
      ? shadeOf(nightVeil, drawn.look, frame.beat, innerFaces(game, cell.p))
      : null
  // 엘리베이터는 요소라 상자, 문처럼 칸 바닥 높이 빛으로 한 색, 빛보다 높은 칸 규칙(윗면 까맘)은 벽 같은 바닥만
  const shade =
    floorShade && night && drawn.look.device.lift
      ? { ...floorShade, veil: night.veilOf(cell.p, 0).top.join(',') }
      : floorShade && lonelyFloor(game, cell.p, drawn.look.h)
        ? striped(floorShade, pathStripe(game, cell.p, floorShade.veil))
        : floorShade
  // 칠하는 칸의 가만히 놓인 상자와 화약통은 덮개 없이 제 색을 직접 어둡게(BoardBox dim, BoardKeg night)
  // 화약통에 상자 크기 덮개를 씌우면 둘레 바닥이 한 번 더 덮여 검은 네모가 보임
  const painted =
    shade !== null &&
    (drawn.look.box || drawn.look.keg.on) &&
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
