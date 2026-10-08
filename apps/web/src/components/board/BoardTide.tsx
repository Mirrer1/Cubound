import type { CellLook } from './frame'
import { blend, waterTone } from './view'
import { TILE, blockFaces } from '@/game/iso'

interface BoardTideProps {
  x: number
  y: number
  faces: { top: string; left: string; right: string }
  tide: CellLook['tide']
}

const BoardTide = ({ x, y, faces, tide }: BoardTideProps) => (
  <>
    {tide.wet > 0 && (
      <polygon
        points={blockFaces(x, y, TILE.width, 0).top}
        style={{ fill: blend(faces.top, waterTone(1), 0.45) }}
        opacity={tide.wet}
      />
    )}
    {tide.band > 0 && tide.bandLeft && (
      <polygon
        points={blockFaces(x, y + tide.bandTop, TILE.width, tide.bandHeight).left}
        style={{ fill: blend(faces.left, 'var(--color-water-left)', 0.35) }}
        opacity={tide.band}
      />
    )}
    {tide.band > 0 && tide.bandRight && (
      <polygon
        points={blockFaces(x, y + tide.bandTop, TILE.width, tide.bandHeight).right}
        style={{ fill: blend(faces.right, 'var(--color-water-right)', 0.35) }}
        opacity={tide.band}
      />
    )}
  </>
)

export default BoardTide
