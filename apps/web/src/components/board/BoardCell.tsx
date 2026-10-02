import { type ReactNode, memo } from 'react'

import BoardBlock from './BoardBlock'
import BoardBox from './BoardBox'
import BoardLadder from './BoardLadder'
import BoardMushroom from './BoardMushroom'
import BoardPit from './BoardPit'
import BoardPlate from './BoardPlate'
import BoardSeed from './BoardSeed'
import BoardSwamp from './BoardSwamp'
import BoardSwitch from './BoardSwitch'
import BoardVine from './BoardVine'
import BoardWater from './BoardWater'
import { type VineKind, crackThickness, swampCollar, swampSink } from './frame'
import {
  CUBE,
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
  leaningOf,
  spotPoints,
} from './view'
import { TILE, blockFaces } from '@/game/iso'
import type { Direction } from '@/game/types'

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

interface BoardCellProps {
  x: number
  y: number
  h: number
  parity: boolean
  goal: boolean
  filled: boolean
  ice: boolean
  frost: number // 미끄러져 지나간 자국 진하기
  crack: boolean
  crackStage: number // 닳은 단계 0~2
  crackBroken: number // 네 조각으로 갈라져 벌어진 정도
  crackFall: number // 무너지며 아래로 내려간 화면 거리
  crackShadow: number // 무너진 자리에 깔리는 그림자 진하기
  crackSeed: number // 자국 자리를 칸마다 어긋나게 하는 값
  hidden: boolean // 상자가 메우는 중인 칸
  swamp: boolean
  swampFilled: number // 상자가 가라앉아 메워진 정도 0~1
  swampRisen: number // 잠긴 큐브가 올라온 정도 0~1, -1이면 가라앉는 상자
  swampDeep: number // 잠긴 정도 0~1, 0이면 잠긴 것 없는 칸
  mushroom: boolean
  mushroomPress: number // 갓이 눌린 정도, -1은 펴짐, 0은 평소, 2는 큐브가 올라선 상태
  mushroomWither: number // 시든 정도 0~1
  water: number // 물 깊이 층 수, 0이면 물 없는 칸
  waterBankX: boolean // 왼쪽 위 가장자리 반사 띠
  waterBankY: boolean // 오른쪽 위 가장자리 반사 띠
  waterSideLeft: boolean
  waterSideRight: boolean
  waterRing: number // 퍼지는 고리 크기, 0이면 고리 없음
  waterRingOpacity: number
  faded: boolean
  entity: 'switch' | 'door' | null
  lift: boolean
  warp: boolean
  switchDepth: number
  doorDepth: number
  box: boolean
  rail: string // 이웃한 발판 길 칸 방향을 "x,y"로 이은 값, 빈 값이면 길이 아닌 칸
  railNext: boolean // 발판이 다음 수에 들어올 칸
  pitWallLeft: number // 0 이상이면 위 칸 쪽에 세우는 구덩이 벽, -1이면 벽 없는 칸
  pitWallRight: number // 0 이상이면 왼 칸 쪽에 세우는 구덩이 벽, -1이면 벽 없는 칸
  blockOpacity: number // 칸 블록 투명도
  flatLadder: number // 바닥에 놓인 사다리 투명도, 0이면 사다리 없는 칸
  leaning: string // "방향:투명도"를 |로 이은 값
  vine: VineKind | null // 덩굴 뿌리나 길 칸
  vineEnter: Direction | null
  vineLeave: Direction | null
  vineGrowth: number // 줄기가 칸을 건너는 진행도
  vineRise: number // 판이 구덩이에서 차오른 정도
  vineTongue: number
  vineSprout: number // 싹 키 px
  vineSproutOpacity: number
  vineHard: number // 굳은 정도
  vineKnot: number // 봉오리가 돋은 정도
  vineOpacity: number
  seed: number // 바닥에 놓인 씨앗 투명도, 0이면 씨앗 없는 칸
  seedLand: number // 씨앗으로 솟은 볏짚빛 층 수
  seedStalk: number // 보스 기둥 줄기 층 수, 0이면 기둥 없는 칸
  seedBud: number // 보스 기둥 봉오리가 돋은 정도 0~1
  seedLeaves: number // 솟은 땅에 남은 잎이 드러난 정도 0~1
  seedTree: number // 사라지는 나무 단계, 0이면 나무 없는 칸
  seedTreeNext: number // 들어서는 나무 단계, 0이면 나무 없는 칸
  seedTreeP: number
  seedStakes: number // 사라지는 말뚝 수
  seedStakesNext: number // 들어서는 말뚝 수
  seedStakeP: number
  children?: ReactNode
}

