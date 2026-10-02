import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { queueInput, useGameStore } from './gameStore'
import { createState, move } from '@/game/rules'
import { toSession } from '@/game/session'
import type { Direction, GameEvent } from '@/game/types'
import { STAGES } from '@/stages'

const store = () => useGameStore.getState()

describe('재시작 연출', () => {
  beforeEach(() => {
    store().enter('1-3')
    store().closeGuide()
  })

  it('스테이지를 처음 열 때는 연출 없이 시작한다', () => {
    expect(store().restarting).toBe(false)
  })

  it('재시작하면 연출이 켜지고 이전 상태를 남겨 스위치와 문이 이어진다', () => {
    store().move('up')
    store().finishAnimation()
    const moved = store().game

    store().restart()

    expect(store().restarting).toBe(true)
    expect(store().prevGame).toBe(moved)
    expect(store().game?.moves).toBe(0)
  })

  it('연출 중에는 방향키 입력이 무시된다', () => {
    store().restart()
    store().move('up')

    expect(store().game?.moves).toBe(0)
    expect(store().queue).toEqual([])
  })

  it('연출 중에 다시 재시작하면 기다리지 않고 처음부터 다시 돈다', () => {
    store().restart()
    const turn = store().turn

    store().restart()

    expect(store().turn).toBe(turn + 1)
    expect(store().restarting).toBe(true)
  })

  it('연출이 끝나면 다시 움직일 수 있다', () => {
    store().restart()
    store().finishAnimation()

    expect(store().restarting).toBe(false)
    store().move('up')
    expect(store().game?.moves).toBe(1)
  })
})

describe('queueInput', () => {
  const moved: GameEvent = { type: 'moved', from: { x: 0, y: 0 }, to: { x: 1, y: 0 } }

  it('바람이 불지 않은 수의 연출 중 입력은 대기열에 하나까지 넣는다', () => {
    expect(queueInput([], 'up', [moved])).toEqual(['up'])
    expect(queueInput(['up'], 'down', [moved])).toEqual(['up'])
  })

  it('바람에 밀린 수의 연출 중 입력은 버리고 버틴 수는 받는다', () => {
    const blown: GameEvent[] = [
      moved,
      { type: 'blown', from: { x: 1, y: 0 }, to: { x: 0, y: 0 }, direction: 'left' },
      { type: 'moved', from: { x: 1, y: 0 }, to: { x: 0, y: 0 } },
    ]
    const braced: GameEvent[] = [moved, { type: 'braced', direction: 'left' }]

    expect(queueInput([], 'up', blown)).toEqual([])
    expect(queueInput([], 'up', braced)).toEqual(['up'])
  })
})

// 브라우저 localStorage를 쓰는 저장소, 테스트마다 빈 것으로 교체
const fakeStorage = () => {
  const items = new Map<string, string>()
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key),
  }
}

describe('enter', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', fakeStorage())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('중간 상태가 없으면 처음부터 시작하고 가이드를 띄운다', () => {
    store().enter('1-1')

    expect(store().game?.moves).toBe(0)
    expect(store().guideStep).toBe(0)
  })

  it('중간 상태가 남아 있으면 이어서 시작하고 가이드를 띄우지 않는다', () => {
    const saved = move(createState(STAGES['1-1']), 'up').state
    localStorage.setItem('cubound:session', JSON.stringify(toSession(saved)))

    store().enter('1-1')

    expect(store().game?.moves).toBe(1)
    expect(store().guideStep).toBeNull()
  })
})

describe('move 클리어 기록', () => {
  const SOLUTION: Direction[] = ['up', 'up', 'right', 'right', 'right', 'down', 'down', 'left']

  beforeEach(() => {
    vi.stubGlobal('localStorage', fakeStorage())
    store().enter('1-1')
    store().closeGuide()
    for (const direction of SOLUTION) {
      store().move(direction)
      store().finishAnimation()
    }
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('클리어하면 기록을 남긴다', () => {
    expect(store().game?.cleared).toBe(true)
    expect(store().progress.stages['1-1']).toEqual({ bestMoves: 8, stars: 3 })
  })

  it('이미 클리어한 판에서 누른 입력은 기록을 다시 쓰지 않는다', () => {
    const progress = store().progress
    const turn = store().turn

    store().move('left')

    expect(store().progress).toBe(progress)
    expect(store().turn).toBe(turn)
  })
})
