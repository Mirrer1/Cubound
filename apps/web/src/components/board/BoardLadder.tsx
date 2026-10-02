import { type TopTilt, darken, shade } from './view'
import { TILE, isoDelta } from '@/game/iso'
import type { Direction, Point } from '@/game/types'

// 높은 칸 위로 살짝 솟아 가려져도 보이게 한다
const TIP = 10
// 바닥에 놓인 사다리는 칸 윗면에서 살짝 떠 있다
const LIFT = 2
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
  tilt?: TopTilt // 들고 있는 사다리가 기운 큐브를 따라 기울 때
}

const add = (a: Point, b: Point) => ({ x: a.x + b.x, y: a.y + b.y })
const lerp = (a: Point, b: Point, t: number) => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
})

const flatSegments = (origin: Point, s: number, tilt?: TopTilt) => {
  const center = { x: origin.x, y: origin.y - LIFT }
  const point = (u: number, v: number) =>
    add(add(center, isoDelta(u, v)), tilt ? tilt(u, v, LIFT) : { x: 0, y: 0 })

  return {
    rails: [-0.26, 0.26].map((v): Segment => [point(-0.42 * s, v * s), point(0.42 * s, v * s)]),
    rungs: RUNGS.map((u): Segment => [point(u * s, -0.26 * s), point(u * s, 0.26 * s)]),
  }
}

const leaningSegments = (center: Point, direction: Direction) => {
  const d = DIRECTION_DELTA[direction]
  const bottom = add(center, isoDelta(d.x * 0.3, d.y * 0.3))
  const top = add(center, add(isoDelta(d.x * 0.5, d.y * 0.5), { x: 0, y: -TILE.layer - TIP }))
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

const BoardLadder = ({ x, y, scale = 1, direction, tilt }: BoardLadderProps) => {
  const { rails, rungs } = direction
    ? leaningSegments({ x, y }, direction)
    : flatSegments({ x, y }, scale, tilt)
  // 바닥에 놓인 사다리는 위에서 보아 옆대가 빛을 받고 가로대가 그 아래로 내려앉는다
  const railStyle = {
    stroke: direction ? shade('tool', 'left') : shade('tool', 'top'),
    strokeWidth: (direction ? 4.5 : 7) * scale,
    strokeLinecap: 'round' as const,
  }
  const rungStyle = {
    stroke: direction ? shade('tool', 'top') : darken('tool', 16),
    strokeWidth: (direction ? 3.5 : 5) * scale,
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
