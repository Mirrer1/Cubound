import { shade } from './shade'
import { TILE, isoDelta } from '@/game/iso'
import type { Direction, Point } from '@/game/types'

const RUNGS = [-0.3, -0.1, 0.1, 0.3]
const LEAN_RUNGS = [0.2, 0.45, 0.7, 0.92]
const DIRECTION_DELTA: Record<Direction, Point> = {
  up: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
}

type Segment = [Point, Point]

interface BoardLadderProps {
  x: number
  y: number
  scale?: number
  direction?: Direction // 있으면 그 방향 높은 칸에 기댄 모습
}

const add = (a: Point, b: Point) => ({ x: a.x + b.x, y: a.y + b.y })
const lerp = (a: Point, b: Point, t: number) => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
})

const flatSegments = (center: Point, s: number) => ({
  rails: [-0.24, 0.24].map((v): Segment => [
    add(center, isoDelta(-0.43 * s, v * s)),
    add(center, isoDelta(0.43 * s, v * s)),
  ]),
  rungs: RUNGS.map((u): Segment => [
    add(center, isoDelta(u * s, -0.26 * s)),
    add(center, isoDelta(u * s, 0.26 * s)),
  ]),
})

const leaningSegments = (center: Point, direction: Direction) => {
  const d = DIRECTION_DELTA[direction]
  const bottom = add(center, isoDelta(d.x * 0.3, d.y * 0.3))
  const top = add(center, add(isoDelta(d.x * 0.5, d.y * 0.5), { x: 0, y: -TILE.layer }))
  const rails = [-0.17, 0.17].map((w): Segment => {
    const offset = isoDelta(-d.y * w, d.x * w)
    return [add(bottom, offset), add(top, offset)]
  })

  return {
    rails,
    rungs: LEAN_RUNGS.map((t): Segment => [
      lerp(rails[0][0], rails[0][1], t),
      lerp(rails[1][0], rails[1][1], t),
    ]),
  }
}

const BoardLadder = ({ x, y, scale = 1, direction }: BoardLadderProps) => {
  const { rails, rungs } = direction
    ? leaningSegments({ x, y }, direction)
    : flatSegments({ x, y }, scale)
  const railStyle = {
    stroke: shade('tool', 'left'),
    strokeWidth: 4.5 * scale,
    strokeLinecap: 'round' as const,
  }
  const rungStyle = {
    stroke: shade('tool', 'top'),
    strokeWidth: 3.5 * scale,
    strokeLinecap: 'round' as const,
  }

  return (
    <g>
      {rails.map(([a, b], i) => (
        <line key={`rail-${i}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} style={railStyle} />
      ))}
      {rungs.map(([a, b], i) => (
        <line key={`rung-${i}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} style={rungStyle} />
      ))}
    </g>
  )
}

export default BoardLadder
