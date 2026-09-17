import { useMemo } from 'react'

import BoardBox from './BoardBox'
import BoardCell from './BoardCell'
import BoardLadder from './BoardLadder'
import ClearEffect from './ClearEffect'
import { rollingCubeFaces } from './cube'
import { movingBox, playerFrame } from './frame'
import { shade } from './shade'
import { useBoardAnimation } from './useBoardAnimation'
import { useCamera } from './useCamera'
import { TILE, toScreen } from '@/game/iso'
import { occludingCells } from '@/game/occlusion'
import { isDoorOpen, standHeight } from '@/game/rules'
import type { GameEvent, GameState, Point } from '@/game/types'

interface BoardProps {
  game: GameState
  prevGame: GameState | null
  events: GameEvent[]
  turn: number
  onAnimationEnd: () => void
  queued: number // 기다리는 입력 수
  chained: boolean // 앞 이동에서 바로 이어짐
  guideCell?: Point // 가이드가 비추는 칸
}

const same = (a: Point, b: Point) => a.x === b.x && a.y === b.y
const has = (list: Point[], p: Point) => list.some((q) => same(q, p))
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

const Board = ({
  game,
  prevGame,
  events,
  turn,
  onAnimationEnd,
  queued,
  chained,
  guideCell,
}: BoardProps) => {
  const { t, chain } = useBoardAnimation(turn, events, onAnimationEnd, queued, chained)
  const viewBox = useCamera(game, guideCell)
  const moving = t < 1 && prevGame !== null
  const before = moving ? prevGame : game

  const { stage, heights, boxes, ladders, leaningLadders, player } = game
  const cube = playerFrame(prevGame, game, events, t, chain)
  const box = movingBox(prevGame, events, t, chain)
  const pickedUp = moving ? events.find((e) => e.type === 'pickedUp') : undefined
  const placed = moving ? events.find((e) => e.type === 'placed') : undefined

  const faded = [
    ...occludingCells(heights, player, standHeight(game, player)),
    ...leaningLadders
      .filter((l) => (l.direction === 'right' || l.direction === 'down') && same(l, player))
      .flatMap((l) => occludingCells(heights, l, heights[l.y][l.x])),
  ]

  // x, y는 화면 좌표, p는 칸 좌표
  const cells = useMemo(
    () =>
      heights
        .flatMap((row, y) =>
          row.map((h, x) => ({ ...toScreen({ x, y }, h), h, p: { x, y }, key: `${x}-${y}` })),
        )
        .filter((cell) => cell.h >= 0)
        .sort((a, b) => a.p.x + a.p.y - (b.p.x + b.p.y)),
    [heights],
  )

  const cubeScreen = toScreen({ x: cube.x, y: cube.y }, cube.level)
  const carriedOpacity =
    pickedUp && !game.carrying ? 0 : pickedUp ? t : placed ? 1 - t : game.carrying ? 1 : 0
  const progress = moving ? t : 1
  const guideScreen = guideCell
    ? toScreen(guideCell, Math.max(0, heights[guideCell.y][guideCell.x]))
    : null

  return (
    <svg viewBox={viewBox} className="h-full w-full">
      {cells.map((cell) => {
        const entity = stage.entities.find((e) => same(e, cell.p))
        const isFilled = stage.heights[cell.p.y][cell.p.x] < 0
        const pressed = (state: GameState) => same(state.player, cell.p) || has(state.boxes, cell.p)
        const doorDepth = (state: GameState) =>
          entity?.type === 'door' && isDoorOpen(state, entity.id) ? 7 : TILE.layer
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
        const overlay = drawBox || drawCube || goalEffect

        return (
          <BoardCell
            key={cell.key}
            x={cell.x}
            y={cell.y}
            h={cell.h}
            parity={(cell.p.x + cell.p.y) % 2 === 1}
            goal={same(cell.p, stage.goal)}
            filled={isFilled}
            hidden={isFilled && box !== null && same(box.to, cell.p)}
            faded={has(faded, cell.p)}
            entity={entity?.type === 'switch' || entity?.type === 'door' ? entity.type : null}
            switchDepth={lerp(pressed(before) ? 4 : 11, pressed(game) ? 4 : 11, progress)}
            doorDepth={lerp(doorDepth(before), doorDepth(game), progress)}
            box={has(boxes, cell.p) && !(box && same(box.to, cell.p))}
            flatLadder={flatLadder}
            leaning={leaning}
          >
            {overlay ? (
              <>
                {drawBox && boxScreen && <BoardBox x={boxScreen.x} y={boxScreen.y - TILE.layer} />}
                {drawCube &&
                  rollingCubeFaces(cube.x, cube.y, cube.level, cube.direction, cube.angle).map(
                    (f) => (
                      <polygon
                        key={f.face}
                        points={f.points}
                        style={{ fill: shade('player', f.face) }}
                      />
                    ),
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
          x={guideScreen.x - TILE.width / 2}
          y={guideScreen.y - TILE.height / 2 - TILE.layer * 2}
          width={TILE.width}
          height={TILE.height + TILE.layer * 2 + TILE.lip}
          fill="none"
        />
      )}
    </svg>
  )
}

export default Board
