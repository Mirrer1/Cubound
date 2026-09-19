import { describe, expect, it } from 'vitest'

import { createState, move } from './rules'
import { SESSION_VERSION, restoreSession, toSession } from './session'
import type { Stage } from './types'

const STAGE: Stage = {
  version: 1,
  id: '1-3',
  heights: [
    [0, 0, 0],
    [0, -1, 1],
  ],
  start: { x: 0, y: 0 },
  goal: { x: 2, y: 1 },
  entities: [{ type: 'box', x: 1, y: 0 }],
}

const MID = {
  heights: STAGE.heights,
  boxes: [{ x: 2, y: 0 }],
  ladders: [],
  leaningLadders: [],
  raisedLifts: [],
  carrying: false,
  player: { x: 1, y: 0 },
  moves: 1,
}

const saved = (state: object) => ({ version: SESSION_VERSION, stageId: '1-3', ...state })

describe('toSession', () => {
  it('스테이지 데이터 없이 중간 상태만 담는다', () => {
    const state = move(createState(STAGE), 'right').state

    expect(toSession(state)).toEqual(saved(MID))
  })
})

describe('restoreSession', () => {
  it('저장한 상태를 그대로 이어서 시작한다', () => {
    const state = move(createState(STAGE), 'right').state

    expect(restoreSession(toSession(state), STAGE)).toEqual(state)
  })

  it('저장된 것이 없거나 깨졌으면 null이다', () => {
    expect(restoreSession(undefined, STAGE)).toBeNull()
    expect(restoreSession(null, STAGE)).toBeNull()
    expect(restoreSession('깨진 값', STAGE)).toBeNull()
  })

  it('버전이 다르면 버린다', () => {
    expect(restoreSession({ ...saved(MID), version: 99 }, STAGE)).toBeNull()
  })

  it('다른 스테이지의 기록이면 버린다', () => {
    expect(restoreSession({ ...saved(MID), stageId: '1-4' }, STAGE)).toBeNull()
  })

  it('맵 크기가 달라졌으면 버린다', () => {
    expect(restoreSession(saved({ ...MID, heights: [[0, 0, 0]] }), STAGE)).toBeNull()
  })

  it('큐브가 맵 밖이면 버린다', () => {
    expect(restoreSession(saved({ ...MID, player: { x: 9, y: 0 } }), STAGE)).toBeNull()
  })

  it('큐브가 바닥 없는 칸이면 버린다', () => {
    expect(restoreSession(saved({ ...MID, player: { x: 1, y: 1 } }), STAGE)).toBeNull()
  })

  it('상자로 메운 칸은 인정하고 그 위에 선 것도 이어간다', () => {
    const filled = [
      [0, 0, 0],
      [0, 0, 1],
    ]
    const session = saved({ ...MID, heights: filled, boxes: [], player: { x: 1, y: 1 } })

    expect(restoreSession(session, STAGE)?.player).toEqual({ x: 1, y: 1 })
  })

  it('메운 칸이 아닌데 높이가 다르면 버린다', () => {
    const changed = [
      [0, 0, 3],
      [0, -1, 1],
    ]
    expect(restoreSession(saved({ ...MID, heights: changed }), STAGE)).toBeNull()
  })

  it('상자가 스테이지보다 많으면 버린다', () => {
    const many = [
      { x: 2, y: 0 },
      { x: 0, y: 1 },
    ]
    expect(restoreSession(saved({ ...MID, boxes: many }), STAGE)).toBeNull()
  })

  it('상자가 바닥 없는 칸에 있으면 버린다', () => {
    expect(restoreSession(saved({ ...MID, boxes: [{ x: 1, y: 1 }] }), STAGE)).toBeNull()
  })

  it('사다리가 스테이지보다 많으면 버린다', () => {
    expect(restoreSession(saved({ ...MID, ladders: [{ x: 0, y: 1 }] }), STAGE)).toBeNull()
  })

  it('이동 수가 음수이거나 정수가 아니면 버린다', () => {
    expect(restoreSession(saved({ ...MID, moves: -1 }), STAGE)).toBeNull()
    expect(restoreSession(saved({ ...MID, moves: 1.5 }), STAGE)).toBeNull()
  })

  it('이어서 시작한 상태는 클리어 전이다', () => {
    expect(restoreSession(saved(MID), STAGE)?.cleared).toBe(false)
  })
})

const LIFT_STAGE: Stage = {
  version: 1,
  id: '2-9',
  heights: [[0, 0, 0]],
  start: { x: 0, y: 0 },
  goal: { x: 2, y: 0 },
  entities: [{ type: 'switch', x: 1, y: 0, target: 'a' }],
}

describe('restoreSession 발판', () => {
  it('올라가 있던 발판을 그대로 이어간다', () => {
    const stage: Stage = {
      ...LIFT_STAGE,
      heights: [[0, 0, 0, 0]],
      goal: { x: 3, y: 0 },
      entities: [...LIFT_STAGE.entities, { type: 'lift', x: 2, y: 0, id: 'a' }],
    }
    const state = move(createState(stage), 'right').state

    expect(state.raisedLifts).toEqual(['a'])
    expect(restoreSession(toSession(state), stage)).toEqual(state)
  })

  it('스테이지에 없는 발판 id가 담겨 있으면 버린다', () => {
    expect(restoreSession(saved({ ...MID, raisedLifts: ['a'] }), STAGE)).toBeNull()
  })
})
