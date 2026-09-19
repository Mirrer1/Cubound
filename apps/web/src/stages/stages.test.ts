import { describe, expect, it } from 'vitest'

import { STAGES_PER_WORLD, WORLDS, nextStageId, parseStageId, stageIdsOf } from '.'
import { solve } from '@/game/solver'
import type { Stage } from '@/game/types'
import { validateStage } from '@/game/validate'
import { stageTextKey, worldTextKey } from '@/i18n'
import { en } from '@/i18n/en'

const STAGES = Object.entries(
  import.meta.glob<Stage>('./**/*.json', { eager: true, import: 'default' }),
)

const MADE_IDS = new Set(STAGES.map(([, stage]) => stage.id))

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

  it.each(STAGES)('%s의 월드가 월드 목록에 있다', (_, stage) => {
    expect(WORLDS).toContain(parseStageId(stage.id).world)
  })

  it('모든 월드 이름이 사전에 있다', () => {
    expect(WORLDS.filter((world) => !(worldTextKey(world) in en))).toEqual([])
  })
})

describe('stageIdsOf', () => {
  it('만들어 둔 스테이지만 돌려준다', () => {
    const ids = WORLDS.flatMap((world) => stageIdsOf(world))

    expect(ids.filter((id) => !MADE_IDS.has(id))).toEqual([])
  })

  it('월드의 스테이지를 하나도 빠뜨리지 않는다', () => {
    const count = WORLDS.reduce((sum, world) => sum + stageIdsOf(world).length, 0)

    expect(count).toBe(MADE_IDS.size)
  })

  it.each(WORLDS)('%i월드는 번호순으로 돌려준다', (world) => {
    const numbers = stageIdsOf(world).map((id) => parseStageId(id).stage)

    expect(numbers).toEqual([...numbers].sort((a, b) => a - b))
  })

  it('열 판을 다 만든 월드는 열 판을 모두 돌려준다', () => {
    expect(stageIdsOf(1)).toHaveLength(STAGES_PER_WORLD)
  })

  it('없는 월드는 비어 있다', () => {
    expect(stageIdsOf(99)).toEqual([])
  })
})

describe('nextStageId', () => {
  it('월드 안에서는 다음 번호로 간다', () => {
    expect(nextStageId('1-3')).toBe('1-4')
  })

  it('월드 마지막 스테이지 다음은 다음 월드의 첫 스테이지다', () => {
    expect(nextStageId('1-10')).toBe('2-1')
  })

  it('다음은 언제나 만들어 둔 스테이지다', () => {
    const nextIds = WORLDS.flatMap((world) => stageIdsOf(world)).map((id) => nextStageId(id))

    expect(nextIds.filter((id) => id !== undefined && !MADE_IDS.has(id))).toEqual([])
  })

  it('마지막 월드의 마지막 스테이지 다음은 없다', () => {
    const ids = stageIdsOf(WORLDS[WORLDS.length - 1])

    expect(nextStageId(ids[ids.length - 1])).toBeUndefined()
  })

  it('만들지 않은 스테이지에서는 다음이 없다', () => {
    expect(nextStageId('99-1')).toBeUndefined()
  })
})
