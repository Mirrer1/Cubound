import { type CSSProperties, type ReactNode, memo } from 'react'

import BoardBlock from './BoardBlock'
import BoardBox from './BoardBox'
import BoardLadder from './BoardLadder'
import BoardMushroom from './BoardMushroom'
import BoardPit from './BoardPit'
import BoardPlate from './BoardPlate'
import BoardSeed from './BoardSeed'
import BoardSwamp from './BoardSwamp'
import BoardSwitch from './BoardSwitch'
import BoardTether from './BoardTether'
import BoardVine from './BoardVine'
import BoardWater from './BoardWater'
import BoardWhirlpool from './BoardWhirlpool'
import { type CellLook, crackThickness, sameCellLook, swampCollar, swampSink } from './frame'
import {
  CUBE,
  LEAN_LOOP,
  MUD,
  MUD_DIP,
  PIT_FLOOR,
  QUARTER,
  SHARD,
  WATER,
  blend,
  cellFaces,
  crackQuarters,
  crackShards,
  crackSplit,
  darken,
  dim,
  isPit,
  leanShift,
  leaningOf,
  spotPoints,
} from './view'
import { TILE, blockFaces } from '@/game/iso'
import { useLoop } from '@/hooks/useLoop'

// 왼쪽 위 모서리와 나란하게 누운 얼음 윗면의 광택 면
const GLOSS_SPOTS: [number, number][] = [
  [-0.38, -0.04],
  [-0.04, -0.38],
  [0.04, -0.3],
  [-0.3, 0.04],
]

// 칸 크기의 미끄러져 지나간 자국, 작게 그리면 칸 안에 뜬 액자처럼 보이는 탓
const FROST_OPACITY = 0.7

// 같은 크기 판 두 장을 어긋나게 겹쳐 낸 구멍 두께
const HOLE = { scale: 0.62, wall: 7 }

// 잠긴 것의 진흙 면 아래를 가리는 자르기, 밑면 앞 모서리를 따라 아이소메트릭 면과 나란한 선
const mudClipPoints = (x: number, y: number) => {
  const hw = (TILE.width * CUBE) / 2
  return `${x - 4000},${y} ${x - hw},${y} ${x},${y + MUD_DIP} ${x + hw},${y} ${x + 4000},${y} ${x + 4000},${y - 4000} ${x - 4000},${y - 4000}`
}

interface BoardCellProps extends CellLook {
  children?: ReactNode
}

