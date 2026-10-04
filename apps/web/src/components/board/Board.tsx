import { useMemo } from 'react'

import BoardBox from './BoardBox'
import BoardCell from './BoardCell'
import BoardClear from './BoardClear'
import BoardLadder from './BoardLadder'
import BoardSeed from './BoardSeed'
import BoardTether from './BoardTether'
import BoardTram from './BoardTram'
import BoardWater from './BoardWater'
import {
  type Tram,
  boardCells,
  clamp01,
  coversRope,
  crackFrame,
  crackLeft,
  cubeFirst,
  filledCells,
  fillingCellKey,
  frostAt,
  has,
  lerp,
  pressProgress,
  railDirsOf,
  restartDrop,
  restartDuration,
  same,
  sceneFrame,
  sinkAt,
  smooth,
  swampTime,
  switchCells,
  switchProgress,
  vineLooks,
  wallHeight,
} from './frame'
import { WATER, postBands, shade, waterLook } from './view'
import { TILE } from '@/game/iso'
import { isDoorOpen, isIce, isLiftRaised } from '@/game/rules'
import type { Entity, GameEvent, GameState, Point } from '@/game/types'
import { useBoardAnimation } from '@/hooks/useBoardAnimation'
import { useBoardCamera } from '@/hooks/useBoardCamera'

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

