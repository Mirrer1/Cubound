import { type CSSProperties, useEffect, useMemo } from 'react'

import BoardBox from './BoardBox'
import BoardCell from './BoardCell'
import BoardClear from './BoardClear'
import { type BehindGoal } from './BoardFloor'
import BoardIceStone from './BoardIceStone'
import BoardLadder from './BoardLadder'
import BoardSeed from './BoardSeed'
import BoardSluice from './BoardSluice'
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
  waterAtOf,
} from './frame'
import {
  type AmbientKind,
  LEAN_LOOP,
  type ViewBox,
  WATER,
  ambientCells,
  ambientPlan,
  leanShift,
  pullLanes,
  shade,
} from './view'
import { TILE } from '@/game/iso'
import type { GameEvent, GameState, Point } from '@/game/types'
import { useAmbient } from '@/hooks/useAmbient'
import { useBoardAnimation } from '@/hooks/useBoardAnimation'
import { useBoardCamera } from '@/hooks/useBoardCamera'
import { useLoop } from '@/hooks/useLoop'
import { cycleOf, parseStageId } from '@/stages'

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
  overview: boolean // 판 전체를 한 화면에 담는 보기
  onShowsAll: (showsAll: boolean) => void // 평소 화면에 판 전체가 들어오는지 알림
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
  overview,
  onShowsAll,
}: BoardProps) => {
  const restartSeconds = restarting ? restartDuration(game.boxes.length, game.stones.length) : 0
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

  // 수위 판은 물 높이를 따라 바뀌는 물길
  const lanes = useMemo(() => pullLanes(stage, waterAtOf(game, game, 1)), [stage, game])

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
  const { ref, viewBox, showsAll } = useBoardCamera(
    game,
    guideCell ?? scene.cubeCell,
    overview,
    guideCell ? undefined : scene.cube,
  )
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

  const plan = useMemo(() => ambientPlan(stage, cycleOf(parseStageId(stage.id).world)), [stage])
  const pickAmbient = (kind: AmbientKind, round: number, slot: number, last: Point[]) =>
    ambientCells(game, kind, round, slot, last, viewBox.split(' ').map(Number) as ViewBox)
  const ambient = useAmbient(stage.id, plan, pickAmbient)

  const lookOf = cellLook({
    stage,
    game,
    events,
    t,
    swampSeconds,
    fillingKey,
    railDirs,
    scene,
    ambient,
  })
  // 물에 잠긴 골, 앞줄 칸이 자기 수면 위에 다시 비추는 자리
  const goalCell = cells.find((cell) => same(cell.p, stage.goal))
  const goalLook = goalCell ? lookOf(goalCell).look : null
  const sunkGoal: BehindGoal | null =
    goalLook && goalLook.sluice.sunk > 0
      ? {
          x: goalLook.x,
          y: goalLook.y,
          parity: goalLook.parity,
          sunk: goalLook.sluice.sunk,
          depth: goalLook.water.depth,
        }
      : null
  const isFrontOfGoal = (p: Point) =>
    p.x - stage.goal.x >= 0 &&
    p.y - stage.goal.y >= 0 &&
    p.x - stage.goal.x + p.y - stage.goal.y > 0 &&
    p.x - stage.goal.x <= 1 &&
    p.y - stage.goal.y <= 1
  // 장치 위로 올라온 물건 앞에 다시 그리는 꼭지
  const tapLooks = scene.taps.flatMap((tap) => {
    const device = cells.find((cell) => same(cell.p, tap.device))
    return device ? [{ ...tap, look: lookOf(device).look }] : []
  })

  useEffect(() => onShowsAll(showsAll), [showsAll, onShowsAll])

  return (
    <svg ref={ref} viewBox={viewBox} className="h-full w-full">
      {cubeFirst(
        scene.box ? cubeFirst(cells, scene.box.cell) : cells,
        scene.cube.cell,
        scene.cube.last,
      ).map((cell) => {
        const { cellY, look, over } = lookOf(cell)
        const taps = tapLooks.filter((tap) => same(tap.cell, cell.p))

        return (
          <BoardCell
            key={cell.key}
            {...look}
            behindGoal={sunkGoal && isFrontOfGoal(cell.p) ? sunkGoal : null}
          >
            {over.overlay || taps.length > 0 ? (
              <>
                {over.tram && (
                  <g opacity={over.tram.opacity}>
                    <BoardTram
                      x={over.tram.x}
                      y={over.tram.y}
                      depth={over.tram.depth}
                      dx={over.tram.dx}
                      dy={over.tram.dy}
                    />
                  </g>
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
                {over.thawBoxes.map((thaw) => (
                  <BoardWater
                    key={`${thaw.to.x}-${thaw.to.y}`}
                    part="box"
                    x={cell.x}
                    y={thaw.y}
                    shown={thaw.shown}
                  />
                ))}
                {over.stones.map((frame) => (
                  <BoardIceStone key={`${frame.to.x}-${frame.to.y}`} part="stone" {...frame} />
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
                {taps.map((tap) => (
                  <BoardSluice
                    key={`${tap.device.x}-${tap.device.y}`}
                    part="tap"
                    x={tap.look.x}
                    y={tap.look.y}
                    open={tap.look.sluice.open}
                    turn={tap.look.sluice.turn}
                  />
                ))}
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
      {scene.lockGuide && (
        <rect
          data-guide="lock"
          x={scene.lockGuide.x}
          y={scene.lockGuide.y}
          width={scene.lockGuide.width}
          height={scene.lockGuide.height}
          fill="none"
        />
      )}
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
