import { describe, expect, it } from 'vitest'

import {
  STAGES_PER_WORLD,
  WORLDS,
  chapterStageIds,
  chapterUnlockStageId,
  currentWorldOf,
  cycleOf,
  isBossStage,
  nextStageId,
  parseStageId,
  previousWorld,
  stageIdsOf,
  worldUnlockStageId,
  worldsOf,
} from '.'
import { EMPTY_PROGRESS, type Progress } from '@/game/progress'
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

  // 탐색이 5초 안팎인 10월드 네 요소 판에 맞춘 넉넉한 시간 제한
  it.each(STAGES)(
    '%s는 풀 수 있고 best가 최소 이동 수와 같다',
    (_, stage) => {
      const result = solve(stage)

      expect(result.status).toBe('solved')
      expect(stage.best).toBe(result.status === 'solved' ? result.moves : undefined)
    },
    40000,
  )

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

const cleared = (...ids: string[]): Progress => ({
  ...EMPTY_PROGRESS,
  stages: Object.fromEntries(ids.map((id) => [id, { bestMoves: 1, stars: 3 }])),
})

describe('cycleOf', () => {
  it('월드 다섯이 한 장이다', () => {
    expect([1, 5, 6, 10, 11].map(cycleOf)).toEqual([1, 1, 2, 2, 3])
  })
})

describe('worldsOf', () => {
  it('그 장에 든 월드를 번호순으로 돌려준다', () => {
    expect(worldsOf(1)).toEqual([1, 2, 3, 4, 5])
    expect(worldsOf(2)).toEqual([6, 7, 8, 9, 10])
  })

  it('만들지 않은 장은 비어 있다', () => {
    expect(worldsOf(99)).toEqual([])
  })
})

describe('chapterStageIds', () => {
  it('그 장의 스테이지를 월드 순서대로 이어 돌려준다', () => {
    const ids = chapterStageIds(1)

    expect(ids).toHaveLength(50)
    expect(ids[0]).toBe('1-1')
    expect(ids[10]).toBe('2-1')
    expect(ids[49]).toBe('5-10')
  })
})

describe('previousWorld', () => {
  it('목록에서 한 칸 앞 월드를 돌려준다', () => {
    expect(previousWorld(6)).toBe(5)
  })

  it('첫 월드는 앞이 없다', () => {
    expect(previousWorld(1)).toBeUndefined()
  })
})

describe('worldUnlockStageId', () => {
  it('앞 월드의 보스 스테이지를 클리어해야 열린다', () => {
    expect(worldUnlockStageId(2)).toBe('1-10')
    expect(worldUnlockStageId(6)).toBe('5-10')
  })

  it('첫 월드는 처음부터 열려 있다', () => {
    expect(worldUnlockStageId(1)).toBeUndefined()
  })
})

describe('chapterUnlockStageId', () => {
  it('장의 첫 월드를 여는 스테이지와 같다', () => {
    expect(chapterUnlockStageId(2)).toBe('5-10')
  })

  it('첫 장은 처음부터 열려 있다', () => {
    expect(chapterUnlockStageId(1)).toBeUndefined()
  })
})

describe('currentWorldOf', () => {
  it('그 장에서 마지막으로 열린 월드를 돌려준다', () => {
    expect(currentWorldOf(cleared('1-10', '2-10'), 1)).toBe(3)
    expect(currentWorldOf(cleared('5-10', '6-10'), 2)).toBe(7)
  })

  it('장의 월드가 하나도 안 열렸으면 그 장의 첫 월드를 돌려준다', () => {
    expect(currentWorldOf(EMPTY_PROGRESS, 2)).toBe(6)
  })
})

describe('isBossStage', () => {
  it('월드의 열 번째 스테이지만 보스다', () => {
    expect(isBossStage('1-10')).toBe(true)
    expect(isBossStage('10-10')).toBe(true)
    expect(isBossStage('1-9')).toBe(false)
    expect(isBossStage('10-1')).toBe(false)
  })
})
