import { describe, expect, it } from 'vitest'

import { heightWarnings } from './heightCheck'

describe('heightWarnings', () => {
  it('높이 차가 작은 판은 알림이 없고 구덩이는 견주지 않는다', () => {
    expect(
      heightWarnings([
        [0, 1, 2, 5],
        [-1, 2, 3, 5],
      ]),
    ).toEqual([])
  })

  it('가장 높은 칸과 가장 낮은 칸의 차가 5층을 넘으면 알린다', () => {
    expect(
      heightWarnings([
        [0, 3, 6],
        [0, 3, 6],
      ]),
    ).toEqual(['높이 차 6층 (가장 높은 칸 6, 가장 낮은 칸 0)'])
  })

  it('옆 칸끼리 차가 3층을 넘으면 가장 큰 곳과 곳 수를 알린다', () => {
    expect(
      heightWarnings([
        [0, 4, 0],
        [0, 0, 0],
      ]),
    ).toEqual(['옆 칸 높이 차 4층 (0,0)-(1,0) 외 2곳'])
    expect(heightWarnings([[1, 5, 0]])).toEqual(['옆 칸 높이 차 5층 (1,0)-(2,0) 외 1곳'])
    expect(heightWarnings([[0, 4]])).toEqual(['옆 칸 높이 차 4층 (0,0)-(1,0)'])
  })
})
