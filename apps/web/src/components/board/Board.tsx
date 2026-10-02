import { useMemo } from 'react'

import BoardBox from './BoardBox'
import BoardCell from './BoardCell'
import BoardClear from './BoardClear'
import BoardLadder from './BoardLadder'
import BoardSeed from './BoardSeed'
import BoardTram from './BoardTram'
import BoardWater from './BoardWater'
import {
  SLIDE_DEG,
  type Tram,
  boardCells,
  boxFramesOf,
  boxSink,
  carriedBaseOf,
  carriedOpacityOf,
  carriedTilt,
  clamp01,
  crackFrame,
  crackLeft,
  crackProgress,
  cubeFirst,
  filledCells,
  fillingCellKey,
  frostAt,
  has,
  ladderTilt,
  lerp,
  movingBox,
  mushroomFrames,
  ownProgress,
  pickUpProgress,
  plantTiltOf,
  plantedSeedAt,
  plantingSeed,
  playerFrame,
  pressProgress,
  railDirsOf,
  restartDrop,
  restartDuration,
  rippleOf,
  rollingTilt,
  same,
  seedFrames,
  sinkAt,
  smooth,
  squashTransform,
  standSink,
  stepProgress,
  swampFrame,
  swampTime,
  switchCells,
  switchProgress,
  tramFramesOf,
  tramProgress,
  vineFrames,
  vineLooks,
  wallHeight,
} from './frame'
import { WATER, floatShownAt, rollingCubeFaces, shade, waterLook } from './view'
import { TILE, toScreen } from '@/game/iso'
import { fadedCells } from '@/game/occlusion'
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
  const moving = t < 1 && prevGame !== null
  const before = moving ? prevGame : game
  const dropping = restarting && t < 1

  const { stage, heights, boxes, ladders, leaningLadders, player } = game
  const trams = useMemo(
    () => stage.entities.filter((e): e is Tram => e.type === 'tram'),
    [stage.entities],
  )
  // 재시작은 처음 자리에 새로 내려앉는 것이라 넘기지 않는 앞 상태
  const cube = playerFrame(dropping ? null : prevGame, game, events, t, chain)
  const cubeCell = { x: Math.round(cube.x), y: Math.round(cube.y) }
  // 카메라가 따라가는 지금 그려지는 자리, 순간이동은 나온 뒤
  const { ref, viewBox } = useBoardCamera(game, guideCell ?? cubeCell)
  const box = movingBox(prevGame, game, events, t, chain)
  const sunk = swampFrame(dropping ? null : prevGame, game, events, t)
  const sinkingBox = boxSink(events, swampSeconds, t)
  const ripple = moving ? rippleOf(events, t, swampSeconds) : null
  const pickedUp = moving ? events.find((e) => e.type === 'pickedUp') : undefined
  const placed = moving ? events.find((e) => e.type === 'placed') : undefined

  const filled = useMemo(
    () => filledCells(heights, stage.heights, stage.entities, game.vines),
    [heights, stage.heights, stage.entities, game.vines],
  )

  const seedFrame = seedFrames(moving ? before : null, game, events, t, swampSeconds, dropping)
  // 솟는 씨앗 칸은 그 순간 높이로 재는 가림, 다 솟기 전 앞 칸은 흐리기 제외
  const shown = heights.map((row, y) =>
    row.map((h, x) => {
      const frame = seedFrame.get(`${x}-${y}`)
      return frame ? Math.round(frame.level) : h
    }),
  )
  // 가림 처리도 지금 그려지는 자리 기준, 순간이동으로 가라앉는 큐브가 벽에 묻히는 탓
  const faded = fadedCells(shown, cubeCell, Math.round(cube.level), game, filled)

  const railDirs = useMemo(() => railDirsOf(trams), [trams])

  // 덩굴 뿌리와 길 칸, 구덩이로 그릴 칸을 가리는 용도, 그 순간의 모습은 vineFrame 몫
  const vines = useMemo(() => vineLooks(game), [game])
  const vineFrame = vineFrames(moving ? before : null, game, events, t, swampSeconds, dropping)

  // cells 메모의 의존성이라 함께 메모, 안 하면 React Compiler 검사가 cells 메모를 못 지키는 탓
  const fillingKey = useMemo(() => fillingCellKey(box, events, vines), [box, events, vines])

  const cells = useMemo(
    () => boardCells(heights, before.heights, railDirs, vines, fillingKey),
    [heights, before.heights, railDirs, vines, fillingKey],
  )

  const walls = { heights, before, fillingKey, vineFrame, railDirs }
  const tramPhase = moving ? tramProgress(events, t, swampSeconds) : 1
  const tramFrames = tramFramesOf({ trams, before, game, tramPhase })
  const nextRails = new Set(tramFrames.map((frame) => `${frame.next.x}-${frame.next.y}`))

  const cubeDrop = dropping ? restartDrop(t, 0, boxes.length) : null
  const cubeLevel = cube.level + (cubeDrop?.lift ?? 0)
  const cubeScreen = toScreen({ x: cube.x, y: cube.y }, cubeLevel)
  // 칸 윗면보다 반 층 위인 큐브 가운데
  const cubeSquash =
    cube.squash > 0
      ? squashTransform(
          cubeScreen.x,
          cubeScreen.y - TILE.layer / 2,
          cube.direction === 'up' || cube.direction === 'down' ? -SLIDE_DEG : SLIDE_DEG,
          cube.squash,
        )
      : ''
  // 한 수 안에서 일어나는 변화의 진행도, 씨앗이 솟는 수는 이동 몫이 먼저 끝나는 탓
  const stepT = moving ? stepProgress(events, t, swampSeconds) : 1
  // 놓는 사다리는 바람이 불기 전에 다 놓이는 진행도
  const ownT = moving ? ownProgress(events, t, swampSeconds) : 1
  // 사다리가 손으로 옮겨지기 시작하는 때, 큐브가 그 칸에 닿은 때
  const pickUpPhase = moving ? pickUpProgress(events, t, swampSeconds) : 1
  const carriedOpacity = carriedOpacityOf({ pickedUp, placed, game, pickUpPhase, ownT })
  const carried = game.carrying ?? before.carrying
  const progress = moving ? t : 1
  // 문과 발판이 움직이기 시작하는 때, 스위치가 눌리거나 풀린 때
  const linkedPhase = (cells: Point[], pressed: boolean) =>
    moving ? switchProgress(events, cells, pressed, t, swampSeconds) : 1

  const crackPhase = moving ? crackProgress(events, stepT) : 1
  const crackView = { game, before, crackPhase }

  const cubeSink = standSink(crackView, cube.x, cube.y)
  const carriedBase = carriedBaseOf(cubeScreen, cubeSink, cube)
  const rolling = rollingTilt(cube, chain)
  const bump = carriedTilt({ events, moving, t, swampSeconds, cube, rolling })
  const ladderBump = ladderTilt(bump)
  const planting = moving ? plantingSeed(events, t, swampSeconds) : null
  const plantedSeed = plantedSeedAt({ planting, cubeScreen, cubeSink, cube })
  const plantTilt = plantTiltOf(planting, cube)
  const caps = mushroomFrames(dropping ? null : prevGame, game, events, t, chain)
  const boxFrames = boxFramesOf({ box, sinkingBox, tramFrames, boxes, crackView })
  const boxShown = box ? floatShownAt(stage, box) : null
  const guideLevel = guideCell ? Math.max(0, heights[guideCell.y][guideCell.x]) : 0
  const guideScreen = guideCell ? toScreen(guideCell, guideLevel) : null
  // 한 층보다 높이 솟는 칸 위에 선 것, 위쪽을 더 잡는 여유
  const guideStanding =
    guideCell !== undefined &&
    (same(player, guideCell) ||
      has(boxes, guideCell) ||
      leaningLadders.some((l) => same(l, guideCell)))
  const guideTop = guideStanding ? TILE.layer * 2 : 0

  return (
    <svg ref={ref} viewBox={viewBox} className="h-full w-full">
      {cubeFirst(cells, cube.cell, cube.last).map((cell) => {
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
        const capHere = caps.find((capFrame) => same(capFrame.cell, cell.p))
        const water = waterLook(stage, cell.p)
        const rippleHere = ripple && same(ripple.at, cell.p) ? ripple : null
        const swampHere = (stage.swamp?.[cell.p.y]?.[cell.p.x] ?? '.') !== '.'
        // 상자가 가라앉는 동안 남는 진흙, 그 위로 드러나는 메운 자리
        const swamp = swampHere && (has(game.swamps, cell.p) || has(before.swamps, cell.p))
        const sunkHere = sunk && same(sunk.cell, cell.p) ? sunk : null
        const sinkingHere = sinkingBox && same(sinkingBox.at, cell.p) ? sinkingBox : null
        const left = crackLeft(game, cell.p)
        const was = crackLeft(before, cell.p)
        // 상자가 만든 바닥, 처음부터 구멍이던 칸과 무너진 뒤 메워진 칸
        const wasCrack = (stage.cracks?.[cell.p.y]?.[cell.p.x] ?? '.') !== '.'
        const isFilled =
          game.heights[cell.p.y][cell.p.x] >= 0 &&
          (stage.heights[cell.p.y][cell.p.x] < 0 || (wasCrack && left < 0))
        const crumble = crackFrame(was, left, crackPhase)
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
        // 솟거나 재시작으로 내려가는 씨앗 칸은 그 순간 높이
        const seedHere = seedFrame.get(cell.key)
        const seedShift = seedHere ? cell.h - seedHere.level : 0
        const cellY =
          cell.y -
          raised * TILE.layer +
          sinkAt(crackView, cell.p) +
          crackFall +
          seedShift * TILE.layer
        const pickedHere = pickedUp?.type === 'pickedUp' && same(pickedUp.at, cell.p)
        const flatLadder = has(ladders, cell.p)
          ? 1
          : pickedHere && has(before.ladders, cell.p)
            ? 1 - pickUpPhase
            : 0
        const placedOpacity = (l: Point) =>
          placed?.type === 'placed' && same(placed.ladder, l) ? ownT : 1
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

        // 상자가 먼저 메운 길 칸은 덩굴이 못 자라 싹 제외
        const vineHere = vineFrame.get(cell.key)
        const vine =
          vineHere && (cell.pit || vineHere.kind === 'grown' || vineHere.kind === 'root')
            ? vineHere
            : null
        // 판이 차오르거나 내려가는 칸의 드러나는 구덩이 벽
        const pitShown = cell.pit || (vine?.kind === 'grown' && vine.rise < 1)

        const tram = tramFrames.find((frame) => same(frame.cell, cell.p)) ?? null
        const drawCube = same(cube.cell, cell.p) && !(game.cleared && !moving)
        const drawBoxes = boxFrames.filter((frame) => same(frame.cell, cell.p))
        const movedBoxHere = boxFrames.some((frame) => same(frame.to, cell.p))
        const goalEffect = same(cell.p, stage.goal) && game.cleared && !moving
        const droppingBox = dropping ? boxes.findIndex((b) => same(b, cell.p)) : -1
        const boxDrop = droppingBox >= 0 ? restartDrop(t, droppingBox + 1, boxes.length) : null
        // 재시작하면 제자리에서 사라지는 메운 칸, 큐브와 같은 빠르기로 돌아오는 무너졌던 칸
        const restored =
          dropping && !seedHere
            ? Math.sign(before.heights[cell.p.y][cell.p.x] - heights[cell.p.y][cell.p.x])
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
            hidden={isFilled && movedBoxHere && before.heights[cell.p.y][cell.p.x] < 0}
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
            faded={has(faded, cell.p)}
            entity={entity?.type === 'switch' || entity?.type === 'door' ? entity.type : null}
            lift={lift !== undefined}
            warp={warp !== undefined}
            switchDepth={lerp(pressed(before) ? 2 : 9, pressed(game) ? 2 : 9, switchPhase)}
            doorDepth={lerp(doorDepth(before), doorDepth(game), doorPhase)}
            box={has(boxes, cell.p) && !movedBoxHere && boxDrop === null}
            rail={cell.rail}
            railNext={nextRails.has(cell.key)}
            pitWallLeft={pitShown ? wallHeight(walls, cell.p.x, cell.p.y - 1) : -1}
            pitWallRight={pitShown ? wallHeight(walls, cell.p.x - 1, cell.p.y) : -1}
            blockOpacity={
              restored > 0
                ? 1 - smooth(clamp01(t / RESTORE_FADE))
                : restored < 0
                  ? (cubeDrop?.opacity ?? 1)
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
                : pickedHere && has(before.seeds, cell.p)
                  ? 1 - pickUpPhase
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
                  box && same(frame.to, box.to) && boxShown !== null ? (
                    <BoardWater
                      key={`${frame.to.x}-${frame.to.y}`}
                      part="box"
                      x={frame.x}
                      y={frame.y}
                      shown={boxShown}
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
                    opacity={(cubeDrop ? cubeDrop.opacity : 1) * cube.fade}
                    transform={`translate(0 ${cubeSink - cube.lift}) ${cubeSquash}`}
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
                    {carried === 'seed' ? (
                      <BoardSeed x={carriedBase.x} y={carriedBase.y} part="seed" tilt={bump} />
                    ) : (
                      <BoardLadder x={carriedBase.x} y={carriedBase.y - 2} tilt={ladderBump} />
                    )}
                  </g>
                )}
                {drawCube && plantedSeed && plantedSeed.opacity > 0 && (
                  <g
                    opacity={plantedSeed.opacity}
                    transform={`translate(${plantedSeed.x} ${plantedSeed.y}) scale(${plantedSeed.scale}) translate(${-plantedSeed.x} ${-plantedSeed.y})`}
                  >
                    <BoardSeed x={plantedSeed.x} y={plantedSeed.y} part="seed" tilt={plantTilt} />
                  </g>
                )}
                {goalEffect && <BoardClear x={cell.x} y={cell.y} />}
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
