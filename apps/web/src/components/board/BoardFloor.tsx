import { type CSSProperties, type ComponentProps, type ReactNode } from 'react'

import BoardAmbient from './BoardAmbient'
import BoardBlock from './BoardBlock'
import BoardGoal from './BoardGoal'
import BoardIceStone from './BoardIceStone'
import BoardMushroom from './BoardMushroom'
import BoardPlate from './BoardPlate'
import BoardSeed from './BoardSeed'
import BoardSluice from './BoardSluice'
import BoardSwamp from './BoardSwamp'
import BoardTether from './BoardTether'
import BoardTide from './BoardTide'
import BoardVine from './BoardVine'
import BoardWater from './BoardWater'
import BoardWhirlpool from './BoardWhirlpool'
import {
  type BehindGoal,
  type CellLook,
  type ShadeLook,
  crackThickness,
  swampCollar,
} from './frame'
import {
  SHARD,
  type ShadePiece,
  blend,
  cellFaces,
  crackQuarters,
  crackShards,
  crackSplit,
  dim,
  spotPoints,
  sunkLift,
  surfaceRise,
  surfaceShown,
  veilMiddle,
} from './view'
import { TILE, blockFaces } from '@/game/iso'
import { useNightFade } from '@/hooks/useNightFade'

// 왼쪽 위 모서리와 나란하게 누운 얼음 윗면의 광택 면
const GLOSS_SPOTS: [number, number][] = [
  [-0.38, -0.04],
  [-0.04, -0.38],
  [0.04, -0.3],
  [-0.3, 0.04],
]

// 칸 크기의 미끄러져 지나간 자국, 작게 그리면 칸 안에 뜬 액자처럼 보이는 탓
const FROST_OPACITY = 0.7

type Faces = { top: string; left: string; right: string }

// 어둠 칸의 바닥 타일과 빛 조각 칠, 어둠 세기 --veil은 이 묶음에만
const Shaded = ({
  on,
  fade,
  pieces,
  faces,
  children,
}: {
  on: boolean
  fade: (element: Element | null) => void
  pieces: ShadePiece[]
  faces: Faces
  children: ReactNode
}) =>
  on ? (
    <g ref={fade}>
      {children}
      {pieces.map((piece, i) => (
        <polygon
          key={i}
          points={piece.points}
          style={{
            fill: `color-mix(in srgb, var(--color-night) calc(var(--veil) * ${piece.value * 100}%), ${faces[piece.face]})`,
          }}
        />
      ))}
    </g>
  ) : (
    <>{children}</>
  )

interface BoardFloorProps extends Omit<
  CellLook,
  | 'parity'
  | 'tier'
  | 'faded'
  | 'hidden'
  | 'box'
  | 'pit'
  | 'ladder'
  | 'fire'
  | 'trail'
  | 'brazier'
  | 'keg'
> {
  behindGoal?: BehindGoal | null
  faces: Faces
  shade?: ShadeLook | null // 타일 색을 직접 어둡게 칠하는 칸
  pieces?: ShadePiece[] // 그 칸의 빛 지도 칠 조각
  baseFaces: Faces
  vineProps: Omit<ComponentProps<typeof BoardVine>, 'layer' | 'kind'>
  grownVine: boolean
  icy: boolean
  iceTop: number
  mudY: number
}

