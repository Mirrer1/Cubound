import type { Direction, GameEvent, GameState, Keg, MoveResult, Point } from '../types'
import { hasBox, hasKeg, hasStone, same, step } from './cellRule'
import { crumble } from './crackRule'
import { fireAt, isFireBlocked, isFresh } from './fireRule'
import { isIce } from './iceRule'
import { floorAt, rawHeight, standHeight } from './stateRule'
import { isClosedDoor } from './switchRule'
import { onTramPath } from './tramRule'
import { walk } from './walkRule'

// 심지에 불이 붙고 터지기까지의 수
export const FUSE = 4

const SIDES: Direction[] = ['up', 'right', 'down', 'left']

const has = (list: Point[], p: Point) => list.some((q) => same(q, p))

// 화약통이 설 자리, 구덩이와 숯과 화로와 발판 길은 제외
const kegLanding = (state: GameState, p: Point, level: number): number | null => {
  const floor = rawHeight(state, p)
  if (floor === undefined || floor < 0 || floor > level) return null
  const c = fireAt(state.stage, p)
  if (
    c === '=' ||
    c === '@' ||
    isFireBlocked(state, p) ||
    hasBox(state, p) ||
    hasStone(state, p) ||
    hasKeg(state, p) ||
    state.ladders.some((l) => same(l, p)) ||
    state.leaningLadders.some((l) => same(l, p)) ||
    same(p, state.stage.goal) ||
    isClosedDoor(state, p) ||
    onTramPath(state.stage, p)
  )
    return null
  return floor
}

// 상자처럼 미는 화약통, 구덩이 쪽은 pit 표시가 붙은 막힘
export const pushKeg = (state: GameState, keg: Point, direction: Direction): MoveResult | null => {
  const level = floorAt(state, keg) ?? 0
  const first = step(keg, direction)
  if ((rawHeight(state, first) ?? 0) < 0) {
    return { state, events: [{ type: 'blocked', direction, pit: true }] }
  }
  const entry = kegLanding(state, first, level)
  if (entry === null) return null

  let rest = first
  let fell: Point | null = null
  while (isIce(state, rest)) {
    const next = step(rest, direction)
    const floor = kegLanding(state, next, entry)
    if (floor === null) break
    if (floor < entry) {
      fell = next
      break
    }
    rest = next
  }

  const events: GameEvent[] = [
    { type: 'kegPushed', from: keg, to: first, result: entry < level ? 'fell' : 'slid' },
  ]
  if (!same(rest, first)) events.push({ type: 'slid', subject: 'keg', from: first, to: rest })
  if (fell) events.push({ type: 'kegPushed', from: rest, to: fell, result: 'fell' })

  const stop = fell ?? rest
  const next: GameState = {
    ...state,
    kegs: state.kegs.map((k) => (same(k, keg) ? { ...k, x: stop.x, y: stop.y } : k)),
    pushes: state.pushes + 1,
  }
  return walk(next, keg, level, direction, events)
}

// 불 붙은 큐브가 화약통 쪽으로 미는 수, 큐브와 화약통 모두 제자리, 심지가 타는 화약통은 그냥 밀기
export const torchKeg = (state: GameState, to: Point): MoveResult | null => {
  if (state.flame === 0 || state.kegs.some((k) => same(k, to) && k.lit > 0)) return null
  return {
    state: { ...state, moves: state.moves + 1 },
    events: [{ type: 'torchedKeg', from: state.player, to }],
  }
}

const sideOf = (from: Point, to: Point) => SIDES.find((side) => same(step(from, side), to))

