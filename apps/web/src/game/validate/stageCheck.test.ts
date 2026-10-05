import { describe, expect, it } from 'vitest'

import { validateStage } from './index'
import { VALID, errorsOf } from './testStages'

describe('validateStage', () => {
  it('올바른 스테이지는 통과하고 그대로 돌려준다', () => {
    const result = validateStage(VALID)

    expect(result.ok).toBe(true)
    expect(result.ok && result.stage.id).toBe('1-3')
  })

  it('객체가 아니면 실패한다', () => {
    expect(errorsOf(null)).toEqual(['스테이지가 객체가 아니다'])
    expect(errorsOf('stage')).toEqual(['스테이지가 객체가 아니다'])
  })
})

describe('stageContext', () => {
  it('name은 없어도 되고 문자열이 아니면 실패한다', () => {
    expect(errorsOf({ ...VALID, name: undefined })).toEqual([])
    expect(errorsOf({ ...VALID, name: 1 })).toContain('name이 문자열이 아니다')
  })

  it('지원하지 않는 버전은 실패한다', () => {
    expect(errorsOf({ ...VALID, version: 2 })).toContain('version은 1이어야 한다')
  })

  it('높이 맵은 비어 있지 않은 직사각형 정수 배열이어야 한다', () => {
    expect(errorsOf({ ...VALID, heights: [] })).toContain('heights가 비어 있다')
    expect(errorsOf({ ...VALID, heights: [[0, 0], [0]] })).toContain(
      'heights의 모든 행 길이가 같아야 한다',
    )
    expect(
      errorsOf({
        ...VALID,
        heights: [
          [0, 1.5],
          [0, -2],
        ],
      }),
    ).toContain('heights 값은 -1 이상의 정수여야 한다')
  })
})

describe('checkStartGoal', () => {
  it('시작과 목표는 맵 안의 바닥 칸이고 서로 달라야 한다', () => {
    expect(errorsOf({ ...VALID, start: { x: 1, y: 1 } })).toContain('start가 바닥 칸이 아니다')
    expect(errorsOf({ ...VALID, goal: { x: 9, y: 0 } })).toContain('goal이 바닥 칸이 아니다')
    expect(errorsOf({ ...VALID, goal: { x: 0, y: 0 } })).toContain('start와 goal이 같다')
  })
})

describe('checkBest', () => {
  it('best는 양의 정수여야 한다', () => {
    expect(errorsOf({ ...VALID, best: 0 })).toContain('best는 양의 정수여야 한다')
  })
})