const BoardFloor = ({
  behindGoal,
  x,
  y,
  h,
  goal,
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
  vine,
  seed,
  ambient,
  faces,
  baseFaces,
  vineProps,
  grownVine,
  icy,
  iceTop,
  mudY,
  shade = null,
  pieces = [],
}: BoardFloorProps) => {
  const depth = crack.on ? crackThickness(crack.stage) + h * TILE.layer : h * TILE.layer + TILE.lip
  // 원래 땅 위에 볏짚빛으로 얹히는 씨앗으로 솟은 층, 옆면 색이 바뀌는 자리가 경계
  const seedRise = seed.land * TILE.layer
  const split = crackSplit(crack.on, crack.broken, crack.stage)
  const quarters = crack.on && crack.broken === 0 ? crackQuarters(x, y, split, crack.seed) : []
  const shards = crackShards(x, y, crack.broken, depth)
  const collar = swamp.risen >= 0 ? swampCollar(swamp.risen) * swamp.deep : 0
  const shadeFade = useNightFade(shade?.beat ?? null)
  const goalVeil = shade ? veilMiddle(shade.veil.split(',').map(Number)) : 0
  // 빛 조각 밑 타일은 다 어두운 색, 조각 가장자리로 밝은 타일이 비치는 선 막기
  const shadeOf = (color: string) =>
    shade ? `color-mix(in srgb, var(--color-night) calc(var(--veil) * 100%), ${color})` : color

  return (
    <>
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
          <Shaded fade={shadeFade} on={shade !== null} pieces={pieces} faces={faces}>
            <BoardBlock
              x={x}
              y={y}
              width={TILE.width}
              depth={depth}
              top={crack.on && crack.broken === 0 ? dim(faces.top, 9) : shadeOf(faces.top)}
              left={shadeOf(faces.left)}
              right={shadeOf(faces.right)}
            />
          </Shaded>
        )}
        <BoardTide x={x} y={y} faces={faces} tide={tide} />
        {sluice.channel && (
          <BoardSluice part="channel" x={x} y={y} axis={sluice.channel} flow={sluice.flow} />
        )}
        {surfaceRise(water.depth) > 0 && (
          <g opacity={surfaceShown(water.depth)}>
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
          </g>
        )}
        {goal && sluice.sunk > 0 && (
          <BoardGoal
            x={x}
            y={y - sunkLift(water.depth)}
            top={baseFaces.top}
            sunk={sluice.sunk}
            depth={water.depth}
            film={surfaceShown(water.depth)}
          />
        )}
        {behindGoal && surfaceRise(water.depth) > 0 && (
          <>
            <clipPath id={`behind-goal-${x}-${y}`}>
              <polygon points={blockFaces(x, y - surfaceRise(water.depth), TILE.width, 0).top} />
            </clipPath>
            <g clipPath={`url(#behind-goal-${x}-${y})`}>
              <BoardGoal
                x={behindGoal.x}
                y={behindGoal.y - sunkLift(behindGoal.depth)}
                top={cellFaces('hole', false, 0, false, 0, behindGoal.parity, 1).top}
                sunk={behindGoal.sunk}
                depth={behindGoal.depth}
                film={surfaceShown(behindGoal.depth)}
              />
            </g>
          </>
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
        {surfaceRise(water.depth) > 0 && water.idle >= 0 && (
          <g opacity={surfaceShown(water.depth)}>
            <BoardWater
              part="ripple"
              x={x}
              y={y}
              depth={water.depth}
              idle={water.idle}
              idleCycle={water.idleCycle}
            />
          </g>
        )}
        {iceStone.cover > 0 && (
          <>
            <BoardIceStone
              part="plate"
              x={x}
              y={iceTop}
              cover={iceStone.cover}
              from={iceStone.from}
            />
            <polygon
              points={spotPoints(x, iceTop, GLOSS_SPOTS)}
              style={{ fill: 'var(--color-ice-gloss)' }}
              opacity={iceStone.gloss}
            />
          </>
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
        {ambient.kind === 'bubble' && <BoardAmbient x={x} y={y} {...ambient} kind="bubble" />}
        {mushroom.on && (
          <BoardMushroom x={x} y={y} press={mushroom.press} wither={mushroom.wither} />
        )}
        {(device.lift || device.warp) && <BoardPlate x={x} y={y} warp={device.warp} />}
        {ambient.kind === 'warp' && <BoardAmbient x={x} y={y} {...ambient} kind="warp" />}
        {tether.post > 0 && <BoardTether part="post" x={x} y={y} bands={tether.post} />}
        {icy && (
          <polygon
            points={spotPoints(x, y, GLOSS_SPOTS)}
            style={{ fill: 'var(--color-ice-gloss)' }}
          />
        )}
        {ice.frost > 0 && (
          <polygon
            points={blockFaces(x, iceStone.cover > 0 ? iceTop : y, TILE.width, 0).top}
            style={{ fill: 'var(--color-ice-gloss)', opacity: ice.frost * FROST_OPACITY }}
          />
        )}
        {quarters.map((quarter) => (
          <BoardBlock
            key={quarter.key}
            x={quarter.x}
            y={quarter.y}
            width={quarter.width}
            depth={quarter.depth}
            top={faces.top}
            left={faces.left}
            right={faces.right}
          />
        ))}
        {goal && sluice.sunk === 0 && (
          // 어둠 칸의 골 구멍은 칸 어둠 값만큼 어둡게 칠함
          <g className={shade ? 'deco-day' : undefined}>
            <g
              ref={shade ? shadeFade : undefined}
              className={shade ? 'deco-night' : undefined}
              style={shade ? ({ '--deco-veil': goalVeil } as CSSProperties) : undefined}
            >
              <BoardGoal
                x={x}
                y={y - sunkLift(water.depth)}
                top={baseFaces.top}
                sunk={sluice.sunk}
                depth={water.depth}
                film={surfaceShown(water.depth)}
              />
            </g>
          </g>
        )}
      </g>
    </>
  )
}

export default BoardFloor
