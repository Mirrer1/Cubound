import { type CSSProperties, type ReactElement, type ReactNode, memo, useMemo } from 'react'

import BoardAmbient from './BoardAmbient'
import BoardBox from './BoardBox'
import BoardBrazier from './BoardBrazier'
import BoardFire from './BoardFire'
import BoardFloor from './BoardFloor'
import BoardIceStone from './BoardIceStone'
import BoardKeg from './BoardKeg'
import BoardLadder from './BoardLadder'
import BoardPit from './BoardPit'
import BoardSeed from './BoardSeed'
import BoardSluice from './BoardSluice'
import BoardSwitch from './BoardSwitch'
import BoardTrail from './BoardTrail'
import BoardWater from './BoardWater'
import {
  type BehindGoal,
  type CellLook,
  type NightBeat,
  type ShadeLook,
  sameCellLook,
  swampSink,
} from './frame'
import {
  ASH_MARK,
  CUBE,
  ICE,
  LEAN_LOOP,
  MUD,
  MUD_DIP,
  PIT_FLOOR,
  STONE,
  type ShadePiece,
  blend,
  boatLook,
  cellFaces,
  floorFaces,
  frostWidth,
  isPit,
  leanShift,
  leaningOf,
  shadeShapes,
  stoneFloat,
  veilMiddle,
  wallCrumble,
  waterTone,
} from './view'
import { TILE, blockFaces } from '@/game/iso'
import { useFade } from '@/hooks/useFade'
import { useLoop } from '@/hooks/useLoop'
import { useNightFade } from '@/hooks/useNightFade'

// 같은 크기 판 두 장을 어긋나게 겹쳐 낸 구멍 두께
// 잠긴 것의 진흙 면 아래를 가리는 자르기, 밑면 앞 모서리를 따라 아이소메트릭 면과 나란한 선
const mudClipPoints = (x: number, y: number) => {
  const hw = (TILE.width * CUBE) / 2
  return `${x - 4000},${y} ${x - hw},${y} ${x},${y + MUD_DIP} ${x + hw},${y} ${x + 4000},${y} ${x + 4000},${y - 4000} ${x - 4000},${y - 4000}`
}

// 어둠 칸의 바닥 장식, 장식 색 변수를 칸 어둠 값만큼 어둠 색으로 섞어 칠함(가리개는 느려서 안 씀)
const Deco = ({
  veil,
  fade,
  children,
}: {
  veil: number | null
  fade: (element: Element | null) => void
  children: ReactNode
}) => (
  // 밝을 때도 같은 묶음 모양을 유지, 어둠이 오갈 때 장식이 새로 그려지면 불씨 꺼짐 연출이 끊김
  <g className={veil !== null ? 'deco-day' : undefined}>
    <g
      ref={veil !== null ? fade : undefined}
      className={veil !== null ? 'deco-night' : undefined}
      style={veil !== null ? ({ '--deco-veil': veil } as CSSProperties) : undefined}
    >
      {children}
    </g>
  </g>
)

// 어둠 칸의 납작한 한 색 장식, 그 모양 안을 바닥 칠 조각과 같은 무늬로 어둡게 칠함
const Shade = ({
  id,
  pieces,
  fade,
  color,
  dim,
  children,
}: {
  id: string
  dim: number // 조각이 없는 고르게 어두운 칸의 어둠 값
  pieces: ShadePiece[]
  fade: (element: Element | null) => void
  color: string
  children: ReactElement<{ points: string; opacity: number }>
}) => {
  // 고르게 어두운 칸은 조각 없이 한 색으로
  if (pieces.length === 0)
    return (
      <polygon
        ref={fade}
        points={children.props.points}
        opacity={children.props.opacity}
        style={{
          fill: `color-mix(in srgb, var(--color-night) calc(var(--veil) * ${dim * 100}%), ${color})`,
        }}
      />
    )
  return (
    <g ref={fade} opacity={children.props.opacity} clipPath={`url(#${id})`}>
      <clipPath id={id}>
        <polygon points={children.props.points} />
      </clipPath>
      {pieces.map((piece, i) => (
        <polygon
          key={i}
          points={piece.points}
          style={{
            fill: `color-mix(in srgb, var(--color-night) calc(var(--veil) * ${piece.value * 100}%), ${color})`,
          }}
        />
      ))}
    </g>
  )
}

interface BoardCellProps extends CellLook {
  behindGoal?: BehindGoal | null
  beat: NightBeat | null // 어둠 세기, 화로와 까마귀 칸만
  shade?: ShadeLook | null
  children?: ReactNode
}

