import { useMemo } from 'react'

import BoardBox from './BoardBox'
import BoardCell, { BOX_SINK, PIT_FLOOR } from './BoardCell'
import BoardLadder from './BoardLadder'
import BoardTram from './BoardTram'
import ClearEffect from './ClearEffect'
import { rollingCubeFaces } from './cube'
import {
  boxSink,
  crackFrame,
  crackSink,
  frostAt,
  movingBox,
  pickUpProgress,
  playerFrame,
  pressProgress,
  restartDrop,
  restartDuration,
  slidingCell,
  swampFrame,
  swampTime,
  switchCells,
  switchProgress,
  tramProgress,
} from './frame'
import { shade } from './shade'
import { useBoardAnimation } from './useBoardAnimation'
import { useCamera } from './useCamera'
import { TILE, toScreen } from '@/game/iso'
import { occludingCells } from '@/game/occlusion'
import { isDoorOpen, isIce, isLiftRaised, nextTramSpot } from '@/game/rules'
import type { Entity, GameEvent, GameState, Point, TramSpot } from '@/game/types'

type Tram = Extract<Entity, { type: 'tram' }>

interface BoardProps {
  game: GameState
  prevGame: GameState | null
  events: GameEvent[]
  turn: number
  onAnimationEnd: () => void
  queued: number // 기다리는 입력 수
  chained: boolean // 앞 이동에서 바로 이어짐
  restarting: boolean // 처음 자리로 내려앉는 연출 중
  guideCell?: Point // 가이드가 비추는 칸
}

const same = (a: Point, b: Point) => a.x === b.x && a.y === b.y
const has = (list: Point[], p: Point) => list.some((q) => same(q, p))
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

// 무너지는 칸이 앞으로 견디는 횟수. 목록에 없는 칸은 바닥 없는 칸과 같게 본다
const crackLeft = (state: GameState, p: Point) => state.cracks.find((c) => same(c, p))?.left ?? -1

const tramNext = (tram: Tram, spot: TramSpot) => tram.cells[nextTramSpot(tram.cells, spot).at]

// 코는 다음에 갈 쪽을 가리킨다. 끝에 닿으면 오던 쪽 그대로 둔다
const tramFacing = (tram: Tram, spot: TramSpot) => {
  const at = tram.cells[spot.at]
  const ahead = tram.cells[spot.at + spot.dir]
  const back = tram.cells[spot.at - spot.dir]
  return ahead ? { x: ahead.x - at.x, y: ahead.y - at.y } : { x: at.x - back.x, y: at.y - back.y }
}

const GUIDE_MARGIN = 12

// 미끄러지는 큐브가 늘어나는 축. 아이소메트릭이라 화면에서는 대각선이다
const SLIDE_DEG = (Math.atan2(TILE.height / 2, TILE.width / 2) * 180) / Math.PI
const SQUASH_ALONG = 0.24
const SQUASH_ACROSS = 0.16

// (cx, cy)를 고정한 채 deg 축으로 늘이고 직각 방향으로 누른다
const squashTransform = (cx: number, cy: number, deg: number, squash: number) => {
  const scale = `scale(${1 + squash * SQUASH_ALONG} ${1 - squash * SQUASH_ACROSS})`
  const pivot = `translate(${cx} ${cy})`
  return `${pivot} rotate(${deg}) ${scale} rotate(${-deg}) translate(${-cx} ${-cy})`
}

