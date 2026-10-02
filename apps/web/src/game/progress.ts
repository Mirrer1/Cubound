import { stars } from './solver'
import type { Stage } from './types'

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

// 저장된 값을 현재 버전으로 읽는 곳, 버전이 오르면 옮기는 단계를 더할 자리
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

// 더 좋은 기록일 때만 하는 갱신
export const recordClear = (
  progress: Progress,
  stageId: string,
  moves: number,
  best: number,
  limit?: number,
): Progress => {
  const previous = progress.stages[stageId]
  const record = { bestMoves: moves, stars: stars(moves, best, limit) }
  if (previous && previous.bestMoves <= moves) return progress

  return { ...progress, stages: { ...progress.stages, [stageId]: record } }
}

// 열리는 경우, 첫 스테이지이거나 앞 스테이지를 클리어했을 때
export const isUnlocked = (progress: Progress, stageIds: string[], stageId: string) => {
  const index = stageIds.indexOf(stageId)
  return index === 0 || (index > 0 && stageIds[index - 1] in progress.stages)
}

// 월드가 열리는 조건은 앞 월드의 마지막 스테이지 클리어, 첫 월드는 예외
export const isWorldUnlocked = (progress: Progress, unlockStageId?: string) =>
  unlockStageId === undefined || unlockStageId in progress.stages

// 가이드를 자동으로 띄우는 스테이지, 클리어 기록이 없고 가이드가 있는 판
export const shouldShowGuide = (stage: Stage, progress: Progress) =>
  (stage.guides?.length ?? 0) > 0 && !(stage.id in progress.stages)

export const totalStars = (progress: Progress, stageIds: string[]) =>
  stageIds.reduce((sum, id) => sum + (progress.stages[id]?.stars ?? 0), 0)
