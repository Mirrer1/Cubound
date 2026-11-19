import { type CSSProperties, Fragment } from 'react'

import BoardBar from './BoardBar'
import BoardBox from './BoardBox'
import BoardBrazier from './BoardBrazier'
import BoardCell from './BoardCell'
import BoardClear from './BoardClear'
import BoardCube from './BoardCube'
import BoardIceStone from './BoardIceStone'
import BoardKeg from './BoardKeg'
import BoardNight from './BoardNight'
import BoardShadow from './BoardShadow'
import BoardSluice from './BoardSluice'
import BoardTram from './BoardTram'
import BoardWater from './BoardWater'
import BoardWhirlpool from './BoardWhirlpool'
import { type Slot, type SlotFrame, same } from './frame'
import { WATER, leanShift } from './view'
import { TILE } from '@/game/iso'
import type { Point } from '@/game/types'
import { useNightFade } from '@/hooks/useNightFade'

// 가이드로 어둠이 바뀌는 동안 그림자 다리는 칸 어둠 세기만큼 보임
const BRIDGE_FADE = { opacity: 'var(--veil)' }

// 다시 그리는 칸에만 넘기는 그 순간 판 전체 값
export interface SlotScene extends SlotFrame {
  leanLoop: (element: Element | null) => void
}

// base: 평소 칸 그림, bridge: 그림자 다리만, top: 다리 위로 올라와야 하는 것(다리 위 상자, 큐브)만
// 예고와 어둠 동안 그림자 다리는 땅과 상자보다 위에 그려 옆 물건이 보였다 사라져도 다리 모양이 그대로
export type SlotLayer = 'all' | 'base' | 'bridge' | 'top'

interface BoardSlotProps {
  slot: Slot
  frame: SlotScene
  layer?: SlotLayer
  lifted?: boolean // 위 칸 내용을 top 층에서 그림
  under?: string // 그림자 다리 밑면을 그리지 않을 옆 칸 윗면 경로
  cut?: string // 그림자 다리를 통째로 비울 큐브 모양 경로
  bridgesAbove?: boolean // 그림자 다리를 bridge 층에서 따로 그림
}

const BoardSlot = ({
  slot,
  frame,
  layer = 'all',
  lifted = false,
  under = '',
  cut = '',
  bridgesAbove = false,
}: BoardSlotProps) => {
  const { cell, look, sinkingBox, bridge, shownBridge, bridgeBox, veil } = slot
  const coverFade = useNightFade(frame.beat)
  const dark = frame.night !== null
  const showBridge = layer === 'all' || layer === 'bridge' || (layer === 'base' && !bridgesAbove)
  const showTop = layer === 'all' || layer === 'top' || (layer === 'base' && !lifted)
  const content = slot.content && showTop ? <SlotContent slot={slot} frame={frame} /> : undefined

  if (layer === 'top' && !cell.bare) return content ?? null
  if (layer === 'bridge' && !cell.bare && !sinkingBox) return null

  return cell.bare ? (
    <g>
      {showBridge && bridge && shownBridge > 0 && (
        <g
          ref={slot.bridgeFade ? coverFade : undefined}
          style={slot.bridgeFade ? BRIDGE_FADE : undefined}
        >
          <BoardShadow
            x={cell.x}
            y={cell.y - bridge.level * TILE.layer}
            axis={bridge.axis}
            parity={bridge.parity}
            shown={shownBridge}
            lit={slot.bridgeLit}
            under={layer === 'bridge' ? under : ''}
            cut={layer === 'bridge' ? cut : ''}
            id={cell.key}
          />
        </g>
      )}
      {showTop && bridgeBox && (
        <>
          {/* 다리 위 상자도 덮개 대신 색을 직접 어둡게, 덮개는 테두리가 반쯤 덮여 밝게 샘 */}
          <g ref={dark ? coverFade : undefined}>
            <BoardBox x={cell.x} y={bridgeBox.top} dim={dark ? bridgeBox.opacity : null} />
          </g>
        </>
      )}
      {content}
    </g>
  ) : (
    <Fragment>
      {showBridge && sinkingBox && bridge && shownBridge > 0 && (
        <g
          ref={slot.bridgeFade ? coverFade : undefined}
          style={slot.bridgeFade ? BRIDGE_FADE : undefined}
        >
          <BoardShadow
            x={cell.x}
            y={cell.y - bridge.level * TILE.layer}
            axis={bridge.axis}
            parity={bridge.parity}
            shown={shownBridge}
            lit={slot.bridgeLit}
            under={layer === 'bridge' ? under : ''}
            cut={layer === 'bridge' ? cut : ''}
            id={cell.key}
          />
        </g>
      )}
      {layer === 'bridge' ? null : (
        <BoardCell
          {...look}
          hidden={look.hidden || sinkingBox}
          behindGoal={slot.behindGoal}
          beat={slot.beat}
          shade={dark ? slot.shade : null}
        >
          {content}
        </BoardCell>
      )}
      {layer !== 'bridge' && veil && dark && (
        <BoardNight x={look.x} y={look.y} {...veil} beat={frame.beat} floor={!slot.shade} />
      )}
    </Fragment>
  )
}

