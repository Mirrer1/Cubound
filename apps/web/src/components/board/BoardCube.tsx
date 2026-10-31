import type { CSSProperties } from 'react'

import BoardBrazier from './BoardBrazier'
import BoardLadder from './BoardLadder'
import BoardSeed from './BoardSeed'
import type { sceneFrame } from './frame'
import { shade } from './view'
import { TILE } from '@/game/iso'

interface BoardCubeProps {
  scene: ReturnType<typeof sceneFrame>
  drawCube: boolean
  lean: CSSProperties | undefined
  leanRef: (element: Element | null) => void
}

const BoardCube = ({ scene, drawCube, lean, leanRef }: BoardCubeProps) => (
  <>
    {drawCube && scene.cubeClip && (
      <clipPath id="crack-cube-clip">
        <polygon points={scene.cubeClip} />
      </clipPath>
    )}
    <g
      clipPath={drawCube && scene.cubeClip ? 'url(#crack-cube-clip)' : undefined}
      ref={lean && drawCube ? leanRef : undefined}
      className={lean && drawCube ? 'whirl-lean' : undefined}
      style={drawCube ? lean : undefined}
    >
      {drawCube && (
        <g
          opacity={(scene.cubeDrop ? scene.cubeDrop.opacity : 1) * scene.cube.fade}
          transform={`translate(0 ${scene.cubeSink - scene.cube.lift}) ${scene.cubeSquash}`}
        >
          {scene.cubeHeat.length > 0 && (
            <BoardBrazier
              part="cubePool"
              x={scene.cubeScreen.x}
              y={scene.cubeScreen.y}
              strength={scene.brazier.glow.strength * scene.cubePool}
              dip={scene.brazier.glow.dip}
            />
          )}
          {scene.cubeFaces.map((f) => (
            <polygon key={f.face} points={f.points} style={{ fill: shade('player', f.face) }} />
          ))}
          {(scene.cubeHeat.length > 0 || scene.brazier.glow.last > 0) && (
            <BoardBrazier
              part="cubeGlow"
              x={scene.cubeScreen.x}
              y={scene.cubeScreen.y - TILE.layer}
              bands={scene.cubeHeat}
              strength={scene.brazier.glow.strength}
              dip={scene.brazier.glow.dip}
              spark={scene.brazier.glow.spark}
              last={scene.brazier.glow.last}
            />
          )}
        </g>
      )}
      {drawCube && scene.carriedOpacity > 0 && (
        <g opacity={scene.carriedOpacity * scene.cube.fade}>
          {scene.carried === 'seed' ? (
            <BoardSeed
              x={scene.carriedBase.x}
              y={scene.carriedBase.y}
              part="seed"
              tilt={scene.bump}
            />
          ) : (
            <BoardLadder
              x={scene.carriedBase.x}
              y={scene.carriedBase.y - 2}
              tilt={scene.ladderBump}
            />
          )}
        </g>
      )}
      {drawCube && scene.plantedSeed && scene.plantedSeed.opacity > 0 && (
        <g
          opacity={scene.plantedSeed.opacity}
          transform={`translate(${scene.plantedSeed.x} ${scene.plantedSeed.y}) scale(${scene.plantedSeed.scale}) translate(${-scene.plantedSeed.x} ${-scene.plantedSeed.y})`}
        >
          <BoardSeed
            x={scene.plantedSeed.x}
            y={scene.plantedSeed.y}
            part="seed"
            tilt={scene.plantTilt}
          />
        </g>
      )}
    </g>
  </>
)

export default BoardCube
