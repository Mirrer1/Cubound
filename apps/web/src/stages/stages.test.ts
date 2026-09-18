import { describe, expect, it } from 'vitest'

import { WORLDS } from '.'
import { solve } from '@/game/solver'
import type { Stage } from '@/game/types'
import { validateStage } from '@/game/validate'
import { stageTextKey, worldTextKey } from '@/i18n'
import { en } from '@/i18n/en'

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

  it.each(STAGES)('%s의 이름과 가이드 문구가 사전에 있다', (_, stage) => {
    const keys = [stageTextKey(stage.id), ...(stage.guides ?? []).map((g) => `guide.${g.id}`)]

    expect(keys.filter((key) => !(key in en))).toEqual([])
  })

  it('모든 월드 이름이 사전에 있다', () => {
    expect(WORLDS.filter((world) => !(worldTextKey(world) in en))).toEqual([])
  })
})