const Board = ({
  game,
  prevGame,
  events,
  turn,
  onAnimationEnd,
  queued,
  chained,
  restarting,
  guideCell,
}: BoardProps) => {
  const restartSeconds = restarting ? restartDuration(game.boxes.length) : 0
  // 늪에 드나드는 이동은 뽑혀 나오고 가라앉는 만큼 연출이 길다
  const swampSeconds = swampTime(restarting ? null : prevGame, game)
  const { t, chain } = useBoardAnimation(
    turn,
    events,
    onAnimationEnd,
    queued,
    chained,
    restartSeconds,
    swampSeconds,
  )
  const moving = t < 1 && prevGame !== null
  const before = moving ? prevGame : game
  const dropping = restarting && t < 1

  const { stage, heights, boxes, ladders, leaningLadders, player } = game
  const trams = useMemo(
    () => stage.entities.filter((e): e is Tram => e.type === 'tram'),
    [stage.entities],
  )
  // 재시작은 큐브가 길을 간 것이 아니라 처음 자리에 새로 내려앉는 것이라 앞 상태를 넘기지 않는다
  const cube = playerFrame(dropping ? null : prevGame, game, events, t, chain)
  const cubeCell = { x: Math.round(cube.x), y: Math.round(cube.y) }
  // 카메라는 최종 자리가 아니라 지금 그려지는 자리를 따라간다. 순간이동은 나온 뒤에 움직인다
  const { ref, viewBox } = useCamera(game, guideCell ?? cubeCell)
  const box = movingBox(prevGame, game, events, t, chain)
  const sunk = swampFrame(dropping ? null : prevGame, game, events, t)
  const sinkingBox = boxSink(events, swampSeconds, t)
  const pickedUp = moving ? events.find((e) => e.type === 'pickedUp') : undefined
  const placed = moving ? events.find((e) => e.type === 'placed') : undefined

  // 가림 처리도 최종 자리가 아니라 지금 그려지는 자리를 본다. 순간이동으로 가라앉는 큐브가 벽에 묻힌다
  const faded = [
    ...occludingCells(heights, cubeCell, Math.round(cube.level), boxes),
    ...leaningLadders
      .filter((l) => (l.direction === 'right' || l.direction === 'down') && same(l, player))
      .flatMap((l) => occludingCells(heights, l, heights[l.y][l.x], boxes)),
  ]

  // 발판 길 칸은 바닥이 없어도 구덩이로 그린다. 값은 이웃한 길 칸의 방향이다
  const railDirs = useMemo(() => {
    const map = new Map<string, string>()
    for (const tram of trams)
      tram.cells.forEach((cell, i) =>
        map.set(
          `${cell.x}-${cell.y}`,
          [tram.cells[i - 1], tram.cells[i + 1]]
            .filter((near) => near !== undefined)
            .map((near) => `${near.x - cell.x},${near.y - cell.y}`)
            .join('|'),
        ),
      )
    return map
  }, [trams])

  // x, y는 화면 좌표, p는 칸 좌표. 메운 칸이 다시 구멍이 될 때는 사라지기 전 높이로 그린다
  const cells = useMemo(
    () =>
      heights
        .flatMap((row, y) =>
          row.map((_, x) => {
            const rail = railDirs.get(`${x}-${y}`) ?? ''
            const h = rail === '' ? Math.max(heights[y][x], before.heights[y][x]) : 0
            return { ...toScreen({ x, y }, h), h, rail, p: { x, y }, key: `${x}-${y}` }
          }),
        )
        .filter((cell) => cell.h >= 0)
        .sort((a, b) => a.p.x + a.p.y - (b.p.x + b.p.y)),
    [heights, before.heights, railDirs],
  )

  // 구덩이 벽은 옆 칸 윗면에서 시작한다. 옆 칸도 길이면 구덩이가 이어져 벽이 없다
  const wallHeight = (x: number, y: number) =>
    railDirs.has(`${x}-${y}`) ? -1 : Math.max(heights[y]?.[x] ?? -1, before.heights[y]?.[x] ?? -1)
  // 발판은 이전 자리에서 다음 자리로 미끄러진다. 코와 밝은 레일은 도착하는 순간에 다음 쪽으로 넘어간다
  const tramPhase = moving ? tramProgress(events, t, swampSeconds) : 1
  const tramFrames = trams.map((tram, i) => {
    const from = tram.cells[before.trams[i].at]
    const to = tram.cells[game.trams[i].at]
    const spot = tramPhase < 1 ? before.trams[i] : game.trams[i]
    const sliding = tramPhase > 0 && tramPhase < 1
    const facing = sliding ? { x: to.x - from.x, y: to.y - from.y } : tramFacing(tram, spot)
    const screen = toScreen(
      { x: lerp(from.x, to.x, tramPhase), y: lerp(from.y, to.y, tramPhase) },
      0,
    )
    return {
      x: screen.x,
      y: screen.y - tram.level * TILE.layer,
      depth: PIT_FLOOR + tram.level * TILE.layer,
      dx: facing.x,
      dy: facing.y,
      to,
      cell: slidingCell(from, to, tramPhase),
      next: tramNext(tram, spot),
    }
  })
  const nextRails = new Set(tramFrames.map((frame) => `${frame.next.x}-${frame.next.y}`))

  const cubeDrop = dropping ? restartDrop(t, 0, boxes.length) : null
  const cubeLevel = cube.level + (cubeDrop?.lift ?? 0)
  const cubeScreen = toScreen({ x: cube.x, y: cube.y }, cubeLevel)
  // 큐브 가운데는 칸 윗면보다 반 층 위다
  const cubeSquash =
    cube.squash > 0
      ? squashTransform(
          cubeScreen.x,
          cubeScreen.y - TILE.layer / 2,
          cube.direction === 'up' || cube.direction === 'down' ? -SLIDE_DEG : SLIDE_DEG,
          cube.squash,
        )
      : ''
  // 사다리는 이동이 시작할 때가 아니라 큐브가 그 칸에 닿은 때부터 손으로 옮겨진다
  const pickUpPhase = moving ? pickUpProgress(events, t, swampSeconds) : 1
  const carriedOpacity =
    pickedUp && !game.carrying ? 0 : pickedUp ? pickUpPhase : placed ? 1 - t : game.carrying ? 1 : 0
  const progress = moving ? t : 1
  // 문과 발판은 이동이 시작할 때가 아니라 스위치가 눌리거나 풀린 때부터 움직인다
  const linkedPhase = (cells: Point[], pressed: boolean) =>
    moving ? switchProgress(events, cells, pressed, t, swampSeconds) : 1

  // 무너지는 칸은 닳을수록 내려앉아서 그 위에 선 것도 같은 만큼 내려간다
  const sinkAt = (p: Point) => {
    const left = crackLeft(game, p)
    const was = crackLeft(before, p)
    return Math.max(left, was) >= 0 ? crackSink(crackFrame(was, left, progress).stage) : 0
  }
  // 칸 사이를 지나는 동안에는 앞뒤 칸의 내려앉은 양을 섞는다
  const standSink = (x: number, y: number) => {
    const x0 = Math.floor(x)
    const x1 = Math.ceil(x)
    const y0 = Math.floor(y)
    const y1 = Math.ceil(y)
    const near = lerp(sinkAt({ x: x0, y: y0 }), sinkAt({ x: x1, y: y0 }), x - x0)
    const far = lerp(sinkAt({ x: x0, y: y1 }), sinkAt({ x: x1, y: y1 }), x - x0)
    return lerp(near, far, y - y0)
  }

  const cubeSink = standSink(cube.x, cube.y)
  // 밀리는 상자와 발판 위의 상자. 칸과 따로 움직여서 화면 좌표로 미리 구해 둔다
  const pushedScreen = box ? toScreen({ x: box.x, y: box.y }, box.level) : null
  const boxFrames = [
    ...(box && pushedScreen
      ? [
          {
            x: pushedScreen.x,
            // 늪에 밀려 들어간 상자는 멈춘 자리에서 진흙 아래로 내려간다
            y:
              pushedScreen.y -
              TILE.layer +
              standSink(box.x, box.y) +
              (sinkingBox ? BOX_SINK * sinkingBox.deep : 0),
            to: box.to,
            cell: box.cell,
          },
        ]
      : []),
    // 발판 위의 상자는 발판과 한 몸이라 판 위에 얹혀 그려져야 한다
    ...tramFrames
      .filter((frame) => has(boxes, frame.to) && !(box && same(box.to, frame.to)))
      .map((frame) => ({ x: frame.x, y: frame.y - TILE.layer, to: frame.to, cell: frame.cell })),
  ]
  const guideLevel = guideCell ? Math.max(0, heights[guideCell.y][guideCell.x]) : 0
  const guideScreen = guideCell ? toScreen(guideCell, guideLevel) : null
  // 칸 위에 선 것은 한 층보다 높이 솟아서 위쪽을 더 잡는다
  const guideStanding =
    guideCell !== undefined &&
    (same(player, guideCell) ||
      has(boxes, guideCell) ||
      leaningLadders.some((l) => same(l, guideCell)))
  const guideTop = guideStanding ? TILE.layer * 2 : 0

  return (
    <svg ref={ref} viewBox={viewBox} className="h-full w-full">
      {cells.map((cell) => {
        const entity = stage.entities.find((e) => same(e, cell.p))
        const pressed = (state: GameState) => same(state.player, cell.p) || has(state.boxes, cell.p)
        const doorDepth = (state: GameState) =>
          entity?.type === 'door' && isDoorOpen(state, entity.id) ? 7 : TILE.layer
        // 상자가 얹힌 칸도 발판으로 찾도록 entity와 따로 본다
        const lift = stage.entities.find(
          (e): e is Extract<Entity, { type: 'lift' }> => e.type === 'lift' && same(e, cell.p),
        )
        const liftLevel = (state: GameState) =>
          lift !== undefined && isLiftRaised(state, lift.id) ? 1 : 0
        const warp = stage.entities.find(
          (e): e is Extract<Entity, { type: 'warp' }> => e.type === 'warp' && same(e, cell.p),
        )
        const swampHere = (stage.swamp?.[cell.p.y]?.[cell.p.x] ?? '.') !== '.'
        // 상자가 가라앉는 동안은 진흙이 남아 있고 그 위로 메운 자리가 드러난다
        const swamp = swampHere && (has(game.swamps, cell.p) || has(before.swamps, cell.p))
        const sunkHere = sunk && same(sunk.cell, cell.p) ? sunk : null
        const sinkingHere = sinkingBox && same(sinkingBox.at, cell.p) ? sinkingBox : null
        const left = crackLeft(game, cell.p)
        const was = crackLeft(before, cell.p)
        // 처음부터 구멍이던 칸과 무너진 뒤 메워진 칸 둘 다 상자가 만든 바닥이다
        const wasCrack = (stage.cracks?.[cell.p.y]?.[cell.p.x] ?? '.') !== '.'
        const isFilled =
          game.heights[cell.p.y][cell.p.x] >= 0 &&
          (stage.heights[cell.p.y][cell.p.x] < 0 || (wasCrack && left < 0))
        const crumble = crackFrame(was, left, progress)
        const liftPhase =
          lift === undefined
            ? 1
            : linkedPhase(switchCells(stage, lift.id), isLiftRaised(game, lift.id))
        const switchPhase =
          entity?.type === 'switch' && moving
            ? pressProgress(events, cell.p, pressed(game), t, swampSeconds)
            : progress
        const doorPhase =
          entity?.type === 'door'
            ? linkedPhase([...switchCells(stage, entity.id), cell.p], isDoorOpen(game, entity.id))
            : progress
        const raised = lerp(liftLevel(before), liftLevel(game), liftPhase)
        const crackFall = crumble.fall * TILE.layer
        const cellY = cell.y - raised * TILE.layer + sinkAt(cell.p) + crackFall
        const pickedHere = pickedUp?.type === 'pickedUp' && same(pickedUp.at, cell.p)
        const flatLadder = has(ladders, cell.p)
          ? 1
          : pickedHere && has(before.ladders, cell.p)
            ? 1 - pickUpPhase
            : 0
        const placedOpacity = (l: Point) =>
          placed?.type === 'placed' && same(placed.ladder, l) ? t : 1
        const leaning = [
          ...leaningLadders
            .filter((l) => same(l, cell.p))
            .map((l) => `${l.direction}:${placedOpacity(l)}`),
          ...(pickedHere
            ? before.leaningLadders
                .filter((l) => same(l, cell.p))
                .map((l) => `${l.direction}:${1 - pickUpPhase}`)
            : []),
        ].join('|')

        const tram = tramFrames.find((frame) => same(frame.cell, cell.p)) ?? null
        const drawCube = same(cube.cell, cell.p) && !(game.cleared && !moving)
        const drawBoxes = boxFrames.filter((frame) => same(frame.cell, cell.p))
        const movedBoxHere = boxFrames.some((frame) => same(frame.to, cell.p))
        const goalEffect = same(cell.p, stage.goal) && game.cleared && !moving
        const droppingBox = dropping ? boxes.findIndex((b) => same(b, cell.p)) : -1
        const boxDrop = droppingBox >= 0 ? restartDrop(t, droppingBox + 1, boxes.length) : null
        // 재시작하면 메운 칸은 제자리에서 사라지고 무너졌던 칸은 큐브와 같은 빠르기로 돌아온다
        const restored = dropping
          ? Math.sign(before.heights[cell.p.y][cell.p.x] - heights[cell.p.y][cell.p.x])
          : 0
        const overlay =
          drawBoxes.length > 0 || drawCube || goalEffect || boxDrop !== null || tram !== null

        return (
          <BoardCell
            key={cell.key}
            x={cell.x}
            y={cellY}
            h={cell.h + raised}
            parity={(cell.p.x + cell.p.y) % 2 === 1}
            goal={same(cell.p, stage.goal)}
            filled={isFilled}
            ice={isIce(game, cell.p)}
            frost={frostAt(events, cell.p, t, swampSeconds)}
            crack={Math.max(left, was) >= 0}
            crackStage={crumble.stage}
            crackBroken={crumble.broken}
            crackFall={crackFall}
            crackShadow={crumble.shadow}
            crackSeed={(cell.p.x * 3 + cell.p.y * 5) % 4}
            hidden={isFilled && movedBoxHere}
            swamp={swamp}
            swampFilled={swampHere && !has(game.swamps, cell.p) ? (sinkingHere?.filled ?? 1) : 0}
            swampStage={sunkHere ? sunkHere.stage : -1}
            swampDeep={sunkHere?.deep ?? sinkingHere?.deep ?? 0}
            faded={has(faded, cell.p)}
            entity={entity?.type === 'switch' || entity?.type === 'door' ? entity.type : null}
            lift={lift !== undefined}
            warp={warp !== undefined}
            switchDepth={lerp(pressed(before) ? 2 : 9, pressed(game) ? 2 : 9, switchPhase)}
            doorDepth={lerp(doorDepth(before), doorDepth(game), doorPhase)}
            box={has(boxes, cell.p) && !movedBoxHere && boxDrop === null}
            rail={cell.rail}
            railNext={nextRails.has(cell.key)}
            pitWallLeft={cell.rail === '' ? -1 : wallHeight(cell.p.x, cell.p.y - 1)}
            pitWallRight={cell.rail === '' ? -1 : wallHeight(cell.p.x - 1, cell.p.y)}
            blockOpacity={
              restored > 0 ? 1 - t : restored < 0 ? (cubeDrop?.opacity ?? 1) : crumble.opacity
            }
            flatLadder={flatLadder}
            leaning={leaning}
          >
            {overlay ? (
              <>
                {tram && (
                  <BoardTram x={tram.x} y={tram.y} depth={tram.depth} dx={tram.dx} dy={tram.dy} />
                )}
                {drawBoxes.map((frame) => (
                  <BoardBox key={`${frame.to.x}-${frame.to.y}`} x={frame.x} y={frame.y} />
                ))}
                {boxDrop && (
                  <g opacity={boxDrop.opacity}>
                    <BoardBox x={cell.x} y={cellY - TILE.layer - boxDrop.lift * TILE.layer} />
                  </g>
                )}
                {drawCube && (
                  <g
                    opacity={(cubeDrop ? cubeDrop.opacity : 1) * cube.fade}
                    transform={`translate(0 ${cubeSink}) ${cubeSquash}`}
                  >
                    {rollingCubeFaces(cube.x, cube.y, cubeLevel, cube.direction, cube.angle).map(
                      (f) => (
                        <polygon
                          key={f.face}
                          points={f.points}
                          style={{ fill: shade('player', f.face) }}
                        />
                      ),
                    )}
                  </g>
                )}
                {drawCube && carriedOpacity > 0 && (
                  <g opacity={carriedOpacity * cube.fade}>
                    <BoardLadder x={cubeScreen.x} y={cubeScreen.y - TILE.layer - 2 + cubeSink} />
                  </g>
                )}
                {goalEffect && <ClearEffect x={cell.x} y={cell.y} />}
              </>
            ) : undefined}
          </BoardCell>
        )
      })}
      {guideScreen && (
        <rect
          data-guide="cell"
          x={guideScreen.x - TILE.width / 2 - GUIDE_MARGIN}
          y={guideScreen.y - TILE.height / 2 - GUIDE_MARGIN - guideTop}
          width={TILE.width + GUIDE_MARGIN * 2}
          height={TILE.height + TILE.lip + guideLevel * TILE.layer + GUIDE_MARGIN * 2 + guideTop}
          fill="none"
        />
      )}
    </svg>
  )
}

export default Board
