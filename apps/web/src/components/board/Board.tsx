import { type CSSProperties, useMemo } from 'react'

import BoardBox from './BoardBox'
import BoardCell from './BoardCell'
import BoardClear from './BoardClear'
import BoardLadder from './BoardLadder'
import BoardSeed from './BoardSeed'
import BoardTether from './BoardTether'
import BoardTram from './BoardTram'
import BoardWater from './BoardWater'
import BoardWhirlpool from './BoardWhirlpool'
import {
  type Tram,
  boardCells,
  cellLook,
  coversRope,
  cubeFirst,
  filledCells,
  fillingCellKey,
  railDirsOf,
  restartDuration,
  same,
  sceneFrame,
  swampTime,
  vineLooks,
} from './frame'
import { LEAN_LOOP, WATER, leanShift, pullLanes, shade } from './view'
import { TILE } from '@/game/iso'
import type { GameEvent, GameState, Point } from '@/game/types'
import { useBoardAnimation } from '@/hooks/useBoardAnimation'
import { useBoardCamera } from '@/hooks/useBoardCamera'
import { useLoop } from '@/hooks/useLoop'

interface BoardProps {
  game: GameState
  prevGame: GameState | null
  events: GameEvent[]
  turn: number
  onAnimationEnd: () => void
  queued: number // 기다리는 입력 수
  chained: boolean // 앞 이동에서 바로 이어지는 이동
  restarting: boolean // 처음 자리로 내려앉는 연출 중
  guideCell?: Point // 가이드가 비추는 칸
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
  // 늪에 드나드는 이동은 뽑혀 나오고 가라앉는 만큼 긴 연출
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

  const { stage, heights } = game
  const trams = useMemo(
    () => stage.entities.filter((e): e is Tram => e.type === 'tram'),
    [stage.entities],
  )

  const filled = useMemo(
    () => filledCells(heights, stage.heights, stage.entities, game.vines),
    [heights, stage.heights, stage.entities, game.vines],
  )

  const lanes = useMemo(() => pullLanes(stage), [stage])

  const scene = sceneFrame({
    game,
    prevGame,
    events,
    t,
    chain,
    restarting,
    swampSeconds,
    trams,
    filled,
    lanes,
    guideCell,
  })
  // 카메라가 따라가는 지금 그려지는 자리, 순간이동은 나온 뒤
  const { ref, viewBox } = useBoardCamera(game, guideCell ?? scene.cubeCell)
  const leanLoop = useLoop(LEAN_LOOP, 1600)
  const cubeLean = scene.cubeLean
    ? (leanShift(scene.cubeLean.toward, scene.cubeLean.amp) as CSSProperties)
    : undefined
  const rowLean = scene.rowLean
    ? (leanShift(scene.rowLean.toward, scene.rowLean.amp) as CSSProperties)
    : undefined

  const railDirs = useMemo(() => railDirsOf(trams), [trams])

  // 덩굴 뿌리와 길 칸, 구덩이로 그릴 칸을 가리는 용도, 그 순간의 모습은 vineFrame 몫
  const vines = useMemo(() => vineLooks(game), [game])

  // cells 메모의 의존성이라 함께 메모, 안 하면 React Compiler 검사가 cells 메모를 못 지키는 탓
  const fillingKey = useMemo(
    () => fillingCellKey(scene.box, events, vines),
    [scene.box, events, vines],
  )

  const cells = useMemo(
    () => boardCells(heights, scene.before.heights, railDirs, vines, fillingKey),
    [heights, scene.before.heights, railDirs, vines, fillingKey],
  )

  const lookOf = cellLook({ stage, game, events, t, swampSeconds, fillingKey, railDirs, scene })

