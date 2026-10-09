import { type CSSProperties, type ReactNode, memo } from 'react'

import BoardAmbient from './BoardAmbient'
import BoardBox from './BoardBox'
import BoardFire from './BoardFire'
import BoardFloor, { type BehindGoal } from './BoardFloor'
import BoardIceStone from './BoardIceStone'
import BoardLadder from './BoardLadder'
import BoardPit from './BoardPit'
import BoardSeed from './BoardSeed'
import BoardSluice from './BoardSluice'
import BoardSwitch from './BoardSwitch'
import BoardWater from './BoardWater'
import { type CellLook, sameCellLook, swampSink } from './frame'
import {
  CUBE,
  ICE,
  LEAN_LOOP,
  MUD,
  MUD_DIP,
  PIT_FLOOR,
  STONE,
  blend,
  boatLook,
  cellFaces,
  frostWidth,
  isPit,
  leanShift,
  leaningOf,
  stoneFloat,
  waterTone,
} from './view'
import { TILE, blockFaces } from '@/game/iso'
import { useFade } from '@/hooks/useFade'
import { useLoop } from '@/hooks/useLoop'

// 같은 크기 판 두 장을 어긋나게 겹쳐 낸 구멍 두께
// 잠긴 것의 진흙 면 아래를 가리는 자르기, 밑면 앞 모서리를 따라 아이소메트릭 면과 나란한 선
const mudClipPoints = (x: number, y: number) => {
  const hw = (TILE.width * CUBE) / 2
  return `${x - 4000},${y} ${x - hw},${y} ${x},${y + MUD_DIP} ${x + hw},${y} ${x + 4000},${y} ${x + 4000},${y - 4000} ${x - 4000},${y - 4000}`
}

interface BoardCellProps extends CellLook {
  behindGoal?: BehindGoal | null
  children?: ReactNode
}

