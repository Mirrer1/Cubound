import { memo } from 'react'

import { coverOutline, coverPath, veilMiddle, veilShapes } from './view'

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
}

const opacityOf = (value: number) => ({ fillOpacity: `calc(var(--night-field, 0) * ${value})` })

// 칸 막 세기는 판 변수 --night-field × 빛 지도 값, 물건은 한 덩이 덮개로 따로
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
}: BoardNightProps) => {
  const values = veil.split(',').map(Number)
  const sideValues = sides ? sides.split(',').map(Number) : values
  const shapes = veilShapes(x, y, depth, values, sideValues, {
    left: openLeft,
    right: openRight,
    backLeft: openBackLeft,
    backRight: openBackRight,
  })
  const blocks = cover
    ? cover.split(',').map((b) => {
        const [bx, by, width, height] = b.split(' ').map(Number)
        return { x: bx, y: by, width, height }
      })
    : []
  const outline = blocks.length > 0 ? coverOutline(x, y, blocks) : ''
  const shape = coverPath(x, y, blocks)
  const clipId = `veil-${x}-${y}`
  const box = { x: x + CLIP.x, y: y + CLIP.y, w: CLIP.width, h: CLIP.height }
  const clipped = outline !== '' || hole !== ''
  const cut = [`M${box.x},${box.y}h${box.w}v${box.h}h${-box.w}Z`, outline && `M${outline}Z`, hole]
    .filter(Boolean)
    .join(' ')
  // 고른 칸은 바닥 막과 물건 덮개를 한 경로로 합쳐 이음매 줄 없음
  const merged = values.length === 1 && !sides && outline !== '' && !hole

  return merged ? (
    <g style={{ fill: 'var(--color-night)' }} shapeRendering="crispEdges">
      <path d={`M${shapes[0].points}Z ${shape}`} style={opacityOf(values[0])} />
      {shapes.slice(1).map((shape, i) => (
        <polygon key={i} points={shape.points} style={opacityOf(shape.opacity)} />
      ))}
    </g>
  ) : (
    <g style={{ fill: 'var(--color-night)' }} shapeRendering="crispEdges">
      {clipped && (
        <clipPath id={clipId}>
          <path d={cut} clipRule="evenodd" />
        </clipPath>
      )}
      <g clipPath={clipped ? `url(#${clipId})` : undefined}>
        {shapes.map((shape, i) => (
          <polygon key={i} points={shape.points} style={opacityOf(shape.opacity)} />
        ))}
      </g>
      {outline && <path d={shape} style={opacityOf(veilMiddle(values))} />}
    </g>
  )
}

export default memo(BoardNight)