const BoardCell = ({
  behindGoal,
  beat,
  shade = null,
  x,
  y,
  h,
  parity,
  tier,
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
  trail,
  brazier,
  keg,
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
  const baseFaces = cellFaces(surface, grownVine, vine.hard, crack.on, crack.stage, parity, tier)
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
  const markFill = blend(floorFaces(tier, parity).top, 'var(--color-ash-top)', 0.4)
  // 다 탄 숯 벽 자국, 부서지는 동안은 더 진하게
  const wallAsh = blend(
    floorFaces(tier, parity).top,
    'var(--color-ash-top)',
    fire.crumble > 0 ? 0.55 : 0.4,
  )
  const boxTop = y - TILE.layer - brazier.lift
  const ashMark = Math.max(brazier.mark, keg.mark, trail.mark)
  // 타일 색을 직접 칠하는 칸의 바닥 장식, 칸 가운데 어둠 값으로 색을 어둡게
  const cellVeil = shade ? veilMiddle(shade.veil.split(',').map(Number)) : null
  const decoVeil = shade?.deco ? cellVeil : null
  const shadeFade = useNightFade(shade?.beat ?? null)
  const pieces = useMemo(
    () =>
      shade
        ? shadeShapes(
            x,
            y,
            shade.depth,
            shade.veil.split(',').map(Number),
            (shade.sides || shade.veil).split(',').map(Number),
          )
        : [],
    [shade, x, y],
  )
  const topPieces = pieces.filter((piece) => piece.face === 'top')

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
          pitWallLeftShown={pitLook.wallLeftShown}
          pitWallRightShown={pitLook.wallRightShown}
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
            pieces={pieces}
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
            shade={shade}
          />
          {shade && ashMark > 0 && (
            <Shade
              id={`ash-${x}-${y}`}
              pieces={topPieces}
              fade={shadeFade}
              color={markFill}
              dim={cellVeil ?? 0}
            >
              <polygon
                points={blockFaces(x, y, TILE.width * ASH_MARK, 0).top}
                opacity={ashMark}
                style={{ fill: markFill }}
              />
            </Shade>
          )}
          {shade && fire.kind === 'wall' && fire.mark > 0 && (
            <Shade
              id={`wall-ash-${x}-${y}`}
              pieces={topPieces}
              fade={shadeFade}
              color={wallAsh}
              dim={cellVeil ?? 0}
            >
              <polygon
                points={
                  blockFaces(
                    x,
                    y,
                    TILE.width * (fire.crumble > 0 ? wallCrumble(fire.crumble).smudge : ASH_MARK),
                    0,
                  ).top
                }
                opacity={fire.mark}
                style={{ fill: wallAsh }}
              />
            </Shade>
          )}
          {decoVeil !== null && brazier.on && (
            <BoardBrazier
              part="bowl"
              layer="glow"
              x={x}
              y={y}
              flash={brazier.flash}
              covered={brazier.covered}
              beat={beat}
            />
          )}
          <Deco veil={decoVeil} fade={shadeFade}>
            {fire.kind && (
              <BoardFire
                part="floor"
                x={x}
                y={y}
                parity={parity}
                tier={tier}
                {...fire}
                kind={fire.kind}
                markShaded={shade !== null && shade !== undefined}
              />
            )}
            {trail.flame > 0 && (
              <BoardTrail
                part="floor"
                x={x}
                y={y}
                flame={trail.flame}
                pool={trail.pool}
                lit={trail.lit}
              />
            )}
            {!shade && ashMark > 0 && (
              <polygon
                points={blockFaces(x, y, TILE.width * ASH_MARK, 0).top}
                opacity={ashMark}
                style={{ fill: markFill }}
              />
            )}
            {brazier.on && (
              <BoardBrazier
                part="bowl"
                layer={decoVeil !== null ? 'bowl' : 'all'}
                x={x}
                y={y}
                flash={brazier.flash}
                covered={brazier.covered}
                beat={beat}
              />
            )}
          </Deco>
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
      {trail.flame > 0 && !pit && !hidden && (
        <g ref={fadeRef} style={fade}>
          <BoardTrail
            part="flame"
            x={x}
            y={y}
            flame={trail.flame}
            pool={trail.pool}
            lit={trail.lit}
          />
        </g>
      )}
      {fire.kind === 'wall' && (
        <g ref={fadeRef} style={fade}>
          <BoardFire
            part="pile"
            x={x}
            y={y}
            parity={parity}
            tier={tier}
            {...fire}
            kind={fire.kind}
          />
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
            <g ref={cellVeil !== null ? shadeFade : undefined}>
              <BoardBox x={x} y={boxTop} dim={cellVeil} />
            </g>
          )}
        </g>
      )}
      {keg.dust >= 0 && (
        <BoardKeg part="dust" x={x} y={y} tier={tier} s={keg.dust} du={keg.dustU} dv={keg.dustV} />
      )}
      {keg.on && (
        <g opacity={keg.opacity}>
          <BoardKeg
            part="keg"
            x={x}
            y={y - keg.lift * TILE.layer}
            swell={keg.swell}
            heat={keg.heat}
            cords={keg.cords}
            ember={keg.ember}
            ashTo={keg.ashTo}
            ash={keg.ash}
          />
        </g>
      )}
      {keg.burst >= 0 && <BoardKeg part="burst" x={x} y={y} s={keg.burst} />}
      {brazier.burn >= 0 && (
        <BoardBrazier part="box" x={x} y={boxTop} hint={1} burn={brazier.burn} />
      )}
      {iceStone.patch > 0 && (
        <polygon
          points={blockFaces(x, y, TILE.width * frostWidth(iceStone.patch), 0).top}
          style={{ fill: blend(floorFaces(tier, false).top, 'var(--color-ice)', 0.55) }}
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
            tier={tier}
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
        ambient.kind === 'emberSmoke' ||
        ambient.kind === 'brazierSmoke' ||
        ambient.kind === 'brazierSpark' ||
        ambient.kind === 'crow') && (
        <BoardAmbient
          x={x}
          y={ambient.kind === 'mist' ? Math.min(y, iceTop) : y}
          {...ambient}
          kind={ambient.kind}
          beat={beat}
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
      {!pit && !hidden && seed.stalk > 0 && (
        <g ref={fadeRef} style={fade}>
          <BoardSeed x={x} y={y} part="stalk" level={seed.stalk} p={seed.bud} />
        </g>
      )}
      {(seed.stakes > 0 || seed.stakesNext > 0) && (
        <g ref={fadeRef} style={fade}>
          <BoardSeed
            x={x + seed.stakeDx}
            y={y + seed.stakeDy}
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
