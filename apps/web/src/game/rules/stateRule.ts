import type { Crack, Entity, GameState, Point, Stage } from '../types'
import { hasBox, isWater, same } from './cellRule'
import { isLiftRaised } from './switchRule'
import { isPost, posts } from './tetherRule'
import { tramLevelAt, trams } from './tramRule'
import { vines } from './vineRule'

type Lift = Extract<Entity, { type: 'lift' }>

// 필드 밖과 말뚝 칸은 undefined, 바닥 없는 칸은 -1, 물 칸은 뜬 상자 바닥 높이, 움직이는 발판이 선 칸은 발판 높이, 올라간 엘리베이터 발판은 한 층 위
export const rawHeight = (state: GameState, p: Point): number | undefined => {
  const h = state.heights[p.y]?.[p.x]
  if (h === undefined || isPost(state.stage, p)) return undefined
  if (isWater(state, p)) return (state.stage.water ?? 0) - 1

  const tramLevel = tramLevelAt(state, p)
  if (tramLevel !== null) return tramLevel

  const lift = state.stage.entities.find((e): e is Lift => e.type === 'lift' && same(e, p))
  return lift && isLiftRaised(state, lift.id) ? h + 1 : h
}

export const floorAt = (state: GameState, p: Point) => {
  const h = rawHeight(state, p)
  return h === undefined || h < 0 || (isWater(state, p) && !hasBox(state, p)) ? null : h
}

export const standHeight = (state: GameState, p: Point) =>
  (floorAt(state, p) ?? 0) + (hasBox(state, p) ? 1 : 0)

export const readCracks = (stage: Stage): Crack[] =>
  (stage.cracks ?? []).flatMap((row, y) =>
    [...row].flatMap((c, x) => (c === '.' ? [] : [{ x, y, left: Number(c) }])),
  )

export const readSwamps = (stage: Stage): Point[] =>
  (stage.swamp ?? []).flatMap((row, y) => [...row].flatMap((c, x) => (c === '#' ? [{ x, y }] : [])))

export const readMushrooms = (stage: Stage): Point[] =>
  (stage.mushroom ?? []).flatMap((row, y) =>
    [...row].flatMap((c, x) => (c === '#' ? [{ x, y }] : [])),
  )

export const createState = (stage: Stage): GameState => ({
  stage,
  heights: stage.heights,
  boxes: stage.entities.filter((e) => e.type === 'box').map(({ x, y }) => ({ x, y })),
  tethered: posts(stage).map(({ boat }) => ({ x: boat.x, y: boat.y })),
  cracks: readCracks(stage),
  trams: trams(stage).map(({ id, cells, dir, x, y }) => ({
    id,
    at: cells.findIndex((cell) => same(cell, { x, y })),
    dir,
  })),
  swamps: readSwamps(stage),
  mushrooms: readMushrooms(stage),
  vines: vines(stage).map(({ id }) => ({ id, grown: 0, stopped: false })),
  struggles: 0,
  sinks: 0,
  ladders: stage.entities.filter((e) => e.type === 'ladder').map(({ x, y }) => ({ x, y })),
  seeds: stage.entities.filter((e) => e.type === 'seed').map(({ x, y }) => ({ x, y })),
  planted: [],
  leaningLadders: [],
  carrying: null,
  player: stage.start,
  moves: 0,
  pushes: 0,
  climbs: 0,
  rides: 0,
  dirUses: 0,
  cleared: false,
})
