import BoardBlock from './BoardBlock'
import { postBlocks } from './view'
import { TILE, blockFaces } from '@/game/iso'

// 범위 판 크기, 칸 폭 배수
const RANGE = 0.9

const POST_FACES = {
  top: 'var(--color-post-top)',
  left: 'var(--color-post-left)',
  right: 'var(--color-post-right)',
}

const BAND_FACES = {
  top: 'var(--color-post-top)',
  left: 'var(--color-post-band)',
  right: 'var(--color-post-band)',
}

type BoardTetherProps =
  | { part: 'post'; x: number; y: number; bands: number }
  | { part: 'rope'; points: string; opacity: number }
  | { part: 'range'; x: number; y: number; active: number } // y는 수면 중심, active는 큐브가 탄 정도

const BoardTether = (props: BoardTetherProps) => {
  const blocks = props.part === 'post' ? postBlocks(props.y, props.bands) : null
  const range =
    props.part === 'range' ? blockFaces(props.x, props.y, TILE.width * RANGE, 0).top : ''

  return props.part === 'rope' ? (
    <polygon points={props.points} opacity={props.opacity} style={{ fill: 'var(--color-rope)' }} />
  ) : props.part === 'range' ? (
    <>
      <polygon points={range} style={{ fill: 'var(--color-moor-range)' }} />
      {props.active > 0 && (
        <polygon
          points={range}
          opacity={props.active}
          style={{ fill: 'var(--color-moor-range-active)' }}
        />
      )}
    </>
  ) : (
    blocks && (
      <>
        <BoardBlock
          x={props.x}
          y={blocks.pillar.y}
          width={blocks.pillar.width}
          depth={blocks.pillar.depth}
          {...POST_FACES}
        />
        {blocks.bands.map((band) => (
          <BoardBlock
            key={band.y}
            x={props.x}
            y={band.y}
            width={band.width}
            depth={band.depth}
            {...BAND_FACES}
          />
        ))}
      </>
    )
  )
}

export default BoardTether
