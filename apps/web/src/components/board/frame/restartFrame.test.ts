import { describe, expect, it } from 'vitest'

import { restartDrop, restartDuration, restartPhase } from './restartFrame'

describe('restartDrop', () => {
  it('진행도 0에서는 처음 자리보다 높이 떠 있다', () => {
    expect(restartDrop(0, 0, 2).lift).toBeGreaterThan(0)
  })

  it('진행도 1에서는 큐브와 상자가 모두 정확히 처음 자리에 있다', () => {
    for (const order of [0, 1, 2]) {
      expect(restartDrop(1, order, 2)).toEqual({ lift: 0, opacity: 1 })
    }
  })

  it('상자는 순서가 뒤일수록 늦게 내려오기 시작한다', () => {
    expect(restartDrop(0.3, 1, 2).lift).toBeGreaterThan(restartDrop(0.3, 0, 2).lift)
    expect(restartDrop(0.3, 2, 2).lift).toBeGreaterThan(restartDrop(0.3, 1, 2).lift)
  })

  it('내려오는 동안 높이가 계속 낮아지고 되올라가지 않는다', () => {
    let last = restartDrop(0, 0, 2).lift
    for (let t = 0.05; t <= 1; t += 0.05) {
      const lift = restartDrop(t, 0, 2).lift
      expect(lift).toBeLessThanOrEqual(last)
      last = lift
    }
  })

  it('상자가 많을수록 전체 시간이 길어진다', () => {
    expect(restartDuration(3)).toBeGreaterThan(restartDuration(0))
  })
})

describe('restartDrop 늦게 출발하는 단계', () => {
  it('상자가 많아도 늦출 단계가 두 번까지만 늘어난다', () => {
    expect(restartDuration(1)).toBeGreaterThan(restartDuration(0))
    expect(restartDuration(2)).toBeGreaterThan(restartDuration(1))
    expect(restartDuration(5)).toBe(restartDuration(2))
  })

  it('세 번째부터의 상자는 두 번째 상자와 같은 때 출발한다', () => {
    for (const t of [0.1, 0.4, 0.8]) {
      expect(restartDrop(t, 3, 5)).toEqual(restartDrop(t, 2, 5))
      expect(restartDrop(t, 5, 5)).toEqual(restartDrop(t, 2, 5))
    }
  })

  it('떨어지기 시작하자마자 또렷해져서 빈 자리처럼 보이지 않는다', () => {
    expect(restartDrop(0.1, 0, 0).opacity).toBeGreaterThan(0.5)
    expect(restartDrop(0.2, 0, 0).opacity).toBe(1)
  })
})

describe('restartPhase', () => {
  it('큐브가 내려앉는 것과 같은 감속으로 0에서 1까지', () => {
    expect(restartPhase(0, 2)).toBe(0)
    expect(restartPhase(1, 2)).toBe(1)
    expect(restartPhase(0.3, 2)).toBeCloseTo(
      1 - restartDrop(0.3, 0, 2).lift / restartDrop(0, 0, 2).lift,
    )
  })
})
