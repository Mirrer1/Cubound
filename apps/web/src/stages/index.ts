import { type Progress, isWorldUnlocked } from '@/game/progress'
import type { Stage } from '@/game/types'

export const STAGES_PER_WORLD = 10
export const WORLDS_PER_CYCLE = 5

const modules = import.meta.glob<Stage>('./world-*/*.json', { eager: true, import: 'default' })

// "1-3" 같은 id를 월드 번호와 스테이지 번호로 나눈다
export const parseStageId = (id: string) => {
  const [world, stage] = id.split('-').map(Number)
  return { world, stage }
}

export const stageId = (world: number, stage: number) => `${world}-${stage}`

export const STAGES: Record<string, Stage> = Object.fromEntries(
  Object.values(modules).map((stage) => [stage.id, stage]),
)

export const WORLDS = [...new Set(Object.keys(STAGES).map((id) => parseStageId(id).world))].sort(
  (a, b) => a - b,
)

// 아직 만들지 않은 스테이지는 빼고 번호순으로 돌려준다
export const stageIdsOf = (world: number) =>
  Array.from({ length: STAGES_PER_WORLD }, (_, i) => stageId(world, i + 1)).filter(
    (id) => id in STAGES,
  )

export const isBossStage = (id: string) => parseStageId(id).stage % STAGES_PER_WORLD === 0

// 세계 색이 갈리는 단위. 월드 다섯이 한 사이클이고 화면에서는 CHAPTER라 부른다
export const cycleOf = (world: number) => Math.ceil(world / WORLDS_PER_CYCLE)

export const CHAPTERS = [...new Set(WORLDS.map(cycleOf))].sort((a, b) => a - b)

export const worldsOf = (chapter: number) => WORLDS.filter((world) => cycleOf(world) === chapter)

export const chapterStageIds = (chapter: number) => worldsOf(chapter).flatMap(stageIdsOf)

// 장은 그 장의 첫 월드가 열리면 열린다
export const chapterUnlockStageId = (chapter: number) => worldUnlockStageId(worldsOf(chapter)[0])

// 월드에서 마지막으로 만든 스테이지 다음은 다음 월드의 첫 스테이지
export const nextStageId = (id: string) => {
  const { world } = parseStageId(id)
  const ids = stageIdsOf(world)
  const index = ids.indexOf(id)
  if (index < 0) return undefined
  if (index + 1 < ids.length) return ids[index + 1]

  const next = WORLDS[WORLDS.indexOf(world) + 1]
  return next === undefined ? undefined : stageIdsOf(next)[0]
}

// 목록에서 한 칸 앞 월드. 첫 월드는 앞이 없다
export const previousWorld = (world: number): number | undefined =>
  WORLDS[WORLDS.indexOf(world) - 1]

// 이 월드를 열려면 클리어해야 하는 스테이지
export const worldUnlockStageId = (world: number) => {
  const previous = previousWorld(world)
  return previous === undefined ? undefined : stageId(previous, STAGES_PER_WORLD)
}

// 열려 있는 월드 중 마지막 월드
export const currentWorld = (progress: Progress) =>
  WORLDS.findLast((world) => isWorldUnlocked(progress, worldUnlockStageId(world))) ?? WORLDS[0]

// 그 장에서 마지막으로 열린 월드. 장을 고르면 여기로 간다
export const currentWorldOf = (progress: Progress, chapter: number) => {
  const worlds = worldsOf(chapter)
  return (
    worlds.findLast((world) => isWorldUnlocked(progress, worldUnlockStageId(world))) ?? worlds[0]
  )
}