// 재시작에 메운 바닥이 사라지는 진행도
const RESTORE_FADE = 0.25

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

  const { stage, heights, boxes, ladders, leaningLadders } = game
  const trams = useMemo(
    () => stage.entities.filter((e): e is Tram => e.type === 'tram'),
    [stage.entities],
  )

  const filled = useMemo(
    () => filledCells(heights, stage.heights, stage.entities, game.vines),
    [heights, stage.heights, stage.entities, game.vines],
  )

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
    guideCell,
  })
  // 카메라가 따라가는 지금 그려지는 자리, 순간이동은 나온 뒤
  const { ref, viewBox } = useBoardCamera(game, guideCell ?? scene.cubeCell)

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

  const walls = { heights, before: scene.before, fillingKey, vineFrame: scene.vineFrame, railDirs }
  // 문과 발판이 움직이기 시작하는 때, 스위치가 눌리거나 풀린 때
  const linkedPhase = (cells: Point[], pressed: boolean) =>
    scene.moving ? switchProgress(events, cells, pressed, t, swampSeconds) : 1

  return (
    <svg ref={ref} viewBox={viewBox} className="h-full w-full">
      {cubeFirst(cells, scene.cube.cell, scene.cube.last).map((cell) => {
        const entity = stage.entities.find((e) => same(e, cell.p))
        const pressed = (state: GameState) => same(state.player, cell.p) || has(state.boxes, cell.p)
        const doorDepth = (state: GameState) =>
          entity?.type === 'door' && isDoorOpen(state, entity.id) ? 0 : TILE.layer
        // 상자가 얹힌 칸도 찾도록 entity와 따로 보는 발판
        const lift = stage.entities.find(
          (e): e is Extract<Entity, { type: 'lift' }> => e.type === 'lift' && same(e, cell.p),
        )
        const liftLevel = (state: GameState) =>
          lift !== undefined && isLiftRaised(state, lift.id) ? 1 : 0
        const warp = stage.entities.find(
          (e): e is Extract<Entity, { type: 'warp' }> => e.type === 'warp' && same(e, cell.p),
        )
        const capHere = scene.caps.find((capFrame) => same(capFrame.cell, cell.p))
        const water = waterLook(stage, cell.p)
        const rippleHere = scene.ripple && same(scene.ripple.at, cell.p) ? scene.ripple : null
        const swampHere = (stage.swamp?.[cell.p.y]?.[cell.p.x] ?? '.') !== '.'
        // 상자가 가라앉는 동안 남는 진흙, 그 위로 드러나는 메운 자리
        const swamp = swampHere && (has(game.swamps, cell.p) || has(scene.before.swamps, cell.p))
        const sunkHere = scene.sunk && same(scene.sunk.cell, cell.p) ? scene.sunk : null
        const sinkingHere =
          scene.sinkingBox && same(scene.sinkingBox.at, cell.p) ? scene.sinkingBox : null
        const left = crackLeft(game, cell.p)
        const was = crackLeft(scene.before, cell.p)
        // 상자가 만든 바닥, 처음부터 구멍이던 칸과 무너진 뒤 메워진 칸
        const wasCrack = (stage.cracks?.[cell.p.y]?.[cell.p.x] ?? '.') !== '.'
        const isFilled =
          game.heights[cell.p.y][cell.p.x] >= 0 &&
          (stage.heights[cell.p.y][cell.p.x] < 0 || (wasCrack && left < 0))
        const crumble = crackFrame(was, left, scene.crackPhase)
        const liftPhase =
          lift === undefined
            ? 1
            : linkedPhase(switchCells(stage, lift.id), isLiftRaised(game, lift.id))
        const switchPhase =
          entity?.type === 'switch' && scene.moving
            ? pressProgress(events, cell.p, pressed(game), t, swampSeconds)
            : scene.progress
        const doorPhase =
          entity?.type === 'door'
            ? linkedPhase([...switchCells(stage, entity.id), cell.p], isDoorOpen(game, entity.id))
            : scene.progress
        const raised = lerp(liftLevel(scene.before), liftLevel(game), liftPhase)
        const crackFall = crumble.fall * TILE.layer
        // 솟거나 재시작으로 내려가는 씨앗 칸은 그 순간 높이
        const seedHere = scene.seedFrame.get(cell.key)
        const seedShift = seedHere ? cell.h - seedHere.level : 0
        const cellY =
          cell.y -
          raised * TILE.layer +
          sinkAt(scene.crackView, cell.p) +
          crackFall +
          seedShift * TILE.layer
        const pickedHere = scene.pickedUp?.type === 'pickedUp' && same(scene.pickedUp.at, cell.p)
        const flatLadder = has(ladders, cell.p)
          ? 1
          : pickedHere && has(scene.before.ladders, cell.p)
            ? 1 - scene.pickUpPhase
            : 0
        const placedOpacity = (l: Point) =>
          scene.placed?.type === 'placed' && same(scene.placed.ladder, l) ? scene.ownT : 1
        const leaning = [
          ...leaningLadders
            .filter((l) => same(l, cell.p))
            .map((l) => `${l.direction}:${placedOpacity(l)}`),
          ...(pickedHere
            ? scene.before.leaningLadders
                .filter((l) => same(l, cell.p))
                .map((l) => `${l.direction}:${1 - scene.pickUpPhase}`)
            : []),
        ].join('|')

        // 상자가 먼저 메운 길 칸은 덩굴이 못 자라 싹 제외
        const vineHere = scene.vineFrame.get(cell.key)
        const vine =
          vineHere && (cell.pit || vineHere.kind === 'grown' || vineHere.kind === 'root')
            ? vineHere
            : null
        // 판이 차오르거나 내려가는 칸의 드러나는 구덩이 벽
        const pitShown = cell.pit || (vine?.kind === 'grown' && vine.rise < 1)

        const tram = scene.tramFrames.find((frame) => same(frame.cell, cell.p)) ?? null
        const drawCube = same(scene.cube.cell, cell.p) && !(game.cleared && !scene.moving)
        const drawBoxes = scene.boxFrames.filter((frame) => same(frame.cell, cell.p))
        const movedBoxHere = scene.boxFrames.some((frame) => same(frame.to, cell.p))
        const goalEffect = same(cell.p, stage.goal) && game.cleared && !scene.moving
        const droppingBox = scene.dropping ? boxes.findIndex((b) => same(b, cell.p)) : -1
        const boxDrop = droppingBox >= 0 ? restartDrop(t, droppingBox + 1, boxes.length) : null
        // 재시작하면 제자리에서 사라지는 메운 칸, 큐브와 같은 빠르기로 돌아오는 무너졌던 칸
        const restored =
          scene.dropping && !seedHere
            ? Math.sign(scene.before.heights[cell.p.y][cell.p.x] - heights[cell.p.y][cell.p.x])
            : 0
        const overlay =
          drawBoxes.length > 0 || drawCube || goalEffect || boxDrop !== null || tram !== null

        return (
          <BoardCell
            key={cell.key}
            x={cell.x}
            y={cellY}
            h={cell.h - seedShift + raised}
            parity={(cell.p.x + cell.p.y) % 2 === 1}
            goal={same(cell.p, stage.goal)}
            filled={
              (isFilled || (restored > 0 && stage.heights[cell.p.y][cell.p.x] < 0)) &&
              vine?.kind !== 'grown'
            }
            ice={isIce(game, cell.p)}
            frost={frostAt(events, cell.p, t, swampSeconds)}
            crack={Math.max(left, was) >= 0}
            crackStage={crumble.stage}
            crackBroken={crumble.broken}
            crackFall={crackFall}
            crackShadow={crumble.shadow}
            crackSeed={(cell.p.x * 3 + cell.p.y * 5) % 4}
            hidden={isFilled && movedBoxHere && scene.before.heights[cell.p.y][cell.p.x] < 0}
            swamp={swamp}
            swampFilled={swampHere && !has(game.swamps, cell.p) ? (sinkingHere?.filled ?? 1) : 0}
            swampRisen={sunkHere ? sunkHere.risen : -1}
            swampDeep={sunkHere?.deep ?? sinkingHere?.deep ?? 0}
            mushroom={capHere !== undefined}
            mushroomPress={capHere?.press ?? 0}
            mushroomWither={capHere?.wither ?? 0}
            water={water.depth}
            waterBankX={water.bankX}
            waterBankY={water.bankY}
            waterSideLeft={water.sideLeft}
            waterSideRight={water.sideRight}
            waterRing={rippleHere?.size ?? 0}
            waterRingOpacity={rippleHere?.opacity ?? 0}
            moorRange={scene.moor.get(cell.key) ?? -1}
            post={postBands(stage, cell.p)}
            faded={has(scene.faded, cell.p)}
            entity={entity?.type === 'switch' || entity?.type === 'door' ? entity.type : null}
            lift={lift !== undefined}
            warp={warp !== undefined}
            switchDepth={lerp(pressed(scene.before) ? 2 : 9, pressed(game) ? 2 : 9, switchPhase)}
            doorDepth={lerp(doorDepth(scene.before), doorDepth(game), doorPhase)}
            box={has(boxes, cell.p) && !movedBoxHere && boxDrop === null}
            rail={cell.rail}
            railNext={scene.nextRails.has(cell.key)}
            pitWallLeft={pitShown ? wallHeight(walls, cell.p.x, cell.p.y - 1) : -1}
            pitWallRight={pitShown ? wallHeight(walls, cell.p.x - 1, cell.p.y) : -1}
            blockOpacity={
              restored > 0
                ? 1 - smooth(clamp01(t / RESTORE_FADE))
                : restored < 0
                  ? (scene.cubeDrop?.opacity ?? 1)
                  : crumble.opacity
            }
            flatLadder={flatLadder}
            leaning={leaning}
            vine={vine?.kind ?? null}
            vineEnter={vine?.enter ?? null}
            vineLeave={vine?.leave ?? null}
            vineGrowth={vine?.growth ?? 1}
            vineRise={vine?.rise ?? 1}
            vineTongue={vine?.tongue ?? 0}
            vineSprout={vine?.sprout ?? 0}
            vineSproutOpacity={vine?.sproutOpacity ?? 1}
            vineHard={vine?.hard ?? 0}
            vineKnot={vine?.knot ?? 0}
            vineOpacity={vine?.opacity ?? 1}
            seed={
              has(game.seeds, cell.p)
                ? 1
                : pickedHere && has(scene.before.seeds, cell.p)
                  ? 1 - scene.pickUpPhase
                  : 0
            }
            seedLand={seedHere?.land ?? 0}
            seedStalk={seedHere?.stalk ?? 0}
            seedBud={seedHere?.bud ?? 0}
            seedLeaves={seedHere?.leaves ?? 0}
            seedTree={seedHere?.tree ?? 0}
            seedTreeNext={seedHere?.treeNext ?? 0}
            seedTreeP={seedHere?.treeP ?? 1}
            seedStakes={seedHere?.stakes ?? 0}
            seedStakesNext={seedHere?.stakesNext ?? 0}
            seedStakeP={seedHere?.stakeP ?? 1}
          >
            {overlay ? (
              <>
                {tram && (
                  <BoardTram x={tram.x} y={tram.y} depth={tram.depth} dx={tram.dx} dy={tram.dy} />
                )}
                {drawBoxes.map((frame) =>
                  scene.box && same(frame.to, scene.box.to) && scene.boxShown !== null ? (
                    <BoardWater
                      key={`${frame.to.x}-${frame.to.y}`}
                      part="box"
                      x={frame.x}
                      y={frame.y}
                      shown={scene.boxShown}
                    />
                  ) : (
                    <BoardBox key={`${frame.to.x}-${frame.to.y}`} x={frame.x} y={frame.y} />
                  ),
                )}
                {boxDrop && (
                  <g opacity={boxDrop.opacity}>
                    {water.depth > 0 ? (
                      <BoardWater
                        part="box"
                        x={cell.x}
                        y={cellY - (water.depth + boxDrop.lift) * TILE.layer}
                        shown={Math.min(TILE.layer, WATER.lip + boxDrop.lift * TILE.layer)}
                      />
                    ) : (
                      <BoardBox x={cell.x} y={cellY - TILE.layer - boxDrop.lift * TILE.layer} />
                    )}
                  </g>
                )}
                {drawCube && (
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
                {drawCube && scene.carriedOpacity > 0 && (
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
                {drawCube && scene.plantedSeed && scene.plantedSeed.opacity > 0 && (
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
                {goalEffect && <BoardClear x={cell.x} y={cell.y} />}
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
      {scene.guideScreen && (
        <rect
          data-guide="cell"
          x={scene.guideScreen.x - TILE.width / 2 - GUIDE_MARGIN}
          y={scene.guideScreen.y - TILE.height / 2 - GUIDE_MARGIN - scene.guideTop}
          width={TILE.width + GUIDE_MARGIN * 2}
          height={
            TILE.height +
            TILE.lip +
            scene.guideLevel * TILE.layer +
            GUIDE_MARGIN * 2 +
            scene.guideTop
          }
          fill="none"
        />
      )}
    </svg>
  )
}

export default Board
