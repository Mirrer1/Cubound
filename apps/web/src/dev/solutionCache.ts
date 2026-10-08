import { stateAt } from './playback'
import type { SolveResult } from '@/game/solver'
import type { Direction, Stage } from '@/game/types'

export interface SolutionEntry {
  hash: string
  path?: Direction[] // 풀이를 못 구한 판은 비어 있음
}

// 파싱한 판의 FNV-1a 32비트, 개발 서버 쪽과 화면 쪽이 같은 값을 내는 기준
export const stageHash = (stage: Stage) => {
  let hash = 0x811c9dc5
  for (const c of JSON.stringify(stage)) {
    hash ^= c.codePointAt(0)!
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

// 해시가 같고 재생해 집에 닿고 수가 best와 같은 저장된 풀이만 사용
export const pickSolution = (
  stage: Stage,
  entry: SolutionEntry | undefined,
): SolveResult | null => {
  const path = entry?.path
  if (!path || entry.hash !== stageHash(stage)) return null
  if (!stateAt(stage, path, path.length).cleared) return null
  if (stage.best !== undefined && path.length !== stage.best) return null
  return { status: 'solved', moves: path.length, path }
}
