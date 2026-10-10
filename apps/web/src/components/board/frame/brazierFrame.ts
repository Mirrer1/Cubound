import { BRAZIER, boxBurn } from '../view'
import { clamp01, lerp, smooth } from './curveFrame'
import { SECONDS, has, same } from './pathFrame'
import type { GameEvent, GameState, Point, Stage } from '@/game/types'

// 불 붙은 큐브가 민 상자가 재가 되는 초
export const BOX_BURN = 1.2

// 화로에 다 올라선 뒤 큐브 빛이 차오르는 초
export const BRAZIER_LIGHT = 0.45

// 불 붙은 채 화로에 올라선 순간 내려앉은 빛 높이 비
const REFILL_LOW = 0.45

// 남은 수마다 큐브 빛 세기
const GLOW = [0, 0.64, 0.76, 0.88, 1]

const glowOf = (flame: number) => GLOW[flame] ?? 0

export const isBrazier = (stage: Stage, { x, y }: Point) => stage.fire?.[y]?.[x] === '@'

// 그릇 위에 선 것이 올라간 화면 거리, 칸 사이는 이어지는 값
export const bowlLift = (stage: Stage, x: number, y: number) => {
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const at = (px: number, py: number) => (isBrazier(stage, { x: px, y: py }) ? BRAZIER.height : 0)
  const fx = x - x0
  const fy = y - y0
  return lerp(
    lerp(at(x0, y0), at(x0 + 1, y0), fx),
    lerp(at(x0, y0 + 1), at(x0 + 1, y0 + 1), fx),
    fy,
  )
}

const fromBrazier = (events: GameEvent[]) =>
  events.some((e) => e.type === 'ignited' && e.by === 'brazier')

export const brazierEnd = (events: GameEvent[]) =>
  events.some((e) => e.type === 'boxBurned') ? BOX_BURN : 0

// 이동이 끝난 뒤 큐브 빛이 다 차는 초
export const brazierLightEnd = (events: GameEvent[]) =>
  fromBrazier(events) ? SECONDS.moved + BRAZIER_LIGHT : 0

interface BrazierView {
  before: GameState
  game: GameState
  events: GameEvent[]
  moving: boolean
  dropping: boolean
  t: number
  stepT: number
  spread: number // 불 번짐 진행도
  elapsed: number // 이동이 시작한 뒤로 흐른 초
}

export interface CubeGlow {
  strength: number // 큐브 빛 세기 0~1
  height: number // 옆면 빛이 차오른 높이 비
  flash: number // 화로에 올라선 순간 그릇 속불빛
  last: number // 꺼지는 수의 마지막 불티 진행도
  dip: number // 남은 수 1의 깜빡임 세기
  spark: number // 윗면 불티 진하기
}

const cubeGlow = (view: BrazierView, back: number): CubeGlow => {
  const { before, game, events, moving, dropping, stepT, spread, elapsed } = view
  const from = glowOf(before.flame)
  const still = { strength: glowOf(game.flame), height: 1, flash: 0, last: 0 }
  const ignited = events.find((e) => e.type === 'ignited')
  // 꺼진 큐브는 그릇에 다 올라선 뒤, 불 붙은 큐브는 올라서는 동안 차오르는 빛
  const kindle = clamp01((elapsed - SECONDS.moved) / BRAZIER_LIGHT)
  const byBrazier = ignited?.type === 'ignited' && ignited.by === 'brazier'
  const lit = byBrazier ? smooth(clamp01(kindle / 0.5)) : ignited ? spread : 0
  // 아래에서 위로 번져 오르는 빛 높이, 세기보다 늦게 끝까지
  const rise = byBrazier ? smooth(kindle) : lit
  // 불 붙은 채 올라서면 빛이 그릇 쪽으로 내려앉았다가 다시 차오르는 높이
  const refill =
    elapsed < SECONDS.moved ? lerp(1, REFILL_LOW, smooth(stepT)) : lerp(REFILL_LOW, 1, rise)
  const glow = dropping
    ? { ...still, strength: from * (1 - back) }
    : !moving
      ? still
      : ignited
        ? {
            ...still,
            strength: lerp(from, 1, lit),
            height: from === 0 ? rise : byBrazier ? refill : 1,
            flash: byBrazier ? Math.sin(Math.PI * kindle) : 0,
          }
        : events.some((e) => e.type === 'doused')
          ? {
              ...still,
              strength: lerp(from, 0, stepT),
              height: clamp01(1 - 1.15 * stepT),
              last: Math.sin(Math.PI * clamp01((stepT - 0.35) / 0.6)),
            }
          : { ...still, strength: lerp(from, still.strength, stepT) }
  return {
    ...glow,
    dip:
      dropping || (game.flame !== 1 && before.flame !== 1)
        ? 0
        : moving && before.flame > 1
          ? stepT
          : 1,
    spark:
      clamp01((glow.strength - GLOW[2]) / (GLOW[3] - GLOW[2])) * clamp01((glow.height - 0.7) / 0.3),
  }
}

