import { describe, expect, it } from 'vitest'

import { solve } from '@/game/solver'
import type { Stage } from '@/game/types'
import { validateStage } from '@/game/validate'

const STAGES = Object.entries(
  import.meta.glob<Stage>('./**/*.json', { eager: true, import: 'default' }),
)

describe('스테이지 데이터', () => {
  it.each(STAGES)('%s는 형식 검사를 통과한다', (_, stage) => {
    const result = validateStage(stage)

    expect(result.ok ? [] : result.errors).toEqual([])
  })

  it.each(STAGES)('%s는 풀 수 있고 best가 최소 이동 수와 같다', (_, stage) => {
    const result = solve(stage)

    expect(result.status).toBe('solved')
    expect(stage.best).toBe(result.status === 'solved' ? result.moves : undefined)
  })

  it.each(STAGES)('%s의 id가 파일 경로와 맞다', (path, stage) => {
    const [, world, file] = path.match(/world-(\d+)\/(\d+)\.json$/) ?? []

    expect(stage.id).toBe(`${Number(world)}-${Number(file)}`)
  })
})
