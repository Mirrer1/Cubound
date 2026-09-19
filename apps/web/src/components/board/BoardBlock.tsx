import { blockFaces } from '@/game/iso'

interface BoardBlockProps {
  x: number
  y: number
  width: number
  depth: number
  top: string
  left: string
  right: string
}

const BoardBlock = ({ x, y, width, depth, top, left, right }: BoardBlockProps) => {
  const faces = blockFaces(x, y, width, depth)

  return (
    <g>
      <polygon points={faces.left} style={{ fill: left }} />
      <polygon points={faces.right} style={{ fill: right }} />
      <polygon points={faces.top} style={{ fill: top }} />
    </g>
  )
}

export default BoardBlock