  return (
    <svg ref={ref} viewBox={viewBox} className="h-full w-full">
      {cubeFirst(cells, scene.cube.cell, scene.cube.last).map((cell) => {
        const { cellY, look, over } = lookOf(cell)

        return (
          <BoardCell key={cell.key} {...look}>
            {over.overlay ? (
              <>
                {over.tram && (
                  <BoardTram
                    x={over.tram.x}
                    y={over.tram.y}
                    depth={over.tram.depth}
                    dx={over.tram.dx}
                    dy={over.tram.dy}
                  />
                )}
                {over.drawBoxes.map((frame) =>
                  scene.box && same(frame.to, scene.box.to) && scene.boxShown !== null ? (
                    <g
                      key={`${frame.to.x}-${frame.to.y}`}
                      ref={scene.rowLean ? leanLoop : undefined}
                      className={scene.rowLean ? 'whirl-lean' : undefined}
                      style={rowLean}
                    >
                      <BoardWater part="box" x={frame.x} y={frame.y} shown={scene.boxShown} />
                    </g>
                  ) : (
                    <BoardBox key={`${frame.to.x}-${frame.to.y}`} x={frame.x} y={frame.y} />
                  ),
                )}
                {over.whirlBoxes.map((frame) => (
                  <BoardWhirlpool key={`${frame.to.x}-${frame.to.y}`} part="boat" {...frame} />
                ))}
                {over.boxDrop && (
                  <g opacity={over.boxDrop.opacity}>
                    {over.waterDepth > 0 ? (
                      <BoardWater
                        part="box"
                        x={cell.x}
                        y={cellY - (over.waterDepth + over.boxDrop.lift) * TILE.layer}
                        shown={Math.min(TILE.layer, WATER.lip + over.boxDrop.lift * TILE.layer)}
                      />
                    ) : (
                      <BoardBox
                        x={cell.x}
                        y={cellY - TILE.layer - over.boxDrop.lift * TILE.layer}
                      />
                    )}
                  </g>
                )}
                <g
                  ref={cubeLean && over.drawCube ? leanLoop : undefined}
                  className={cubeLean && over.drawCube ? 'whirl-lean' : undefined}
                  style={over.drawCube ? cubeLean : undefined}
                >
                  {over.drawCube && (
                    <g
                      opacity={(scene.cubeDrop ? scene.cubeDrop.opacity : 1) * scene.cube.fade}
                      transform={`translate(0 ${scene.cubeSink - scene.cube.lift}) ${scene.cubeSquash}`}
                    >
                      {scene.cubeFaces.map((f) => (
                        <polygon
                          key={f.face}
                          points={f.points}
                          style={{ fill: shade('player', f.face) }}
                        />
                      ))}
                    </g>
                  )}
                  {over.drawCube && scene.carriedOpacity > 0 && (
                    <g opacity={scene.carriedOpacity * scene.cube.fade}>
                      {scene.carried === 'seed' ? (
                        <BoardSeed
                          x={scene.carriedBase.x}
                          y={scene.carriedBase.y}
                          part="seed"
                          tilt={scene.bump}
                        />
                      ) : (
                        <BoardLadder
                          x={scene.carriedBase.x}
                          y={scene.carriedBase.y - 2}
                          tilt={scene.ladderBump}
                        />
                      )}
                    </g>
                  )}
                  {over.drawCube && scene.plantedSeed && scene.plantedSeed.opacity > 0 && (
                    <g
                      opacity={scene.plantedSeed.opacity}
                      transform={`translate(${scene.plantedSeed.x} ${scene.plantedSeed.y}) scale(${scene.plantedSeed.scale}) translate(${-scene.plantedSeed.x} ${-scene.plantedSeed.y})`}
                    >
                      <BoardSeed
                        x={scene.plantedSeed.x}
                        y={scene.plantedSeed.y}
                        part="seed"
                        tilt={scene.plantTilt}
                      />
                    </g>
                  )}
                </g>
                {over.goalEffect && <BoardClear x={cell.x} y={cell.y} />}
              </>
            ) : undefined}
          </BoardCell>
        )
      })}
      <defs>
        <mask
          id="rope-behind-scene.cube"
          maskUnits="userSpaceOnUse"
          x="-100000"
          y="-100000"
          width="200000"
          height="200000"
        >
          <rect x="-100000" y="-100000" width="200000" height="200000" fill="white" />
          <g transform={`translate(0 ${scene.cubeSink - scene.cube.lift}) ${scene.cubeSquash}`}>
            {scene.cubeFaces.map((f) => (
              <polygon key={f.face} points={f.points} fill="black" />
            ))}
          </g>
        </mask>
      </defs>
      {scene.tethers.map((tether) => (
        <g
          key={tether.points}
          mask={coversRope(scene.cube, tether) ? 'url(#rope-behind-scene.cube)' : undefined}
        >
          <BoardTether part="rope" points={tether.points} opacity={tether.opacity} />
        </g>
      ))}
      {scene.guide && (
        <rect
          data-guide="cell"
          x={scene.guide.x}
          y={scene.guide.y}
          width={scene.guide.width}
          height={scene.guide.height}
          fill="none"
        />
      )}
    </svg>
  )
}

export default Board
