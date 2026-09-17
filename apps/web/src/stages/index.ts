import type { Stage } from '@/game/types'

export const STAGES_PER_WORLD = 10

export const WORLDS = [{ number: 1, name: '낮은 계단의 땅' }]

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

export const stageIdsOf = (world: number) =>
  Array.from({ length: STAGES_PER_WORLD }, (_, i) => stageId(world, i + 1))

export const isBossStage = (id: string) => parseStageId(id).stage % STAGES_PER_WORLD === 0
