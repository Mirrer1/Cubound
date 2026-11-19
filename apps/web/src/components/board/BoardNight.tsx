import { memo } from 'react'

import { type NightBeat } from './frame'
import { coverOutline, coverPath, veilFootprint, veilMiddle, veilShapes } from './view'
import { useNightFade, useNightTurning } from '@/hooks/useNightFade'

// 물건을 뺀 바닥 막 잘라내기 범위 px
const CLIP = { x: -120, y: -200, width: 240, height: 400 }

interface BoardNightProps {
  x: number
  y: number
  depth: number // 칸 옆면 높이 px
  cover: string // 물건 모양 덮개 블록마다 x y 폭 높이, 쉼표로 이음
  veil: string // 윗면 빛 지도 8x8 또는 고른 값 하나, 쉼표로 이음
  sides: string // 옆면 빛 지도, 윗면과 같으면 빈 글자
  openLeft: boolean // 왼쪽 앞 칸이 낮거나 없음
  openRight: boolean // 오른쪽 앞 칸이 낮거나 없음
  openBackLeft: boolean // 왼쪽 뒤 칸이 없거나 구덩이
  openBackRight: boolean // 오른쪽 뒤 칸이 없거나 구덩이
  hole: string // 지나가는 상자 모양 경로, 바닥 막에서 잘라 냄
  beat: NightBeat | null
  floor: boolean // 바닥 막, 타일 색을 직접 칠하는 칸은 물건 덮개만
}

// 칸 막 세기는 빛 지도 값, 어둠 세기는 묶음 투명도, 물건은 한 덩이 덮개로 따로

const BoardNight = ({
  x,
  y,
  depth,
  cover,
  veil,
  sides,
  openLeft,
  openRight,
  openBackLeft,
  openBackRight,
  hole,
  beat,
  floor,
}: BoardNightProps) => {
  const fade = useNightFade(beat)
  const opacityOf = (value: number) => ({ fillOpacity: `calc(var(--veil) * ${value})` })
  const values = veil.split(',').map(Number)
  const sideValues = sides ? sides.split(',').map(Number) : values
  // 빛 밖 물건 덮개는 둘레를 1px 넓혀 물건 색 실선이 새지 않게, 빛 안은 둘레가 겹쳐 진한 선이 생겨 그대로
  const coverVeil = veilMiddle(values)
  const dimCover = coverVeil >= 0.98
  const coverStyle = {
    ...opacityOf(coverVeil),
    ...(dimCover
      ? {
          stroke: 'var(--color-night)',
          strokeWidth: 1,
          // 둘레는 거의 다 어두워졌을 때만, 바뀌는 중에는 바닥 막과 겹쳐 검은 선
          strokeOpacity: `calc(max(0, var(--veil) * 10 - 9) * ${coverVeil})`,
        }
      : {}),
  }

  const blocks = cover
    ? cover.split(',').map((b) => {
        const [bx, by, width, height] = b.split(' ').map(Number)
        return { x: bx, y: by, width, height }
      })
    : []
  const outline = blocks.length > 0 ? coverOutline(x, y, blocks) : ''
  const shape = coverPath(x, y, blocks)
  // 물건 덮개는 점에 맞춰 자르지 않음, 맞추면 물건 테두리가 밝게 샘(막 묶음은 crispEdges)
  const coverEl = <path d={shape} style={coverStyle} shapeRendering="auto" />

  const clipId = `veil-${x}-${y}`
  const box = { x: x + CLIP.x, y: y + CLIP.y, w: CLIP.width, h: CLIP.height }
  const clipped = outline !== '' || hole !== ''
  const cut = [`M${box.x},${box.y}h${box.w}v${box.h}h${-box.w}Z`, outline && `M${outline}Z`, hole]
    .filter(Boolean)
    .join(' ')
  // 어둠이 바뀌는 동안은 바닥 막을 칸 둘레 안으로, 다 바뀐 뒤엔 옆 칸과 겹쳐 틈 덮기
  const turning = useNightTurning(beat)
  const open = {
    left: openLeft,
    right: openRight,
    backLeft: openBackLeft,
    backRight: openBackRight,
  }
  const edged = turning
  const shapes = veilShapes(x, y, depth, values, sideValues, open, edged)
  const rimId = `rim-${x}-${y}`
  const edgeId = `edge-${x}-${y}`
  // 고른 칸은 바닥 막과 물건 덮개를 한 경로로 합쳐 이음매 줄 없음
  const merged = values.length === 1 && !sides && outline !== '' && !hole && !edged

  if (!floor)
    return outline ? (
      <g ref={fade} style={{ fill: 'var(--color-night)' }} shapeRendering="crispEdges">
        {outline && coverEl}
      </g>
    ) : null

  return merged ? (
    <g ref={fade} style={{ fill: 'var(--color-night)' }} shapeRendering="crispEdges">
      <path d={`M${shapes[0].points}Z ${shape}`} style={opacityOf(values[0])} />
      {dimCover && <path d={shape} style={{ ...coverStyle, fill: 'none' }} />}
      {shapes.slice(1).map((shape, i) => (
        <polygon key={i} points={shape.points} style={opacityOf(shape.opacity)} />
      ))}
    </g>
  ) : (
    <g ref={fade} style={{ fill: 'var(--color-night)' }} shapeRendering="crispEdges">
      {clipped && (
        <clipPath id={clipId}>
          <path d={cut} clipRule="evenodd" />
        </clipPath>
      )}
      {edged && (
        <>
          <clipPath id={rimId}>
            <polygon
              points={veilFootprint(x, y, depth, open, 'inner')}
              shapeRendering="crispEdges"
            />
          </clipPath>
          <clipPath id={edgeId}>
            <polygon points={veilFootprint(x, y, depth, open, 'outer')} />
          </clipPath>
        </>
      )}
      <g clipPath={edged ? `url(#${edgeId})` : undefined}>
        <g clipPath={edged ? `url(#${rimId})` : undefined}>
          <g clipPath={clipped ? `url(#${clipId})` : undefined}>
            {shapes.map((shape, i) => (
              <polygon key={i} points={shape.points} style={opacityOf(shape.opacity)} />
            ))}
          </g>
        </g>
      </g>
      {outline && coverEl}
    </g>
  )
}

export default memo(BoardNight)
