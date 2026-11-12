import { useEffect, useRef } from 'react'

import { CROW, crowBodyPath, crowLegs, crowPose, crowSeats, crowTransform, crowWing } from './view'

const INK = { fill: 'var(--color-amb-crow)' }

interface CrowParts {
  shadow: SVGEllipseElement | null
  bird: SVGGElement | null
  far: SVGPathElement | null
  body: SVGPathElement | null
  legs: SVGPathElement | null
  near: SVGPathElement | null
}

interface BoardCrowProps {
  x: number
  y: number // 칸 윗면 중심
  at: number // 바퀴 안에서 시작하는 ms
  cycle: number
  leave: boolean
  crows: number
  side: number
}

const BoardCrow = ({ x, y, at, cycle, leave, crows, side }: BoardCrowProps) => {
  const seats = crowSeats(crows)
  const parts = useRef<Partial<CrowParts>[]>([])
  const now = useRef({ leave, side })

  useEffect(() => {
    now.current = { leave, side }
  })

  // 문서 시계로 매 프레임 자세 갱신, 날아가는 쪽과 때는 떠나는 순간 값 고정
  useEffect(() => {
    let frame = 0
    let takeoff = CROW.takeoff
    let flight: number | null = null
    const tick = () => {
      const clock = Number(document.timeline.currentTime ?? performance.now())
      const ms = (((clock - at) % cycle) + cycle) % cycle
      if (now.current.leave && ms < takeoff) takeoff = ms
      if (flight === null && ms >= takeoff) flight = now.current.leave ? now.current.side : 0
      for (const seat of crowSeats(crows)) {
        const part = parts.current[seat.index]
        if (!part) continue
        const pose = crowPose(ms, seat.index, takeoff, seat.face, flight ?? 0)
        part.shadow?.setAttribute('cx', String(seat.x + pose.x))
        part.shadow?.setAttribute('cy', String(seat.y + pose.y))
        part.shadow?.setAttribute('opacity', String(pose.shadow))
        part.bird?.setAttribute('transform', crowTransform(seat, pose))
        part.bird?.setAttribute('opacity', String(pose.opacity))
        part.far?.setAttribute('d', crowWing('far', pose.flap, pose.fold, pose.perch))
        part.body?.setAttribute('d', crowBodyPath(pose.tilt, pose.caw))
        part.legs?.setAttribute('d', crowLegs(pose.perch))
        part.near?.setAttribute('d', crowWing('near', pose.flap, pose.fold, pose.perch))
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [at, cycle, crows])

  const keep = (index: number, name: keyof CrowParts) => (el: SVGElement | null) => {
    parts.current[index] = { ...parts.current[index], [name]: el }
  }

  return (
    <g transform={`translate(${x} ${y})`}>
      {seats.map((seat) => (
        <g key={seat.index}>
          <ellipse
            ref={keep(seat.index, 'shadow')}
            cx={seat.x}
            cy={seat.y}
            rx={CROW.shadow.rx}
            ry={CROW.shadow.ry}
            opacity={0}
            style={{ fill: 'var(--color-amb-crow-shadow)' }}
          />
          <g ref={keep(seat.index, 'bird')} opacity={0} style={INK}>
            <path ref={keep(seat.index, 'far')} />
            <path ref={keep(seat.index, 'body')} />
            <path ref={keep(seat.index, 'legs')} />
            <path ref={keep(seat.index, 'near')} />
          </g>
        </g>
      ))}
    </g>
  )
}

export default BoardCrow