// 수 끝의 화약통, 심지 줄기와 불 닿음과 연쇄 폭발, burning은 이번 수 불 계산 전의 불붙은 숯
export const blastKegs = (burning: Point[], state: GameState, events: GameEvent[]): MoveResult => {
  if (state.kegs.length === 0) return { state, events: [] }

  const out: GameEvent[] = []
  const due = state.kegs.filter((k) => k.lit === 1)
  const fire = [
    ...burning,
    ...state.burning,
    ...events.flatMap((e) => (e.type === 'kindled' ? [e.at] : [])),
  ]
  const touched = events.flatMap((e) => (e.type === 'torchedKeg' ? [e.to] : []))
  const hot = (k: Point) => has(touched, k) || SIDES.some((side) => has(fire, step(k, side)))

  const kegs: Keg[] = state.kegs.map((k) => {
    const { x, y } = k
    if (k.lit > 1) out.push({ type: 'fuseTicked', at: { x, y }, left: k.lit - 1 })
    if (k.lit > 0) return { ...k, lit: k.lit - 1 }
    if (k.fuse && hot(k)) {
      out.push({ type: 'fuseLit', at: { x, y } })
      return { ...k, lit: FUSE }
    }
    return k
  })

  const blown: Keg[] = kegs.filter((k) => has(due, k) || (!k.fuse && hot(k)))
  if (blown.length === 0) {
    return { state: out.length > 0 ? { ...state, kegs } : state, events: out }
  }
  // 둘레의 화약통은 심지와 무관하게 같은 수에 연쇄
  for (let i = 0; i < blown.length; i++) {
    for (const side of SIDES) {
      const near = kegs.find((k) => same(k, step(blown[i], side)) && !has(blown, k))
      if (near) blown.push(near)
    }
  }

  const base: GameState = { ...state, kegs: kegs.filter((k) => !has(blown, k)) }
  const { player } = base
  const pusher = blown.find((k) => sideOf(k, player))
  const direction = pusher && sideOf(pusher, player)
  const to = direction && step(player, direction)
  const toFloor = to ? floorAt(base, to) : null
  // 밀릴 자리, 벽과 허공과 상자로 막힌 경우 제자리 버티기
  const pushed =
    to &&
    toFloor !== null &&
    toFloor <= standHeight(base, player) &&
    !isClosedDoor(base, to) &&
    !isFireBlocked(base, to) &&
    !hasBox(base, to) &&
    !hasStone(base, to) &&
    !hasKeg(base, to)

  const heights = base.heights.map((row) => [...row])
  const caught: Point[] = []
  let ownDrop = 0
  for (const keg of blown) {
    const lowered: Point[] = []
    const fresh: Point[] = []
    for (const side of SIDES) {
      const p = step(keg, side)
      const h = heights[p.y]?.[p.x]
      if (h === undefined || has(blown, p)) continue
      const c = fireAt(base.stage, p)
      if ((c === '#' || c === '=') && !has(base.ashes, p)) {
        if (isFresh(base, p) && !has(caught, p)) {
          caught.push(p)
          fresh.push(p)
        }
        continue
      }
      if (same(p, player)) {
        if (pushed && h - ownDrop > 0) {
          ownDrop += 1
          lowered.push(p)
        }
        continue
      }
      if (h <= 0) continue
      heights[p.y][p.x] = h - 1
      lowered.push(p)
    }
    out.push({ type: 'exploded', at: { x: keg.x, y: keg.y }, lowered, caught: fresh })
  }

  const blasted: GameState = { ...base, heights, burning: [...base.burning, ...caught] }
  const walked =
    pushed && to && direction
      ? walk(blasted, to, floorAt(blasted, to) ?? 0, direction)
      : { state: blasted, events: [] }
  const { state: worn, events: crackEvents } =
    walked.state === blasted ? { state: blasted, events: [] } : crumble(blasted, walked.state)
  if (direction) {
    out.push(
      pushed && to
        ? { type: 'blasted', from: player, to, direction }
        : { type: 'blastBraced', direction },
    )
  }

  const final = worn.heights.map((row) => [...row])
  final[player.y][player.x] -= ownDrop
  return {
    state: { ...worn, heights: final, moves: state.moves },
    events: [...out, ...walked.events, ...crackEvents],
  }
}
