import { type Progress, isWorldUnlocked } from '@/game/progress'
import type { Direction, Stage } from '@/game/types'

export const STAGES_PER_WORLD = 10
export const WORLDS_PER_CYCLE = 5

const modules = import.meta.glob<Stage>('./world-*/*.json', { eager: true, import: 'default' })

// 개발 서버에서만 여는 화면 확인용 판, 테스트 제외, script는 개발용 컨트롤러가 재생하는 수순
export const DEV_STAGES: Record<string, Stage & { script: Direction[] }> =
  import.meta.env.DEV && import.meta.env.MODE !== 'test'
    ? Object.fromEntries(
        Object.values(
          import.meta.glob<Stage & { script: Direction[] }>('./dev/*.json', {
            eager: true,
            import: 'default',
          }),
        ).map((stage) => [stage.id, stage]),
      )
    : {}

// "1-3" 같은 id에서 나눈 월드 번호와 스테이지 번호
export const parseStageId = (id: string) => {
  const [world, stage] = id.split('-').map(Number)
  return { world, stage }
}

export const stageId = (world: number, stage: number) => `${world}-${stage}`

export const STAGES: Record<string, Stage> = {
  ...Object.fromEntries(Object.values(modules).map((stage) => [stage.id, stage])),
  ...DEV_STAGES,
}

export const WORLDS = [...new Set(Object.keys(STAGES).map((id) => parseStageId(id).world))].sort(
  (a, b) => a - b,
)

// 아직 만들지 않은 스테이지를 뺀 번호순 목록, 화면 확인용 판은 끝
export const stageIdsOf = (world: number) => [
  ...Array.from({ length: STAGES_PER_WORLD }, (_, i) => stageId(world, i + 1)).filter(
    (id) => id in STAGES,
  ),
  ...Object.keys(DEV_STAGES).filter((id) => parseStageId(id).world === world),
]

export const isBossStage = (id: string) => parseStageId(id).stage % STAGES_PER_WORLD === 0

// 세계 색이 갈리는 단위, 월드 다섯이 한 사이클, 화면 이름은 CHAPTER
export const cycleOf = (world: number) => Math.ceil(world / WORLDS_PER_CYCLE)

export const CHAPTERS = [...new Set(WORLDS.map(cycleOf))].sort((a, b) => a - b)

export const worldsOf = (chapter: number) => WORLDS.filter((world) => cycleOf(world) === chapter)

export const chapterStageIds = (chapter: number) => worldsOf(chapter).flatMap(stageIdsOf)

// 장이 열리는 조건, 그 장의 첫 월드가 열릴 때
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

// 목록에서 한 칸 앞 월드, 첫 월드는 undefined
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

// 그 장에서 마지막으로 열린 월드, 장을 고르면 가는 자리
export const currentWorldOf = (progress: Progress, chapter: number) => {
  const worlds = worldsOf(chapter)
  return (
    worlds.findLast((world) => isWorldUnlocked(progress, worldUnlockStageId(world))) ?? worlds[0]
  )
}