const BoardCell = ({
  behindGoal,
  x,
  y,
  h,
  parity,
  goal,
  faded,
  hidden,
  box,
  ground,
  ice,
  crack,
  iceStone,
  swamp,
  mushroom,
  water,
  tether,
  whirl,
  device,
  sluice,
  tide,
  pit: pitLook,
  ladder,
  fire,
  vine,
  seed,
  ambient,
  children,
}: BoardCellProps) => {
  const icy = ice.on && !goal && !ground.filled
  const grownVine = vine.kind === 'grown'
  const pit = isPit(pitLook.rail, vine.kind, grownVine, vine.rise)
  // 바닥 대신 제 색으로 칠하는 칸, 상자가 메운 칸, 얼음, 발판, 짝 칸, 구멍
  const surface = goal
    ? 'hole'
    : ground.filled
      ? 'tool'
      : icy
        ? 'ice'
        : device.lift || device.warp
          ? 'machine'
          : null
  const vineProps = {
    x,
    y,
    floor: PIT_FLOOR,
    enter: vine.enter,
    leave: vine.leave,
    growth: vine.growth,
    tongue: vine.tongue,
    sprout: vine.sprout,
    sproutOpacity: vine.sproutOpacity,
    hard: vine.hard,
    knot: vine.knot,
    opacity: vine.opacity,
  }
  const baseFaces = cellFaces(surface, grownVine, vine.hard, crack.on, crack.stage, parity)
  // 물에 잠긴 집 칸의 땅 높이 윗면, 수면 이음매로 짙은 골 색이 비치지 않는 물빛
  const faces =
    goal && sluice.sunk > 0
      ? { ...baseFaces, top: blend(baseFaces.top, waterTone(water.depth), sluice.sunk) }
      : baseFaces
  const ladders = leaningOf(ladder.leaning)
  // 큐브를 가리는 칸 위 상자도 칸과 같이 흐리는 투명도
  const fade = { opacity: faded ? 0.5 : 1 }
  const fadeRef = useFade(fade.opacity)
  const mudY = y + MUD.drop
  const sunk = swamp.deep > 0
  // 단계마다 정해진 깊이까지 칸째로 내려가는 큐브, 가라앉는 상자는 Board 몫
  const sink = swamp.risen >= 0 ? (MUD.drop + swampSink(swamp.risen)) * swamp.deep : 0
  const lean = whirl.lean ? leanShift(whirl.lean, 1) : undefined
  const leanLoop = useLoop(LEAN_LOOP, 1600)
  // 물가 땅보다 조금 낮은 언 판 윗면
  const iceTop = y - water.depth * TILE.layer + ICE.below
  const boat = boatLook(water.depth)

  return (
    <g>
      {pit && (
        <BoardPit
          x={x}
          y={y}
          rail={pitLook.rail}
          railNext={pitLook.railNext}
          pitWallLeft={pitLook.wallLeft}
          pitWallRight={pitLook.wallRight}
          vine={vine.kind}
          grownVine={grownVine}
          vineRise={vine.rise}
          vineProps={vineProps}
          faces={faces}
        />
      )}
      {!pit && !hidden && (
        <g ref={fadeRef} style={fade}>
          <BoardFloor
            behindGoal={behindGoal}
            x={x}
            y={y}
            h={h}
            goal={goal}
            ground={ground}
            ice={ice}
            crack={crack}
            iceStone={iceStone}
            swamp={swamp}
            mushroom={mushroom}
            water={water}
            tether={tether}
            whirl={whirl}
            device={device}
            sluice={sluice}
            tide={tide}
            vine={vine}
            seed={seed}
            ambient={ambient}
            faces={faces}
            baseFaces={baseFaces}
            vineProps={vineProps}
            grownVine={grownVine}
            icy={icy}
            iceTop={iceTop}
            mudY={mudY}
          />
          {fire.kind && (
            <BoardFire part="floor" x={x} y={y} parity={parity} {...fire} kind={fire.kind} />
          )}
        </g>
      )}
      {device.entity && (
        <BoardSwitch
          x={x}
          y={y}
          entity={device.entity}
          switchDepth={device.switchDepth}
          doorDepth={device.doorDepth}
        />
      )}
      {sluice.device && (
        <BoardSluice part="plate" x={x} y={y} depth={sluice.plate} open={sluice.open} />
      )}
      {sluice.device && (
        <BoardSluice part="tap" x={x} y={y} open={sluice.open} turn={sluice.turn} />
      )}
      {fire.kind === 'wall' && (
        <g ref={fadeRef} style={fade}>
          <BoardFire part="pile" x={x} y={y} parity={parity} {...fire} kind={fire.kind} />
        </g>
      )}
      {box && (
        <g>
          {iceStone.iced ? (
            <BoardBox x={x} y={iceTop - TILE.layer} />
          ) : iceStone.boat > 0 ? (
            <BoardIceStone part="boat" x={x} y={iceTop} lock={iceStone.boat} />
          ) : water.depth > 0 ? (
            <g
              ref={lean ? leanLoop : undefined}
              className={lean ? 'whirl-lean' : undefined}
              style={lean as CSSProperties}
            >
              <BoardWater part="box" x={x} y={y - boat.top} shown={boat.shown} />
            </g>
          ) : (
            <BoardBox x={x} y={y - TILE.layer} />
          )}
        </g>
      )}
      {iceStone.patch > 0 && (
        <polygon
          points={blockFaces(x, y, TILE.width * frostWidth(iceStone.patch), 0).top}
          style={{ fill: blend('var(--color-floor-top)', 'var(--color-ice)', 0.55) }}
          opacity={iceStone.patch}
        />
      )}
      {iceStone.stone && (
        <g>
          <BoardIceStone
            part="stone"
            x={x}
            y={Math.min(y, iceTop)}
            scale={1}
            cut={STONE.floatCut * stoneFloat(water.depth)}
            slab={iceStone.slab}
            frost={iceStone.frost ? 1 - iceStone.slab : 0}
            opacity={1}
            wake={[]}
            ring={null}
          />
        </g>
      )}
      {ladder.flat > 0 && (
        <g opacity={ladder.flat}>
          <BoardLadder x={x} y={y} />
        </g>
      )}
      {ladders.map(({ direction, opacity }) => (
        <g key={direction} opacity={opacity}>
          <BoardLadder x={x} y={y} direction={direction} />
        </g>
      ))}
      {seed.on > 0 && (
        <g opacity={seed.on}>
          <BoardSeed x={x} y={y} part="seed" />
        </g>
      )}
      {(seed.tree > 0 || seed.treeNext > 0) && (
        <g ref={fadeRef} style={fade}>
          <BoardSeed x={x} y={y} part="tree" from={seed.tree} to={seed.treeNext} p={seed.treeP} />
        </g>
      )}
      {(ambient.kind === 'mote' ||
        ambient.kind === 'spore' ||
        ambient.kind === 'butterfly' ||
        ambient.kind === 'mist' ||
        ambient.kind === 'ash' ||
        ambient.kind === 'emberSmoke') && (
        <BoardAmbient
          x={x}
          y={ambient.kind === 'mist' ? Math.min(y, iceTop) : y}
          {...ambient}
          kind={ambient.kind}
        />
      )}
      {sunk ? (
        <>
          <clipPath id={`swamp-clip-${x}-${y}`}>
            <polygon points={mudClipPoints(x, mudY)} />
          </clipPath>
          <g clipPath={`url(#swamp-clip-${x}-${y})`}>
            <g transform={`translate(0 ${sink})`}>{children}</g>
          </g>
        </>
      ) : (
        children
      )}
      {(seed.stakes > 0 || seed.stakesNext > 0) && (
        <g ref={fadeRef} style={fade}>
          <BoardSeed
            x={x}
            y={y}
            part="stakes"
            from={seed.stakes}
            to={seed.stakesNext}
            p={seed.stakeP}
          />
        </g>
      )}
    </g>
  )
}

// 연출 중에도 바뀌지 않은 칸은 다시 그리기 제외
export default memo(BoardCell, sameCellLook)
