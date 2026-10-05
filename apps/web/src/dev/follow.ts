import { createState, move } from '@/game/rules'
import { toSession } from '@/game/session'
import type { SolveResult } from '@/game/solver'
import type { Direction, GameState, Stage } from '@/game/types'

const ARROWS: Record<Direction, string> = { up: '↑', right: '→', down: '↓', left: '←' }
const GROUP = 5

export type Follow = { kind: 'on' | 'off' | 'resume'; at: number } // at은 다음 화살표, off는 벗어난 화살표
export type FollowMark = 'done' | 'next' | 'todo' | 'off'

export const sessionKey = (state: GameState) => JSON.stringify(toSession(state))

export const arrowGroups = (path: Direction[]) =>
  Array.from({ length: Math.ceil(path.length / GROUP) }, (_, g) =>
    path
      .slice(g * GROUP, (g + 1) * GROUP)
      .map((direction, i) => ({ arrow: ARROWS[direction], index: g * GROUP + i })),
  )

// 마지막 묶음도 띠 폭이 같은 다섯 칸, 빈칸은 null
export const fillGroup = (group: ReturnType<typeof arrowGroups>[number] | undefined) =>
  Array.from({ length: GROUP }, (_, i) => group?.[i] ?? null)

// 처음 상태부터 풀이의 수마다 남긴 상태 키
export const tracePath = (stage: Stage, path: Direction[]) => {
  const states = [createState(stage)]
  for (const direction of path) states.push(move(states[states.length - 1], direction).state)
  return states.map(sessionKey)
}

// 방향 대신 상태로 맞추는 따라가기, prev가 null이면 판에 들어와 처음 보는 상태
export const nextFollow = (
  prev: Follow | null,
  trace: string[],
  key: string,
  moves: number,
): Follow => {
  if (moves === 0) return { kind: 'on', at: 0 }
  if (prev && prev.kind !== 'on') return prev
  if (trace[moves] === key) return { kind: 'on', at: moves }
  return prev ? { kind: 'off', at: prev.at } : { kind: 'resume', at: 0 }
}

export const followMarks = (length: number, follow: Follow): FollowMark[] =>
  Array.from({ length }, (_, i) => {
    if (follow.kind === 'resume' || i > follow.at) return 'todo'
    if (i < follow.at) return 'done'
    return follow.kind === 'off' ? 'off' : 'next'
  })

// 보여 줄 묶음 번호, 다음 화살표나 벗어난 화살표가 든 묶음
export const groupAt = (follow: Follow | null, length: number) =>
  follow && follow.kind !== 'resume' ? Math.floor(Math.min(follow.at, length - 1) / GROUP) : 0

// 자릿수가 늘어도 폭이 같은 수, 앞을 채우는 숫자 폭 공백
export const followStatus = (result: SolveResult, follow: Follow | null) => {
  if (result.status === 'limit') return '풀이 못 구함: 탐색 상한'
  if (result.status === 'unsolvable') return '풀이 없음'
  const total = String(result.moves)
  return `${String(follow?.at ?? 0).padStart(total.length, ' ')}/${total}`
}

export const followNote = (follow: Follow | null) => {
  if (follow?.kind === 'off') return '풀이에서 벗어남, ↺로 다시'
  if (follow?.kind === 'resume') return '↺ 누르면 따라가기 시작'
  return null
}
