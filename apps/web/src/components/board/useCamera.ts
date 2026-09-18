import { animate } from 'motion/react'
import { useEffect, useRef, useState } from 'react'

import { type Box, type ViewSize, viewBoxFor, zoneBox } from './camera'
import { zoneIndexAt } from '@/game/camera'
import type { GameState, Point } from '@/game/types'

const lerp = (a: number, b: number, t: number) => a + (b - a) * t

// focus가 있으면 큐브 대신 그 칸이 속한 구역을 비춘다
export const useCamera = (game: GameState, focus?: Point) => {
  const zones = game.stage.zones ?? []
  const [zoneIndex, setZoneIndex] = useState(0)
  const nextIndex = zones.length > 0 ? zoneIndexAt(zones, focus ?? game.player, zoneIndex) : 0
  if (nextIndex !== zoneIndex) setZoneIndex(nextIndex)

  const target = zoneBox(game.heights, zones[nextIndex])
  const targetKey = `${target.minX} ${target.minY} ${target.maxX} ${target.maxY}`
  const [box, setBox] = useState<Box>(target)
  const current = useRef(box)

  const ref = useRef<SVGSVGElement>(null)
  const [view, setView] = useState<ViewSize>({ width: 0, height: 0 })

  // 구역이 바뀔 때만 보간하고 화면 크기 변화는 바로 반영한다
  useEffect(() => {
    const from = current.current
    const [minX, minY, maxX, maxY] = targetKey.split(' ').map(Number)
    const controls = animate(0, 1, {
      duration: 0.6,
      ease: 'easeInOut',
      onUpdate: (p) => {
        const next = {
          minX: lerp(from.minX, minX, p),
          minY: lerp(from.minY, minY, p),
          maxX: lerp(from.maxX, maxX, p),
          maxY: lerp(from.maxY, maxY, p),
        }
        current.current = next
        setBox(next)
      },
    })
    return () => controls.stop()
  }, [targetKey])

  useEffect(() => {
    const svg = ref.current
    if (!svg) return

    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setView((previous) =>
        previous.width === width && previous.height === height ? previous : { width, height },
      )
    })
    observer.observe(svg)
    return () => observer.disconnect()
  }, [])

  return { ref, viewBox: viewBoxFor(box, view).join(' ') }
}
