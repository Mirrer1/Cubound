import { animate } from 'motion/react'
import { useEffect, useRef, useState } from 'react'

import { type ViewBox, viewBoxFor } from './camera'
import { zoneIndexAt } from '@/game/camera'
import type { GameState } from '@/game/types'

export const useCamera = (game: GameState) => {
  const zones = game.stage.zones ?? []
  const [zoneIndex, setZoneIndex] = useState(0)
  const nextIndex = zones.length > 0 ? zoneIndexAt(zones, game.player, zoneIndex) : 0
  if (nextIndex !== zoneIndex) setZoneIndex(nextIndex)

  const target = viewBoxFor(game.heights, zones[nextIndex])
  const targetKey = target.join(' ')
  const [viewBox, setViewBox] = useState<ViewBox>(target)
  const current = useRef(viewBox)

  useEffect(() => {
    const from = current.current
    const to = targetKey.split(' ').map(Number) as ViewBox
    const controls = animate(0, 1, {
      duration: 0.6,
      ease: 'easeInOut',
      onUpdate: (p) => {
        const next = from.map((v, i) => v + (to[i] - v) * p) as ViewBox
        current.current = next
        setViewBox(next)
      },
    })
    return () => controls.stop()
  }, [targetKey])

  return viewBox.join(' ')
}