const BoardCell = ({
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
  swamp,
  mushroom,
  water,
  tether,
  whirl,
  device,
  pit: pitLook,
  ladder,
  vine,
  seed,
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
  const faces = cellFaces(surface, grownVine, vine.hard, crack.on, crack.stage, parity)
  const depth = crack.on ? crackThickness(crack.stage) + h * TILE.layer : h * TILE.layer + TILE.lip
  // 원래 땅 위에 볏짚빛으로 얹히는 씨앗으로 솟은 층, 옆면 색이 바뀌는 자리가 경계
  const seedRise = seed.land * TILE.layer
  const split = crackSplit(crack.on, crack.broken, crack.stage)
  const quarters = crackQuarters(x, y, split, crack.stage, crack.seed)
  const shards = crackShards(x, y, crack.broken, depth)
  const ladders = leaningOf(ladder.leaning)
  // 큐브를 가리는 칸 위 상자도 칸과 같이 흐리는 투명도
  const fade = { opacity: faded ? 0.5 : 1, transition: 'opacity 320ms var(--ease-soft)' }
  const mudY = y + MUD.drop
  const sunk = swamp.deep > 0
  // 단계마다 정해진 깊이까지 칸째로 내려가는 큐브, 가라앉는 상자는 Board 몫
  const sink = swamp.risen >= 0 ? (MUD.drop + swampSink(swamp.risen)) * swamp.deep : 0
  const collar = swamp.risen >= 0 ? swampCollar(swamp.risen) * swamp.deep : 0
  const lean = whirl.lean ? leanShift(whirl.lean, 1) : undefined
  const leanLoop = useLoop(LEAN_LOOP, 1600)

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
        <g style={fade}>
          {crack.shadow > 0 && (
            <polygon
              points={blockFaces(x, y - crack.fall, TILE.width, 0).top}
              style={{ fill: 'var(--color-crack-shadow)', opacity: crack.shadow }}
            />
          )}
          <g opacity={ground.blockOpacity}>
            {shards.length > 0 ? (
              shards.map((shard) => (
                <BoardBlock
                  key={shard.key}
                  x={shard.x}
                  y={shard.y}
                  width={TILE.width * SHARD.scale}
                  depth={shard.depth}
                  top={faces.top}
                  left={faces.left}
                  right={faces.right}
                />
              ))
            ) : seed.land > 0 ? (
              <>
                <BoardBlock
                  x={x}
                  y={y + seedRise}
                  width={TILE.width}
                  depth={depth - seedRise}
                  top={faces.top}
                  left={faces.left}
                  right={faces.right}
                />
                <BoardBlock
                  x={x}
                  y={y}
                  width={TILE.width}
                  depth={seedRise}
                  top={
                    seed.land >= 1
                      ? 'var(--color-seed-land-top)'
                      : blend(faces.top, 'var(--color-seed-land-top)', seed.land)
                  }
                  left="var(--color-seed-land-left)"
                  right="var(--color-seed-land-right)"
                />
              </>
            ) : ground.filled && h > 0 ? (
              // 높은 데서 메운 칸은 끊긴 땅 사이에 걸친 판자처럼 0층 메움과 같은 두께의 판
              <BoardBlock
                x={x}
                y={y}
                width={TILE.width}
                depth={TILE.lip}
                top={faces.top}
                left={faces.left}
                right={faces.right}
              />
            ) : (
              <BoardBlock
                x={x}
                y={y}
                width={TILE.width}
                depth={depth}
                top={split > 0 ? dim(faces.top, 9) : faces.top}
                left={faces.left}
                right={faces.right}
              />
            )}
            {water.depth > 0 && (
              <BoardWater
                part="surface"
                x={x}
                y={y}
                depth={water.depth}
                bankX={water.bankX}
                bankY={water.bankY}
                sideLeft={water.sideLeft}
                sideRight={water.sideRight}
                ring={water.ring}
                ringOpacity={water.ringOpacity}
                range={tether.range}
              />
            )}
            {whirl.lane && whirl.laneOpacity > 0 && (
              <BoardWhirlpool
                part="lane"
                x={x}
                y={y}
                depth={water.depth}
                axis={whirl.lane}
                opacity={whirl.laneOpacity}
              />
            )}
            {whirl.ghost > 0 && (
              <BoardWhirlpool part="ghost" x={x} y={y} depth={water.depth} opacity={whirl.ghost} />
            )}
            {whirl.eye > 0 && (
              <BoardWhirlpool part="eye" x={x} y={y} depth={water.depth} opacity={whirl.eye} />
            )}
            {seed.stalk > 0 && (
              <BoardSeed x={x} y={y} part="stalk" level={seed.stalk} p={seed.bud} />
            )}
            {seed.leaves > 0 && <BoardSeed x={x} y={y} part="leaves" p={seed.leaves} />}
            {(grownVine || vine.kind === 'root') && (
              <BoardVine layer="top" kind={vine.kind!} {...vineProps} />
            )}
            <BoardSwamp
              x={x}
              y={y}
              mudY={mudY}
              swamp={swamp.on}
              swampFilled={swamp.filled}
              swampDeep={swamp.deep}
              collar={collar}
            />
            {mushroom.on && (
              <BoardMushroom x={x} y={y} press={mushroom.press} wither={mushroom.wither} />
            )}
            {(device.lift || device.warp) && <BoardPlate x={x} y={y} warp={device.warp} />}
            {tether.post > 0 && <BoardTether part="post" x={x} y={y} bands={tether.post} />}
            {icy && (
              <polygon
                points={spotPoints(x, y, GLOSS_SPOTS)}
                style={{ fill: 'var(--color-ice-gloss)' }}
              />
            )}
            {ice.frost > 0 && (
              <polygon
                points={blockFaces(x, y, TILE.width, 0).top}
                style={{ fill: 'var(--color-ice-gloss)', opacity: ice.frost * FROST_OPACITY }}
              />
            )}
            {quarters.map((quarter) => (
              <BoardBlock
                key={quarter.key}
                x={quarter.x}
                y={quarter.y}
                width={TILE.width * QUARTER.scale}
                depth={QUARTER.depth}
                top={faces.top}
                left={faces.left}
                right={faces.right}
              />
            ))}
            {goal && (
              <>
                <polygon
                  points={blockFaces(x, y + HOLE.wall, TILE.width * HOLE.scale, 0).top}
                  style={{ fill: darken('goal', 16) }}
                />
                <polygon
                  points={blockFaces(x, y + 1, TILE.width * HOLE.scale, 0).top}
                  style={{ fill: darken('goal', 36) }}
                />
              </>
            )}
          </g>
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
      {box && (
        <g style={fade}>
          {water.depth > 0 ? (
            <g
              ref={lean ? leanLoop : undefined}
              className={lean ? 'whirl-lean' : undefined}
              style={lean as CSSProperties}
            >
              <BoardWater part="box" x={x} y={y - water.depth * TILE.layer} shown={WATER.lip} />
            </g>
          ) : (
            <BoardBox x={x} y={y - TILE.layer} />
          )}
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
        <g style={fade} opacity={seed.on}>
          <BoardSeed x={x} y={y} part="seed" />
        </g>
      )}
      {(seed.tree > 0 || seed.treeNext > 0) && (
        <g style={fade}>
          <BoardSeed x={x} y={y} part="tree" from={seed.tree} to={seed.treeNext} p={seed.treeP} />
        </g>
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
        <g style={fade}>
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