// 그 순간 판 전체의 화로 값
export const brazierScene = (view: BrazierView) => {
  const { game, events, moving, dropping, t, elapsed } = view
  const back = dropping ? smooth(clamp01(t)) : 1
  const glow = cubeGlow(view, back)
  const boss = game.stage.rules?.burnBox === true
  const burned = events.find((e) => e.type === 'boxBurned')
  return {
    boss,
    back,
    glow,
    burning:
      moving && !dropping && burned?.type === 'boxBurned'
        ? { at: burned.at, q: clamp01(elapsed / BOX_BURN) }
        : null,
  }
}

export type BrazierScene = ReturnType<typeof brazierScene>

export interface BrazierLook {
  on: boolean // 화로 칸
  lift: number // 그릇 위 상자 높이 px
  covered: number // 그릇 위에 선 것이 덮은 정도, 그릇 불티를 거두는 값
  flash: number // 올라선 순간 속불빛
  burn: number // 이 칸에 멈춰 타는 상자 진행도, -1이면 없음
  mark: number // 탄 상자 재 자국 진하기
}

interface BrazierLookView {
  scene: BrazierScene
  game: GameState
  before: GameState
  cube: { x: number; y: number }
  box: { x: number; y: number; to: Point } | null // 밀리는 상자
  boxHere: boolean
  p: Point
}

const near = (q: { x: number; y: number }, p: Point) =>
  clamp01(1 - Math.abs(q.x - p.x) - Math.abs(q.y - p.y))

// 칸 하나의 화로 모습
export const brazierLookOf = ({
  scene,
  game,
  before,
  cube,
  box,
  boxHere,
  p,
}: BrazierLookView): BrazierLook => {
  const on = isBrazier(game.stage, p)
  const onCube = on ? near(cube, p) : 0
  const { burning, back } = scene
  const burningHere = burning !== null && same(burning.at, p)
  const floor = game.heights[p.y][p.x] >= 0
  const crumble = burningHere ? boxBurn(burning.q).crumble : 0
  return {
    on,
    lift: on ? BRAZIER.height : 0,
    covered: on ? Math.max(onCube, boxHere ? 1 : 0, box ? near(box, p) : 0) : 0,
    flash: scene.glow.flash * onCube,
    burn: burningHere && !(box && same(box.to, p)) ? burning.q : -1,
    mark: !floor
      ? 0
      : burningHere
        ? smooth(crumble)
        : has(game.charred, p)
          ? 1
          : has(before.charred, p)
            ? 1 - back
            : 0,
  }
}

// 화면 위 FIRE 숫자, 꺼지는 수의 연출 동안 0, 불이 없으면 null
export const flameDisplay = (game: GameState | null, events: GameEvent[], animating: boolean) =>
  !game
    ? null
    : game.flame > 0
      ? { count: game.flame, out: false }
      : animating && events.some((e) => e.type === 'doused')
        ? { count: 0, out: true }
        : null
