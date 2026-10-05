import { describe, expect, it } from 'vitest'

import {
  arrowGroups,
  fillGroup,
  followMarks,
  followNote,
  followStatus,
  groupAt,
  nextFollow,
  sessionKey,
  tracePath,
} from './follow'
import { createState, move } from '@/game/rules'
import type { Direction, Stage } from '@/game/types'

const STAGE: Stage = {
  version: 1,
  id: 'test-follow',
  heights: [[0, 0, 0, 0]],
  start: { x: 0, y: 0 },
  goal: { x: 3, y: 0 },
  entities: [],
}

const PATH: Direction[] = ['right', 'right', 'right']

const play = (directions: Direction[]) =>
  directions.reduce((state, direction) => move(state, direction).state, createState(STAGE))

describe('arrowGroups', () => {
  it('화살표를 다섯 개씩 묶고 순번을 함께 담는다', () => {
    const groups = arrowGroups(['up', 'right', 'down', 'left', 'up', 'right', 'down'])
    expect(groups.map((g) => g.map((a) => a.arrow).join(''))).toEqual(['↑→↓←↑', '→↓'])
    expect(groups[1].map((a) => a.index)).toEqual([5, 6])
  })

  it('빈 풀이는 빈 목록이다', () => {
    expect(arrowGroups([])).toEqual([])
  })
})

describe('tracePath', () => {
  it('처음 상태부터 수마다 상태 키를 담는다', () => {
    const trace = tracePath(STAGE, PATH)
    expect(trace).toHaveLength(4)
    expect(trace[0]).toBe(sessionKey(createState(STAGE)))
    expect(trace[2]).toBe(sessionKey(play(['right', 'right'])))
  })
})

describe('nextFollow', () => {
  const trace = tracePath(STAGE, PATH)

  it('처음 상태에서 첫 화살표를 가리킨다', () => {
    expect(nextFollow(null, trace, sessionKey(createState(STAGE)), 0)).toEqual({
      kind: 'on',
      at: 0,
    })
  })

  it('풀이대로 둔 수만큼 나아간다', () => {
    const state = play(['right', 'right'])
    expect(nextFollow({ kind: 'on', at: 1 }, trace, sessionKey(state), state.moves)).toEqual({
      kind: 'on',
      at: 2,
    })
  })

  it('풀이와 다른 수를 두면 그 자리에서 벗어난다', () => {
    const state = play(['right', 'left'])
    expect(nextFollow({ kind: 'on', at: 1 }, trace, sessionKey(state), state.moves)).toEqual({
      kind: 'off',
      at: 1,
    })
  })

  it('벗어난 뒤에는 풀이 상태로 돌아와도 멈춰 있다', () => {
    const state = play(['right', 'right'])
    expect(nextFollow({ kind: 'off', at: 1 }, trace, sessionKey(state), state.moves)).toEqual({
      kind: 'off',
      at: 1,
    })
  })

  it('재시작하면 처음부터 다시 따라간다', () => {
    const state = createState(STAGE)
    expect(nextFollow({ kind: 'off', at: 1 }, trace, sessionKey(state), 0)).toEqual({
      kind: 'on',
      at: 0,
    })
  })

  it('풀이에서 벗어난 이어하기 상태는 재시작을 기다린다', () => {
    const state = play(['right', 'left'])
    expect(nextFollow(null, trace, sessionKey(state), state.moves)).toEqual({
      kind: 'resume',
      at: 0,
    })
  })

  it('풀이 위에 있는 이어하기 상태는 그 자리부터 따라간다', () => {
    const state = play(['right'])
    expect(nextFollow(null, trace, sessionKey(state), state.moves)).toEqual({ kind: 'on', at: 1 })
  })
})

describe('followMarks', () => {
  it('따라가는 중에는 지난 칸, 다음 칸, 남은 칸으로 나눈다', () => {
    expect(followMarks(4, { kind: 'on', at: 1 })).toEqual(['done', 'next', 'todo', 'todo'])
  })

  it('벗어나면 그 칸을 벗어난 칸으로 표시한다', () => {
    expect(followMarks(3, { kind: 'off', at: 2 })).toEqual(['done', 'done', 'off'])
  })

  it('이어하기를 기다리는 동안은 모두 남은 칸이다', () => {
    expect(followMarks(2, { kind: 'resume', at: 0 })).toEqual(['todo', 'todo'])
  })

  it('끝까지 따라가면 모두 지난 칸이다', () => {
    expect(followMarks(2, { kind: 'on', at: 2 })).toEqual(['done', 'done'])
  })
})

describe('groupAt', () => {
  it('다음 화살표가 든 묶음을 고른다', () => {
    expect(groupAt({ kind: 'on', at: 0 }, 12)).toBe(0)
    expect(groupAt({ kind: 'on', at: 4 }, 12)).toBe(0)
    expect(groupAt({ kind: 'on', at: 5 }, 12)).toBe(1)
  })

  it('벗어나면 벗어난 화살표가 든 묶음을 고른다', () => {
    expect(groupAt({ kind: 'off', at: 7 }, 12)).toBe(1)
  })

  it('끝까지 따라가면 마지막 묶음에 머문다', () => {
    expect(groupAt({ kind: 'on', at: 12 }, 12)).toBe(2)
    expect(groupAt({ kind: 'on', at: 10 }, 10)).toBe(1)
  })

  it('이어하기를 기다리거나 아직 모르면 첫 묶음이다', () => {
    expect(groupAt({ kind: 'resume', at: 0 }, 12)).toBe(0)
    expect(groupAt(null, 12)).toBe(0)
  })
})

describe('followStatus', () => {
  const solved = { status: 'solved' as const, moves: 12, path: [] }

  it('풀이를 못 구하면 그 까닭을 적는다', () => {
    expect(followStatus({ status: 'limit' }, null)).toBe('풀이 못 구함: 탐색 상한')
    expect(followStatus({ status: 'unsolvable' }, null)).toBe('풀이 없음')
  })

  it('둔 수를 최단 수의 자릿수에 맞춰 적는다', () => {
    expect(followStatus(solved, { kind: 'on', at: 3 })).toBe(' 3/12')
    expect(followStatus(solved, { kind: 'on', at: 10 })).toBe('10/12')
    expect(followStatus(solved, null)).toBe(' 0/12')
  })

  it('벗어나면 벗어난 자리까지 둔 수를 적는다', () => {
    expect(followStatus(solved, { kind: 'off', at: 4 })).toBe(' 4/12')
  })
})

describe('followNote', () => {
  it('벗어나거나 이어하기면 재시작을 안내한다', () => {
    expect(followNote({ kind: 'off', at: 1 })).toBe('풀이에서 벗어남, ↺로 다시')
    expect(followNote({ kind: 'resume', at: 0 })).toBe('↺ 누르면 따라가기 시작')
  })

  it('따라가는 중이면 안내가 없다', () => {
    expect(followNote({ kind: 'on', at: 1 })).toBeNull()
    expect(followNote(null)).toBeNull()
  })
})

describe('fillGroup', () => {
  it('모자란 묶음을 빈칸으로 채워 다섯 칸을 만든다', () => {
    const [group] = arrowGroups(['up', 'left'])
    expect(fillGroup(group).map((a) => a?.arrow ?? null)).toEqual(['↑', '←', null, null, null])
  })

  it('없는 묶음은 다섯 칸 모두 빈칸이다', () => {
    expect(fillGroup(undefined)).toEqual([null, null, null, null, null])
  })
})
