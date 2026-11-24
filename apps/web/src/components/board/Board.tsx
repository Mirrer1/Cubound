import { useEffect, useMemo, useState } from 'react'

import BoardSlot, { type SlotScene } from './BoardSlot'
import BoardTether from './BoardTether'
import {
  type Tram,
  barKeys,
  boardCells,
  bridgeLooks,
  cellLook,
  coversRope,
  cubeFirst,
  filledCells,
  fillingCellKey,
  guideNearCube,
  guideNightOf,
  nightVeils,
  quietAmbient,
  railDirsOf,
  railsUnder,
  restartDuration,
  sceneFrame,
  slotFrame,
  slotOf,
  swampTime,
  underWall,
  vineLooks,
  waterAtOf,
} from './frame'
import {
  type AmbientKind,
  LEAN_LOOP,
  type ViewBox,
  ambientCells,
  ambientPlan,
  pullLanes,
} from './view'
import { TILE, blockFaces } from '@/game/iso'
import { isDark } from '@/game/rules'
import type { GameEvent, GameState, Point } from '@/game/types'
import { useAmbient } from '@/hooks/useAmbient'
import { useBoardAnimation } from '@/hooks/useBoardAnimation'
import { useBoardCamera } from '@/hooks/useBoardCamera'
import { useLoop } from '@/hooks/useLoop'
import { useNightFade } from '@/hooks/useNightFade'
import { cycleOf, parseStageId } from '@/stages'

interface BoardProps {
  game: GameState
  prevGame: GameState | null
  events: GameEvent[]
  prevEvents: GameEvent[]
  turn: number
  onAnimationEnd: () => void
  queued: number // 기다리는 입력 수
  chained: boolean // 앞 이동에서 바로 이어지는 이동
  restarting: boolean // 처음 자리로 내려앉는 연출 중
  guideCell?: Point // 가이드가 비추는 칸
  guideId?: string // 지금 가이드 단계
  overview: boolean // 판 전체를 한 화면에 담는 보기
  onShowsAll: (showsAll: boolean) => void // 평소 화면에 판 전체가 들어오는지 알림
}

