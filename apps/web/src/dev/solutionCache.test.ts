import { describe, expect, it } from 'vitest'

import { pickSolution, stageHash } from './solutionCache'
import type { Direction, Stage } from '@/game/types'

const STAGE: Stage = {
  version: 1,
  id: 'test-cache',
  heights: [[0, 0, 0, 0]],
  start: { x: 0, y: 0 },
  goal: { x: 3, y: 0 },
  entities: [],
  best: 3,
}

const PATH: Direction[] = ['right', 'right', 'right']

describe('stageHash', () => {
  it('같은 판은 같은 해시다', () => {
    expect(stageHash(STAGE)).toBe(stageHash(JSON.parse(JSON.stringify(STAGE))))
  })

  it('판 내용이 바뀌면 해시도 바뀐다', () => {
    expect(stageHash({ ...STAGE, goal: { x: 2, y: 0 } })).not.toBe(stageHash(STAGE))
  })

  it('파일 글의 공백과 줄바꿈은 해시에 무관하다', () => {
    const text = JSON.stringify(STAGE, null, 2)
    expect(stageHash(JSON.parse(text))).toBe(stageHash(STAGE))
  })

  it('8자리 16진수다', () => {
    expect(stageHash(STAGE)).toMatch(/^[0-9a-f]{8}$/)
  })
})

describe('pickSolution', () => {
  const entry = { hash: stageHash(STAGE), path: PATH }

  it('해시가 같고 집에 닿고 best와 길이가 같으면 풀이로 쓴다', () => {
    expect(pickSolution(STAGE, entry)).toEqual({ status: 'solved', moves: 3, path: PATH })
  })

  it('저장된 풀이가 없으면 쓰지 않는다', () => {
    expect(pickSolution(STAGE, undefined)).toBeNull()
  })

  it('해시가 다르면 쓰지 않는다', () => {
    expect(pickSolution(STAGE, { ...entry, hash: '00000000' })).toBeNull()
  })

  it('재생해 집에 닿지 않으면 쓰지 않는다', () => {
    expect(pickSolution(STAGE, { ...entry, path: ['right', 'right'] })).toBeNull()
  })

  it('수가 best와 다르면 쓰지 않는다', () => {
    const stage = { ...STAGE, best: 4 }
    expect(pickSolution(stage, { hash: stageHash(stage), path: PATH })).toBeNull()
  })

  it('풀이를 못 구한 결과는 쓰지 않는다', () => {
    expect(pickSolution(STAGE, { hash: entry.hash })).toBeNull()
  })
})
