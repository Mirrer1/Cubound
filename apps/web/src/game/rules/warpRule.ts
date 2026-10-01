import type { Point, Stage } from '../types'
import { same } from './cellRule'

const warps = (stage: Stage) => stage.entities.filter((e) => e.type === 'warp')

// 짝 칸이면 같은 id를 가진 나머지 한 칸, 아니면 null
export const warpExit = (stage: Stage, p: Point): Point | null => {
  const here = warps(stage).find((w) => same(w, p))
  const pair = here && warps(stage).find((w) => w.id === here.id && !same(w, p))
  return pair ? { x: pair.x, y: pair.y } : null
}
