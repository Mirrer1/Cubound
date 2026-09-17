import { blockFaces } from '@/game/iso'

interface BoardBlockProps {
  x: number
  y: number
  width: number
  depth: number
  top: string
  left: string
  right: string
  stroke?: string
}

const BoardBlock = ({ x, y, width, depth, top, left, right, stroke }: BoardBlockProps) => {
  const faces = blockFaces(x, y, width, depth)

  return (
    <g>
      <polygon points={faces.left} style={{ fill: left }} />
      <polygon points={faces.right} style={{ fill: right }} />
      <polygon
        points={faces.top}
        style={{ fill: top, stroke: stroke ?? 'none', strokeWidth: 0.8 }}
      />
    </g>
  )
}

export default BoardBlock