const Board = ({
  game,
  prevGame,
  events,
  prevEvents,
  turn,
  onAnimationEnd,
  queued,
  chained,
  restarting,
  guideCell,
  guideId,
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
    prevEvents,
    t,
    chain,
    restarting,
    swampSeconds,
    trams,
    filled,
    lanes,
    guideCell,
    guideId,
  })
  const lookCell = guideCell && !guideNearCube(game, guideCell, scene.cube) ? guideCell : undefined
  // 카메라가 따라가는 지금 그려지는 자리, 순간이동은 나온 뒤
  const { ref, viewBox, showsAll } = useBoardCamera(
    game,
    lookCell ?? scene.cubeCell,
    overview,
    lookCell ? undefined : scene.cube,
  )
  const leanLoop = useLoop(LEAN_LOOP, 1600)

  const railDirs = useMemo(() => railDirsOf(trams), [trams])

  // 덩굴 뿌리와 길 칸, 구덩이로 그릴 칸을 가리는 용도, 그 순간의 모습은 vineFrame 몫
  const vines = useMemo(() => vineLooks(game), [game])

  // cells 메모의 의존성이라 함께 메모, 안 하면 React Compiler 검사가 cells 메모를 못 지키는 탓
  const fillingKey = useMemo(
    () => fillingCellKey(scene.box, events, vines),
    [scene.box, events, vines],
  )

  const bridges = useMemo(() => bridgeLooks(stage), [stage])
  const guideNight = useMemo(() => guideNightOf(game, guideId), [game, guideId])
  // 가이드가 어둠 장면을 열거나 닫을 때 바뀌기 전 장면, 수를 두면 비움. 없으면 어둠이 바뀌는 과정 없이 툭 바뀜
  const [guideShift, setGuideShift] = useState({
    game,
    shown: guideNight,
    from: null as GameState | null,
  })
  let guideFrom = guideShift.from
  if (guideShift.game !== game || guideShift.shown !== guideNight) {
    guideFrom = guideShift.game === game ? (guideShift.shown ?? game) : null
    setGuideShift({ game, shown: guideNight, from: guideFrom })
  }
  // 판 칸 어둠 세기의 수 처음과 끝, 바탕 전환과 같은 시간
  const beat = useMemo(
    () =>
      nightVeils(
        guideFrom ?? guideNight ?? prevGame,
        guideNight ?? game,
        guideNight || guideFrom ? [] : events,
      )?.field ?? null,
    [guideFrom, guideNight, prevGame, game, events],
  )
  // 다리 막대가 걸친 구덩이 칸과 그림자 다리 칸, 그 위의 물건과 큐브를 그리는 자리
  const bareKeys = [barKeys(scene.bar), ...bridges.keys()].join(' ')
  const cells = useMemo(
    () => boardCells(heights, scene.before.heights, railDirs, vines, fillingKey, bareKeys),
    [heights, scene.before.heights, railDirs, vines, fillingKey, bareKeys],
  )

  const plan = useMemo(() => ambientPlan(stage, cycleOf(parseStageId(stage.id).world)), [stage])
  const pickAmbient = (kind: AmbientKind, round: number, slot: number, last: Point[]) =>
    quietAmbient(guideNight ?? game, kind)
      ? []
      : ambientCells(game, kind, round, slot, last, viewBox.split(' ').map(Number) as ViewBox)
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
  const frame = slotFrame({
    game,
    prevGame,
    events,
    guideNight,
    guideFrom,
    beat,
    bridges,
    lookOf,
    t,
    scene,
    cells,
  })
  const view: SlotScene = { ...frame, leanLoop }
  const drawOrder = railsUnder(
    cubeFirst(
      underWall(scene.tramFrames, heights).reduce(
        (ordered, p) => cubeFirst(ordered, p),
        [
          scene.box?.cell,
          scene.kegFrame?.cell,
          ...scene.iceStone.stones.map((stone) => stone.cell),
        ].reduce((ordered, p) => (p ? cubeFirst(ordered, p) : ordered), cells),
      ),
      scene.cube.cell,
      scene.cube.last,
    ),
    scene.tramFrames,
  )
  // 어둠에서 무너지는 칸은 맨 먼저 그려 옆 칸 옆면 뒤로 떨어짐, 까만 조각이 옆면을 가려 벽이 혼자 자라 보이는 탓
  // 밝을 때는 조각이 벽 앞에서 떨어지는 게 보여 그대로, 큐브가 아직 그 칸에서 그려지는 동안도 그대로(큐브가 바닥에 가려짐)
  const cubeKey = `${scene.cube.cell.x}-${scene.cube.cell.y}`
  const falling = isDark(game)
    ? new Set(
        events.flatMap((e) =>
          e.type === 'cracked' && e.gone && `${e.at.x}-${e.at.y}` !== cubeKey
            ? [`${e.at.x}-${e.at.y}`]
            : [],
        ),
      )
    : null
  const ordered =
    falling && falling.size > 0
      ? [
          ...drawOrder.filter((cell) => falling.has(cell.key)),
          ...drawOrder.filter((cell) => !falling.has(cell.key)),
        ]
      : drawOrder
  const slots = ordered.map((cell) => slotOf(frame, cell))
  // 예고와 어둠 동안 그림자 다리를 땅과 상자 위에 그림
  const bridgesOnTop = frame.night !== null && (frame.night.bridge > 0 || frame.guideShift)
  // 다리 위로 다시 그릴 칸: 다리 칸(다리 위 상자, 큐브)과 큐브가 다리 곁 같은 깊이 이상에 있는 칸
  // 큐브 뒤나 옆의 다리는 큐브 모양만큼 비워 큐브를 덮지 않음, 큐브를 다리 위로 올리면 앞의 상자보다도 앞에 나와 보임
  const cubeCut = scene.cubeFaces.map((face) => `M${face.points}Z`).join(' ')
  const behindCube = (p: { x: number; y: number }) =>
    p.x + p.y <= scene.cube.cell.x + scene.cube.cell.y
  // 다리 밑면이 덮지 않을 옆 땅 칸 윗면들
  const slotAt = new Map(slots.map((slot) => [slot.cell.key, slot]))
  const underOf = (slot: (typeof slots)[number]) =>
    slot.bridge
      ? [-1, 0, 1]
          .flatMap((dy) =>
            [-1, 0, 1].map((dx) => slotAt.get(`${slot.cell.p.x + dx}-${slot.cell.p.y + dy}`)),
          )
          .flatMap((n) =>
            n && n !== slot && !n.cell.bare
              ? [`M${blockFaces(n.look.x, n.look.y, TILE.width, 0).top}Z`]
              : [],
          )
          .join(' ')
      : ''
  // 구덩이로 떨어지는 상자는 늘 맨 위에, 뒤 칸에 잘려 찌그러져 보이지 않고 모양 그대로 떨어짐
  const layered = bridgesOnTop || slots.some((slot) => slot.sinkingBox)
  const lifted = slots.map(
    (slot) => slot.sinkingBox || (bridgesOnTop && slot.cell.bare && slot.bridge !== undefined),
  )

  useEffect(() => onShowsAll(showsAll), [showsAll, onShowsAll])
  // 판 전체의 어둠 세기, 칸을 넘어 다니며 새로 그려지는 막대와 화약통 조각은 이 값을 물려받음
  // 조각마다 전환을 따로 틀면 새로 그려진 조각이 한 프레임 늦어 잠깐 밝게 보임
  const boardFade = useNightFade(beat)

  return (
    <svg ref={ref} viewBox={viewBox} className="h-full w-full">
      <g ref={boardFade}>
        {ordered.map((cell, i) => (
          <BoardSlot
            key={cell.key}
            slot={slots[i]}
            frame={view}
            layer={layered ? 'base' : 'all'}
            lifted={lifted[i]}
            bridgesAbove={bridgesOnTop}
          />
        ))}
        {bridgesOnTop &&
          ordered.map((cell, i) => (
            <BoardSlot
              key={`bridge-${cell.key}`}
              slot={slots[i]}
              frame={view}
              layer="bridge"
              under={bridgesOnTop ? underOf(slots[i]) : ''}
              cut={bridgesOnTop && behindCube(cell.p) ? cubeCut : ''}
            />
          ))}
        {layered &&
          ordered.map((cell, i) =>
            lifted[i] ? (
              <BoardSlot key={`top-${cell.key}`} slot={slots[i]} frame={view} layer="top" />
            ) : null,
          )}
      </g>
      <defs>
        <mask id="rope-behind-scene.cube" maskUnits="userSpaceOnUse" {...scene.ropeMask}>
          <rect {...scene.ropeMask} fill="white" />
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
      {[scene.guide, scene.pairGuide].map(
        (rect, i) => rect && <rect key={i} data-guide="cell" {...rect} fill="none" />,
      )}
    </svg>
  )
}

export default Board
