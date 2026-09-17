import { stars } from './solver'

export interface StageRecord {
  bestMoves: number
  stars: number
}

export const PROGRESS_VERSION = 1

export interface Progress {
  version: typeof PROGRESS_VERSION
  stages: Record<string, StageRecord>
}

export const EMPTY_PROGRESS: Progress = { version: PROGRESS_VERSION, stages: {} }

const isRecord = (value: unknown): value is StageRecord =>
  typeof value === 'object' &&
  value !== null &&
  Number.isInteger((value as StageRecord).bestMoves) &&
  Number.isInteger((value as StageRecord).stars)

// 저장된 값을 현재 버전으로 읽는다. 버전이 오르면 여기에 옮기는 단계를 추가한다
export const migrateProgress = (saved: unknown): Progress => {
  if (typeof saved !== 'object' || saved === null) return EMPTY_PROGRESS

  const { version = PROGRESS_VERSION, stages } = saved as { version?: unknown; stages?: unknown }
  if (version !== PROGRESS_VERSION || typeof stages !== 'object' || stages === null) {
    return EMPTY_PROGRESS
  }

  return {
    version: PROGRESS_VERSION,
    stages: Object.fromEntries(Object.entries(stages).filter(([, record]) => isRecord(record))),
  }
}

// 더 좋은 기록일 때만 갱신한다
export const recordClear = (
  progress: Progress,
  stageId: string,
  moves: number,
  best: number,
): Progress => {
  const previous = progress.stages[stageId]
  const record = { bestMoves: moves, stars: stars(moves, best) }
  if (previous && previous.bestMoves <= moves) return progress

  return { ...progress, stages: { ...progress.stages, [stageId]: record } }
}

// 첫 스테이지이거나 앞 스테이지를 클리어했으면 열림
export const isUnlocked = (progress: Progress, stageIds: string[], stageId: string) => {
  const index = stageIds.indexOf(stageId)
  return index === 0 || (index > 0 && stageIds[index - 1] in progress.stages)
}

export const totalStars = (progress: Progress, stageIds: string[]) =>
  stageIds.reduce((sum, id) => sum + (progress.stages[id]?.stars ?? 0), 0)