const SlotContent = ({ slot, frame }: { slot: Slot; frame: SlotScene }) => {
  const { cell, cellY, look, over, taps, sinkingBox } = slot
  const { scene, night, sinkCovers, boxCover, playerCover, leanLoop } = frame
  const coverFade = useNightFade(frame.beat)
  const dark = frame.night !== null
  const cubeLean = scene.cubeLean
    ? (leanShift(scene.cubeLean.toward, scene.cubeLean.amp) as CSSProperties)
    : undefined
  const rowLean = scene.rowLean
    ? (leanShift(scene.rowLean.toward, scene.rowLean.amp) as CSSProperties)
    : undefined
  const { brazier } = scene
  const burnOf = (to: Point) =>
    brazier.burning && same(brazier.burning.at, to) ? brazier.burning.q : -1

  return (
    <>
      {sinkingBox && (
        // 떨어지는 상자도 다리 위에 있던 때처럼 덮개 대신 색을 직접 어둡게, 바뀌는 순간 모양이 이어짐
        <g ref={dark ? coverFade : undefined}>
          <BoardBox
            x={cell.x}
            y={cellY - TILE.layer + (night?.sink ?? 0) * TILE.layer}
            dim={
              dark ? (sinkCovers.find((cover) => same(cover.to, cell.p))?.opacity ?? null) : null
            }
          />
        </g>
      )}
      {over.barClip && (
        <clipPath id={`crack-bar-clip-${cell.p.x}-${cell.p.y}`}>
          <polygon points={over.barClip} />
        </clipPath>
      )}
      <g clipPath={over.barClip ? `url(#crack-bar-clip-${cell.p.x}-${cell.p.y})` : undefined}>
        {over.bars.map((bar, i) => (
          <BoardBar key={i} {...bar} />
        ))}
      </g>
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
      {over.drawBoxes.map((box) => (
        <g
          key={`${box.to.x}-${box.to.y}`}
          clipPath={box.clip ? `url(#crack-box-clip-${box.to.x}-${box.to.y})` : undefined}
        >
          {box.clip && (
            <clipPath id={`crack-box-clip-${box.to.x}-${box.to.y}`}>
              <polygon points={box.clip} />
            </clipPath>
          )}
          {scene.box && same(box.to, scene.box.to) && scene.boxShown !== null ? (
            <g
              ref={scene.rowLean ? leanLoop : undefined}
              className={scene.rowLean ? 'whirl-lean' : undefined}
              style={rowLean}
            >
              <BoardWater part="box" x={box.x} y={box.y} shown={scene.boxShown} />
            </g>
          ) : brazier.boss ? (
            <BoardBrazier
              part="box"
              x={box.x}
              y={box.y}
              hint={burnOf(box.to) >= 0 ? 1 : 0}
              burn={burnOf(box.to)}
            />
          ) : dark && boxCover && same(box.to, boxCover.to) ? (
            // 어둠에 밀리는 상자는 덮개 대신 색을 직접 어둡게, 덮개는 상자와 어긋나 윗면이 찌그러져 보임
            <g ref={coverFade}>
              <BoardBox x={box.x} y={box.y} dim={boxCover.opacity} />
            </g>
          ) : (
            <BoardBox x={box.x} y={box.y} />
          )}
          {dark && boxCover && same(box.to, boxCover.to) && brazier.boss && (
            <path
              ref={coverFade}
              // 점에 맞춰 자르면 움직이는 동안 상자 테두리가 새었다 말았다 번쩍임
              d={boxCover.d}
              style={{
                fill: 'var(--color-night)',
                fillOpacity: `calc(var(--veil) * ${boxCover.opacity})`,
              }}
            />
          )}
        </g>
      ))}
      {over.kegs.map((keg) => (
        <g key={`${keg.to.x}-${keg.to.y}`} clipPath={keg.clip ? 'url(#crack-keg-clip)' : undefined}>
          {keg.clip && (
            <clipPath id="crack-keg-clip">
              <polygon points={keg.clip} />
            </clipPath>
          )}
          <BoardKeg
            part="keg"
            x={keg.x}
            y={keg.y}
            swell={keg.look.swell}
            heat={keg.look.heat}
            cords={keg.look.cords}
            ember={keg.look.ember}
            ashTo={keg.look.ashTo}
            ash={keg.look.ash}
            trailU={keg.look.trail.u}
            trailV={keg.look.trail.v}
          />
        </g>
      ))}
      {over.whirlBoxes.map((boat) => (
        <BoardWhirlpool key={`${boat.to.x}-${boat.to.y}`} part="boat" {...boat} />
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
      {over.stones.map((stone) => (
        <g
          key={`${stone.to.x}-${stone.to.y}`}
          clipPath={stone.clip ? `url(#crack-stone-clip-${stone.to.x}-${stone.to.y})` : undefined}
        >
          {stone.clip && (
            <clipPath id={`crack-stone-clip-${stone.to.x}-${stone.to.y}`}>
              <polygon points={stone.clip} />
            </clipPath>
          )}
          <BoardIceStone part="stone" {...stone} tier={look.tier} />
        </g>
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
            <>
              <BoardBrazier
                part="box"
                x={cell.x}
                y={cellY - TILE.layer - over.boxDrop.lift * TILE.layer - look.brazier.lift}
                hint={0}
                burn={-1}
              />
            </>
          )}
        </g>
      )}
      <BoardCube scene={scene} drawCube={over.drawCube} lean={cubeLean} leanRef={leanLoop} />
      {dark && !scene.dropping && over.drawCube && playerCover && (
        <g transform={scene.cubeSquash || undefined}>
          <path
            ref={coverFade}
            // 점에 맞춰 자르면 움직이는 동안 큐브 테두리가 새었다 말았다 번쩍임
            d={playerCover.d}
            style={{
              fill: 'var(--color-night)',
              fillOpacity: `calc(var(--veil) * ${playerCover.opacity})`,
            }}
          />
        </g>
      )}
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
      {over.goalEffect && (
        <BoardClear x={cell.x} y={cell.y}>
          {scene.cubeHeat.length > 0 && (
            <BoardBrazier
              part="cubeGlow"
              x={scene.cubeScreen.x}
              y={scene.cubeScreen.y - TILE.layer}
              bands={scene.cubeHeat}
              strength={brazier.glow.strength}
              dip={brazier.glow.dip}
              spark={brazier.glow.spark}
              last={brazier.glow.last}
            />
          )}
        </BoardClear>
      )}
    </>
  )
}

export default BoardSlot
