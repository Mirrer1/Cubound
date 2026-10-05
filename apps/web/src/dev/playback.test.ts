import { describe, expect, it } from 'vitest'

import { backTarget, controlsOf, nextMove, playStops, stateAt } from './playback'
import { createState, move } from '@/game/rules'
import type { Direction, Stage } from '@/game/types'

const STAGE: Stage = {
  version: 1,
  id: 'test-playback',
  heights: [[0, 0, 0, 0]],
  start: { x: 0, y: 0 },
  goal: { x: 3, y: 0 },
  entities: [],
}

const PATH: Direction[] = ['right', 'right', 'right']

const RUNNING = {
  follow: { kind: 'on' as const, at: 1 },
  length: 3,
  expect: 1,
  moves: 1,
  restarting: false,
  guideOpen: false,
  cleared: false,
  collapsed: false,
}

describe('stateAt', () => {
  it('처음 상태에서 풀이를 n수 적용한 상태를 만든다', () => {
    const state = stateAt(STAGE, PATH, 2)
    expect(state.player).toEqual({ x: 2, y: 0 })
    expect(state.moves).toBe(2)
  })

  it('0수는 처음 상태다', () => {
    expect(stateAt(STAGE, PATH, 0)).toEqual(createState(STAGE))
  })

  it('한 수씩 둔 상태와 같다', () => {
    const played = move(move(createState(STAGE), 'right').state, 'right').state
    expect(stateAt(STAGE, PATH, 2)).toEqual(played)
  })
})

describe('backTarget', () => {
  it('풀이 위에서는 한 수 전이다', () => {
    expect(backTarget({ kind: 'on', at: 2 })).toBe(1)
  })

  it('0수에서는 갈 곳이 없다', () => {
    expect(backTarget({ kind: 'on', at: 0 })).toBeNull()
  })

  it('벗어났으면 마지막으로 풀이 위에 있던 수다', () => {
    expect(backTarget({ kind: 'off', at: 2 })).toBe(2)
    expect(backTarget({ kind: 'off', at: 0 })).toBe(0)
  })

  it('이어하기를 기다리거나 아직 모르면 갈 곳이 없다', () => {
    expect(backTarget({ kind: 'resume', at: 0 })).toBeNull()
    expect(backTarget(null)).toBeNull()
  })
})

describe('nextMove', () => {
  it('풀이 위에서는 다음 화살표다', () => {
    expect(nextMove(['up', 'left'], { kind: 'on', at: 1 })).toBe('left')
  })

  it('풀이 끝이나 벗어난 상태에서는 없다', () => {
    expect(nextMove(['up', 'left'], { kind: 'on', at: 2 })).toBeNull()
    expect(nextMove(['up', 'left'], { kind: 'off', at: 1 })).toBeNull()
    expect(nextMove(['up', 'left'], null)).toBeNull()
  })
})

describe('controlsOf', () => {
  it('풀이 가운데에서는 셋 다 켜진다', () => {
    expect(controlsOf(PATH, { kind: 'on', at: 1 })).toEqual({
      back: true,
      play: true,
      forward: true,
    })
  })

  it('0수에서는 뒤로만 꺼진다', () => {
    expect(controlsOf(PATH, { kind: 'on', at: 0 })).toEqual({
      back: false,
      play: true,
      forward: true,
    })
  })

  it('풀이 끝에서는 뒤로만 켜진다', () => {
    expect(controlsOf(PATH, { kind: 'on', at: 3 })).toEqual({
      back: true,
      play: false,
      forward: false,
    })
  })

  it('벗어나면 뒤로만 켜진다', () => {
    expect(controlsOf(PATH, { kind: 'off', at: 1 })).toEqual({
      back: true,
      play: false,
      forward: false,
    })
  })

  it('이어하기를 기다리면 다 꺼진다', () => {
    expect(controlsOf(PATH, { kind: 'resume', at: 0 })).toEqual({
      back: false,
      play: false,
      forward: false,
    })
  })
})

describe('playStops', () => {
  it('재생이 누른 수 그대로 풀이 위에 있으면 이어간다', () => {
    expect(playStops(RUNNING)).toBe(false)
  })

  it('사용자가 직접 두거나 되돌려 수가 어긋나면 멈춘다', () => {
    expect(playStops({ ...RUNNING, moves: 2 })).toBe(true)
    expect(playStops({ ...RUNNING, moves: 0 })).toBe(true)
  })

  it('재시작, 가이드, 클리어, 접힘에서 멈춘다', () => {
    expect(playStops({ ...RUNNING, restarting: true })).toBe(true)
    expect(playStops({ ...RUNNING, guideOpen: true })).toBe(true)
    expect(playStops({ ...RUNNING, cleared: true })).toBe(true)
    expect(playStops({ ...RUNNING, collapsed: true })).toBe(true)
  })

  it('풀이에서 벗어나거나 풀이 끝이면 멈춘다', () => {
    expect(playStops({ ...RUNNING, follow: { kind: 'off', at: 1 } })).toBe(true)
    expect(playStops({ ...RUNNING, follow: { kind: 'on', at: 3 }, expect: 3, moves: 3 })).toBe(true)
    expect(playStops({ ...RUNNING, follow: null })).toBe(true)
  })
})
