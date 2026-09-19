import { useMemo } from 'react'

import BoardBox from './BoardBox'
import BoardCell from './BoardCell'
import BoardLadder from './BoardLadder'
import ClearEffect from './ClearEffect'
import { rollingCubeFaces } from './cube'
import { crackFrame, movingBox, playerFrame, restartDrop, restartDuration } from './frame'
import { shade } from './shade'
import { useBoardAnimation } from './useBoardAnimation'
import { useCamera } from './useCamera'
import { TILE, toScreen } from '@/game/iso'
import { occludingCells } from '@/game/occlusion'
import { isDoorOpen, isIce, isLiftRaised, standHeight } from '@/game/rules'
import type { Entity, GameEvent, GameState, Point } from '@/game/types'

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

const GUIDE_MARGIN = 12

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
  const { t, chain } = useBoardAnimation(
    turn,
    events,
    onAnimationEnd,
    queued,
    chained,
    restartSeconds,
  )
  const { ref, viewBox } = useCamera(game, guideCell)
  const moving = t < 1 && prevGame !== null
  const before = moving ? prevGame : game
  const dropping = restarting && t < 1

  const { stage, heights, boxes, ladders, leaningLadders, player } = game
  const cube = playerFrame(prevGame, game, events, t, chain)
  const box = movingBox(prevGame, game, events, t, chain)
  const pickedUp = moving ? events.find((e) => e.type === 'pickedUp') : undefined
  const placed = moving ? events.find((e) => e.type === 'placed') : undefined

  const faded = [
    ...occludingCells(heights, player, standHeight(game, player)),
    ...leaningLadders
      .filter((l) => (l.direction === 'right' || l.direction === 'down') && same(l, player))
      .flatMap((l) => occludingCells(heights, l, heights[l.y][l.x])),
  ]

  // x, y는 화면 좌표, p는 칸 좌표. 메운 칸이 다시 구멍이 될 때는 사라지기 전 높이로 그린다
  const cells = useMemo(
    () =>
      heights
        .flatMap((row, y) =>
          row.map((_, x) => {
            const h = Math.max(heights[y][x], before.heights[y][x])
            return { ...toScreen({ x, y }, h), h, p: { x, y }, key: `${x}-${y}` }
          }),
        )
        .filter((cell) => cell.h >= 0)
        .sort((a, b) => a.p.x + a.p.y - (b.p.x + b.p.y)),
    [heights, before.heights],
  )

  const cubeDrop = dropping ? restartDrop(t, 0, boxes.length) : null
  const cubeLevel = cube.level + (cubeDrop?.lift ?? 0)
  const cubeScreen = toScreen({ x: cube.x, y: cube.y }, cubeLevel)
  const carriedOpacity =
    pickedUp && !game.carrying ? 0 : pickedUp ? t : placed ? 1 - t : game.carrying ? 1 : 0
  const progress = moving ? t : 1
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
        const left = crackLeft(game, cell.p)
        const was = crackLeft(before, cell.p)
        // 처음부터 구멍이던 칸과 무너진 뒤 메워진 칸 둘 다 상자가 만든 바닥이다
        const wasCrack = (stage.cracks?.[cell.p.y]?.[cell.p.x] ?? '.') !== '.'
        const isFilled =
          game.heights[cell.p.y][cell.p.x] >= 0 &&
          (stage.heights[cell.p.y][cell.p.x] < 0 || (wasCrack && left < 0))
        const crumble = crackFrame(was, left, progress)
        const raised = lerp(liftLevel(before), liftLevel(game), progress)
        const cellY = cell.y - raised * TILE.layer + crumble.fall * TILE.layer
        const pickedHere = pickedUp?.type === 'pickedUp' && same(pickedUp.at, cell.p)
        const flatLadder = has(ladders, cell.p)
          ? 1
          : pickedHere && has(before.ladders, cell.p)
            ? 1 - t
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
                .map((l) => `${l.direction}:${1 - t}`)
            : []),
        ].join('|')

        const drawCube = same(cube.cell, cell.p) && !(game.cleared && !moving)
        const drawBox = box !== null && same(box.cell, cell.p)
        const boxScreen = box ? toScreen({ x: box.x, y: box.y }, box.level) : null
        const goalEffect = same(cell.p, stage.goal) && game.cleared && !moving
        const droppingBox = dropping ? boxes.findIndex((b) => same(b, cell.p)) : -1
        const boxDrop = droppingBox >= 0 ? restartDrop(t, droppingBox + 1, boxes.length) : null
        // 재시작하면 메운 칸은 제자리에서 사라지고 무너졌던 칸은 돌아온다
        const restored = dropping
          ? Math.sign(before.heights[cell.p.y][cell.p.x] - heights[cell.p.y][cell.p.x])
          : 0
        const overlay = drawBox || drawCube || goalEffect || boxDrop !== null

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
            crack={Math.max(left, was) >= 0}
            crackDepth={crumble.depth}
            crackSpread={crumble.spread}
            crackSeed={(cell.p.x * 3 + cell.p.y * 5) % 4}
            hidden={isFilled && box !== null && same(box.to, cell.p)}
            faded={has(faded, cell.p)}
            entity={entity?.type === 'switch' || entity?.type === 'door' ? entity.type : null}
            lift={lift !== undefined}
            switchDepth={lerp(pressed(before) ? 4 : 11, pressed(game) ? 4 : 11, progress)}
            doorDepth={lerp(doorDepth(before), doorDepth(game), progress)}
            box={has(boxes, cell.p) && !(box && same(box.to, cell.p)) && boxDrop === null}
            blockOpacity={restored > 0 ? 1 - t : restored < 0 ? t : crumble.opacity}
            flatLadder={flatLadder}
            leaning={leaning}
          >
            {overlay ? (
              <>
                {drawBox && boxScreen && <BoardBox x={boxScreen.x} y={boxScreen.y - TILE.layer} />}
                {boxDrop && (
                  <g opacity={boxDrop.opacity}>
                    <BoardBox x={cell.x} y={cellY - TILE.layer - boxDrop.lift * TILE.layer} />
                  </g>
                )}
                {drawCube && (
                  <g opacity={cubeDrop ? cubeDrop.opacity : 1}>
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
                  <g opacity={carriedOpacity}>
                    <BoardLadder x={cubeScreen.x} y={cubeScreen.y - TILE.layer - 2} />
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
