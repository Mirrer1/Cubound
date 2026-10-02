import type { Point, Stage } from '../types'
import { same } from './cellRule'

const warps = (stage: Stage) => stage.entities.filter((e) => e.type === 'warp')

export const warpExit = (stage: Stage, p: Point): Point | null => {
  const here = warps(stage).find((w) => same(w, p))
  const pair = here && warps(stage).find((w) => w.id === here.id && !same(w, p))
  return pair ? { x: pair.x, y: pair.y } : null
}
