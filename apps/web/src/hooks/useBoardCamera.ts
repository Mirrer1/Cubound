import { animate } from 'motion/react'
import { useEffect, useRef, useState } from 'react'

import { lerp } from '@/components/board/frame'
import {
  type Box,
  type ViewBox,
  type ViewSize,
  cameraHeights,
  viewBoxFor,
  zoneBox,
} from '@/components/board/view'
import { zoneIndexAt } from '@/game/camera'
import { toScreen } from '@/game/iso'
import type { GameState, Point } from '@/game/types'

const ZONE_SECONDS = 0.6
const LOOK_SECONDS = 0.26 // 구르는 큐브를 놓치지 않는 이동 연출과 비슷한 길이

interface ZoneMove {
  from: ViewBox // 구역이 바뀔 때 보이던 화면
  to: Box
  p: number
}

// focus가 있으면 큐브 대신 비추는 그 칸의 구역
export const useBoardCamera = (game: GameState, focus?: Point) => {
  const zones = game.stage.zones ?? []
  const [zoneIndex, setZoneIndex] = useState(0)
  const nextIndex = zones.length > 0 ? zoneIndexAt(zones, focus ?? game.player, zoneIndex) : 0
  if (nextIndex !== zoneIndex) setZoneIndex(nextIndex)

  const heights = cameraHeights(game.stage.heights, game.heights)
  const target = zoneBox(heights, zones[nextIndex])
  const targetKey = `${target.minX} ${target.minY} ${target.maxX} ${target.maxY}`
  const [box, setBox] = useState<Box>(target)
  const [zoneMove, setZoneMove] = useState<ZoneMove | null>(null)
  const shown = useRef<ViewBox | null>(null)

  const cell = focus ?? game.player
  const lookAt = toScreen(cell, heights[cell.y][cell.x])
  const lookKey = `${lookAt.x} ${lookAt.y}`
  const [look, setLook] = useState<Point>(lookAt)
  const currentLook = useRef(look)

  const ref = useRef<SVGSVGElement>(null)
  const [view, setView] = useState<ViewSize>({ width: 0, height: 0 })

  // 구역이 바뀌면 보이던 화면에서 새 구역 화면으로 곧게 옮기는 보간
  // 구역 범위 보간은 큐브 따라가기에서 가운데 놓기로 바뀌는 순간 화면이 튀는 탓에 제외
  useEffect(() => {
    const from = shown.current
    if (!from) return
    const [minX, minY, maxX, maxY] = targetKey.split(' ').map(Number)
    const to = { minX, minY, maxX, maxY }
    const controls = animate(0, 1, {
      duration: ZONE_SECONDS,
      ease: 'easeInOut',
      onUpdate: (p) => setZoneMove({ from, to, p }),
      onComplete: () => {
        setBox(to)
        setZoneMove(null)
      },
    })
    return () => controls.stop()
  }, [targetKey])

  // 칸을 옮길 때마다 부드럽게 옮기는 비출 자리
  useEffect(() => {
    const from = currentLook.current
    const [x, y] = lookKey.split(' ').map(Number)
    const controls = animate(0, 1, {
      duration: LOOK_SECONDS,
      ease: 'easeOut',
      onUpdate: (p) => {
        const next = { x: lerp(from.x, x, p), y: lerp(from.y, y, p) }
        currentLook.current = next
        setLook(next)
      },
    })
    return () => controls.stop()
  }, [lookKey])

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

  const settled = viewBoxFor(zoneMove?.to ?? box, view, look)
  const viewBox = zoneMove
    ? (zoneMove.from.map((v, i) => lerp(v, settled[i], zoneMove.p)) as ViewBox)
    : settled

  useEffect(() => {
    shown.current = viewBox
  })

  return { ref, viewBox: viewBox.join(' ') }
}
