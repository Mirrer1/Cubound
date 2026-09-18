import { beforeEach, describe, expect, it } from 'vitest'

import { useGameStore } from './gameStore'

const store = () => useGameStore.getState()

describe('재시작 연출', () => {
  beforeEach(() => {
    store().play('1-3')
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
