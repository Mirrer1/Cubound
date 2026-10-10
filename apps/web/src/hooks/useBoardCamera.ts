import { animate, useMotionValue, useReducedMotion } from 'motion/react'
import { useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'

import { lerp } from '@/components/board/frame'
import {
  type Box,
  type Cam,
  type ViewBox,
  type ViewSize,
  camOf,
  cameraHeights,
  coversBox,
  homeBox,
  lerpCam,
  minTileFor,
  viewBoxFor,
  viewBoxOfCam,
  zoneBox,
} from '@/components/board/view'
import { zoneIndexAt } from '@/game/camera'
import { TILE, toScreen } from '@/game/iso'
import type { GameState, Point } from '@/game/types'

const ZONE_SECONDS = 0.6
// 순간이동과 가이드처럼 비출 자리가 멀리 건너뛸 때만 쓰는 옮겨 가기, 튕김 없음
const LOOK_SPRING = { type: 'spring', duration: 0.45, bounce: 0 } as const
const LEAP = TILE.width * 1.5 // 큐브에 붙여 따라가지 않고 옮겨 가는 거리
const CAUGHT = 2 // 옮겨 가다 다시 붙는 남은 거리
const REDUCED_OVERVIEW_SECONDS = 0.2
const RESIZE_SECONDS = 0.3
const ZOOM_TILE = 61 // 폰 세로에서 확대해 보이는 칸 폭 px

interface ZoneMove {
  from: ViewBox // 구역이 바뀔 때 보이던 화면
  to: Box
  p: number
}

// focus가 있으면 큐브 대신 비추는 그 칸의 구역, overview면 판 전체, cube는 구르는 중인 큐브 자리
export const useBoardCamera = (
  game: GameState,
  focus?: Point,
  overview = false,
  cube?: Point & { level: number },
) => {
  const zones = game.stage.zones ?? []
  const [zoneIndex, setZoneIndex] = useState(0)
  const nextIndex = zones.length > 0 ? zoneIndexAt(zones, focus ?? game.player, zoneIndex) : 0
  if (nextIndex !== zoneIndex) setZoneIndex(nextIndex)

  const heights = cameraHeights(game.stage.heights, game.heights)
  const [view, setView] = useState<ViewSize>({ width: 0, height: 0 })
  const minTile = minTileFor(view, ZOOM_TILE)
  const { box: home, tile } = homeBox(game.stage.heights, heights, zones, nextIndex, view, minTile)
  const target = overview ? zoneBox(heights) : home
  const targetKey = `${target.minX} ${target.minY} ${target.maxX} ${target.maxY} ${overview}`
  const [box, setBox] = useState<Box>(target)
  const [boxOverview, setBoxOverview] = useState(overview) // box에 맞춘 보기, 전환 보간 시작 전 화면 기준
  const [zoneMove, setZoneMove] = useState<ZoneMove | null>(null)
  const shown = useRef<ViewBox | null>(null)
  const shownMeasured = useRef(false) // shown이 화면 크기를 잰 뒤의 화면인 경우
  const shownOverview = useRef(overview)
  const boxKey = useRef<string | null>(targetKey) // box에 담긴 목표, 같은 목표로 다시 불린 effect의 보간 생략
  const leaping = useRef(false)
  const reduced = useReducedMotion()

  const cell = focus ?? game.player
  const lookAt = cube ? toScreen(cube, cube.level) : toScreen(cell, heights[cell.y][cell.x])
  const lookKey = `${lookAt.x} ${lookAt.y}`
  const [look, setLook] = useState<Point>(lookAt)
  const lookX = useMotionValue(lookAt.x)
  const lookY = useMotionValue(lookAt.y)

  const ref = useRef<SVGSVGElement>(null)

  // 구역이 바뀌면 보이던 화면에서 새 구역 화면으로 곧게 옮기는 보간
  // 구역 범위 보간은 큐브 따라가기에서 가운데 놓기로 바뀌는 순간 화면이 튀는 탓에 제외
  useEffect(() => {
    const from = shown.current
    if (!from || boxKey.current === targetKey) return
    // 처음 잰 크기로 정해진 목표는 렌더 중에 바로 맞춘 범위
    if (!shownMeasured.current) {
      boxKey.current = targetKey
      return
    }
    const [minX, minY, maxX, maxY, toggled] = targetKey.split(' ')
    const to = { minX: +minX, minY: +minY, maxX: +maxX, maxY: +maxY }
    const toggle = String(shownOverview.current) !== toggled
    shownOverview.current = toggled === 'true'
    boxKey.current = null
    const controls = animate(0, 1, {
      duration: toggle && reduced ? REDUCED_OVERVIEW_SECONDS : ZONE_SECONDS,
      ease: 'easeInOut',
      onUpdate: (p) => setZoneMove({ from, to, p }),
      onComplete: () => {
        boxKey.current = targetKey
        setBox(to)
        setBoxOverview(toggled === 'true')
        setZoneMove(null)
      },
    })
    return () => controls.stop()
  }, [targetKey, reduced])

  // 구르는 큐브에 붙여 같이 움직이는 비출 자리, 멀리 건너뛸 때는 따라잡을 때까지 옮겨 가기
  useEffect(() => {
    const [x, y] = lookKey.split(' ').map(Number)
    const far = Math.hypot(x - lookX.get(), y - lookY.get())
    if (far > LEAP) leaping.current = true
    else if (far < CAUGHT) leaping.current = false
    if (!leaping.current) {
      lookX.jump(x)
      lookY.jump(y)
      return
    }
    const controls = [
      animate(lookX, x, { ...LOOK_SPRING, onComplete: () => (leaping.current = false) }),
      animate(lookY, y, LOOK_SPRING),
    ]
    return () => controls.forEach((c) => c.stop())
  }, [lookKey, lookX, lookY])

  useEffect(() => {
    const update = () => setLook({ x: lookX.get(), y: lookY.get() })
    const stops = [lookX.on('change', update), lookY.on('change', update)]
    return () => stops.forEach((stop) => stop())
  }, [lookX, lookY])

  // 재고 난 뒤 화면 크기가 바뀌면 보이던 화면에서 옮겨 가는 보간, 폰 주소창이 접히고 펴지는 경우
  const [fitted, setFitted] = useState<ViewSize>(view) // 화면이 맞춰진 크기
  if (fitted.width === 0 && view.width > 0) {
    setFitted(view)
    setBox(target)
    setBoxOverview(overview)
  }
  const resizing = fitted.width > 0 && view !== fitted
  const [resize, setResize] = useState<{ from: Cam; view: ViewSize; p: number } | null>(null)

  // 첫 화면을 그리기 전에 재는 크기, 재기 전 화면이 한 번 비쳤다 확대되는 것 방지
  useLayoutEffect(() => {
    const svg = ref.current
    if (!svg) return

    const measure = ({ width, height }: { width: number; height: number }) =>
      setView((previous) =>
        previous.width === width && previous.height === height ? previous : { width, height },
      )
    measure(svg.getBoundingClientRect())
    // 바뀐 크기를 그리기 전에 반영, 늦으면 옛 viewBox가 새 크기로 늘어난 한 프레임
    const observer = new ResizeObserver(([entry]) => flushSync(() => measure(entry.contentRect)))
    observer.observe(svg)
    return () => observer.disconnect()
  }, [])

  const at = (size: ViewSize) => {
    if (zoneMove ? overview : boxOverview) return viewBoxFor(zoneMove?.to ?? box, size, look, 0)
    const floor = minTileFor(size, ZOOM_TILE)
    const fixed = homeBox(game.stage.heights, heights, zones, nextIndex, size, floor).tile
    return viewBoxFor(zoneMove?.to ?? box, size, look, floor, fixed)
  }
  const settled = at(view)
  const moved = zoneMove
    ? (zoneMove.from.map((v, i) => lerp(v, settled[i], zoneMove.p)) as ViewBox)
    : settled
  // 크기가 바뀌기 직전에 보이던 가운데와 배율, 앞 보간 도중이면 그 순간 값
  const shownCam = resize
    ? lerpCam(resize.from, camOf(at(resize.view), resize.view), resize.p)
    : camOf(at(fitted), fitted)
  const viewBox =
    resize && resize.view === view
      ? viewBoxOfCam(lerpCam(resize.from, camOf(moved, view), resize.p), view)
      : resizing
        ? viewBoxOfCam(shownCam, view)
        : moved

  const shownFrom = useEffectEvent(() => shownCam)
  useEffect(() => {
    if (!resizing) return
    const from = shownFrom()
    const controls = animate(0, 1, {
      duration: RESIZE_SECONDS,
      ease: 'easeInOut',
      onUpdate: (p) => setResize({ from, view, p }),
      onComplete: () => {
        setFitted(view)
        setResize(null)
      },
    })
    return () => controls.stop()
  }, [resizing, view])

  useEffect(() => {
    shown.current = viewBox
    shownMeasured.current = view.width > 0
  })

  // 큐브 구역을 보는 평소 화면에 판 전체가 이미 들어오는 경우
  const showsAll =
    view.width > 0 && coversBox(viewBoxFor(home, view, look, minTile, tile), zoneBox(heights))

  return { ref, viewBox: viewBox.join(' '), showsAll }
}