const BoardCell = ({
  x,
  y,
  h,
  parity,
  goal,
  filled,
  ice,
  frost,
  crack,
  crackStage,
  crackBroken,
  crackFall,
  crackShadow,
  crackSeed,
  hidden,
  swamp,
  swampFilled,
  swampRisen,
  swampDeep,
  mushroom,
  mushroomPress,
  mushroomWither,
  water,
  waterBankX,
  waterBankY,
  waterSideLeft,
  waterSideRight,
  waterRing,
  waterRingOpacity,
  faded,
  entity,
  lift,
  warp,
  switchDepth,
  doorDepth,
  box,
  rail,
  railNext,
  pitWallLeft,
  pitWallRight,
  blockOpacity,
  flatLadder,
  leaning,
  vine,
  vineEnter,
  vineLeave,
  vineGrowth,
  vineRise,
  vineTongue,
  vineSprout,
  vineSproutOpacity,
  vineHard,
  vineKnot,
  vineOpacity,
  seed,
  seedLand,
  seedStalk,
  seedBud,
  seedLeaves,
  seedTree,
  seedTreeNext,
  seedTreeP,
  seedStakes,
  seedStakesNext,
  seedStakeP,
  children,
}: BoardCellProps) => {
  const icy = ice && !goal && !filled
  const grownVine = vine === 'grown'
  const pit = isPit(rail, vine, grownVine, vineRise)
  // 바닥 대신 제 색으로 칠하는 칸, 상자가 메운 칸, 얼음, 발판, 짝 칸, 구멍
  const surface = goal ? 'hole' : filled ? 'tool' : icy ? 'ice' : lift || warp ? 'machine' : null
  const vineProps = {
    x,
    y,
    floor: PIT_FLOOR,
    enter: vineEnter,
    leave: vineLeave,
    growth: vineGrowth,
    tongue: vineTongue,
    sprout: vineSprout,
    sproutOpacity: vineSproutOpacity,
    hard: vineHard,
    knot: vineKnot,
    opacity: vineOpacity,
  }
  const faces = cellFaces(surface, grownVine, vineHard, crack, crackStage, parity)
  const depth = crack ? crackThickness(crackStage) + h * TILE.layer : h * TILE.layer + TILE.lip
  // 원래 땅 위에 볏짚빛으로 얹히는 씨앗으로 솟은 층, 옆면 색이 바뀌는 자리가 경계
  const seedRise = seedLand * TILE.layer
  const split = crackSplit(crack, crackBroken, crackStage)
  const quarters = crackQuarters(x, y, split, crackStage, crackSeed)
  const shards = crackShards(x, y, crackBroken, depth)
  const ladders = leaningOf(leaning)
  // 큐브를 가리는 칸 위 상자도 칸과 같이 흐리는 투명도
  const fade = { opacity: faded ? 0.5 : 1, transition: 'opacity 320ms var(--ease-soft)' }
  const mudY = y + MUD.drop
  const sunk = swampDeep > 0
  // 단계마다 정해진 깊이까지 칸째로 내려가는 큐브, 가라앉는 상자는 Board 몫
  const sink = swampRisen >= 0 ? (MUD.drop + swampSink(swampRisen)) * swampDeep : 0
  const collar = swampRisen >= 0 ? swampCollar(swampRisen) * swampDeep : 0

  return (
    <g>
      {pit && (
        <BoardPit
          x={x}
          y={y}
          rail={rail}
          railNext={railNext}
          pitWallLeft={pitWallLeft}
          pitWallRight={pitWallRight}
          vine={vine}
          grownVine={grownVine}
          vineRise={vineRise}
          vineProps={vineProps}
          faces={faces}
        />
      )}
      {!pit && !hidden && (
        <g style={fade}>
          {crackShadow > 0 && (
            <polygon
              points={blockFaces(x, y - crackFall, TILE.width, 0).top}
              style={{ fill: 'var(--color-crack-shadow)', opacity: crackShadow }}
            />
          )}
          <g opacity={blockOpacity}>
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
            ) : seedLand > 0 ? (
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
                    seedLand >= 1
                      ? 'var(--color-seed-land-top)'
                      : blend(faces.top, 'var(--color-seed-land-top)', seedLand)
                  }
                  left="var(--color-seed-land-left)"
                  right="var(--color-seed-land-right)"
                />
              </>
            ) : filled && h > 0 ? (
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
            {water > 0 && (
              <BoardWater
                part="surface"
                x={x}
                y={y}
                depth={water}
                bankX={waterBankX}
                bankY={waterBankY}
                sideLeft={waterSideLeft}
                sideRight={waterSideRight}
                ring={waterRing}
                ringOpacity={waterRingOpacity}
              />
            )}
            {seedStalk > 0 && <BoardSeed x={x} y={y} part="stalk" level={seedStalk} p={seedBud} />}
            {seedLeaves > 0 && <BoardSeed x={x} y={y} part="leaves" p={seedLeaves} />}
            {(grownVine || vine === 'root') && <BoardVine layer="top" kind={vine} {...vineProps} />}
            <BoardSwamp
              x={x}
              y={y}
              mudY={mudY}
              swamp={swamp}
              swampFilled={swampFilled}
              swampDeep={swampDeep}
              collar={collar}
            />
            {mushroom && (
              <BoardMushroom x={x} y={y} press={mushroomPress} wither={mushroomWither} />
            )}
            {(lift || warp) && <BoardPlate x={x} y={y} warp={warp} />}
            {icy && (
              <polygon
                points={spotPoints(x, y, GLOSS_SPOTS)}
                style={{ fill: 'var(--color-ice-gloss)' }}
              />
            )}
            {frost > 0 && (
              <polygon
                points={blockFaces(x, y, TILE.width, 0).top}
                style={{ fill: 'var(--color-ice-gloss)', opacity: frost * FROST_OPACITY }}
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
      {entity && (
        <BoardSwitch x={x} y={y} entity={entity} switchDepth={switchDepth} doorDepth={doorDepth} />
      )}
      {box && (
        <g style={fade}>
          {water > 0 ? (
            <BoardWater part="box" x={x} y={y - water * TILE.layer} shown={WATER.lip} />
          ) : (
            <BoardBox x={x} y={y - TILE.layer} />
          )}
        </g>
      )}
      {flatLadder > 0 && (
        <g opacity={flatLadder}>
          <BoardLadder x={x} y={y} />
        </g>
      )}
      {ladders.map(({ direction, opacity }) => (
        <g key={direction} opacity={opacity}>
          <BoardLadder x={x} y={y} direction={direction} />
        </g>
      ))}
      {seed > 0 && (
        <g style={fade} opacity={seed}>
          <BoardSeed x={x} y={y} part="seed" />
        </g>
      )}
      {(seedTree > 0 || seedTreeNext > 0) && (
        <g style={fade}>
          <BoardSeed x={x} y={y} part="tree" from={seedTree} to={seedTreeNext} p={seedTreeP} />
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
      {(seedStakes > 0 || seedStakesNext > 0) && (
        <g style={fade}>
          <BoardSeed
            x={x}
            y={y}
            part="stakes"
            from={seedStakes}
            to={seedStakesNext}
            p={seedStakeP}
          />
        </g>
      )}
    </g>
  )
}

// 연출 중에도 바뀌지 않은 칸은 다시 그리기 제외
export default memo(BoardCell)
