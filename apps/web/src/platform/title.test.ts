import { describe, expect, it } from 'vitest'

import { documentTitle } from './title'

describe('documentTitle', () => {
  it('타이틀 화면은 index.html과 같은 제목을 쓴다', () => {
    expect(documentTitle({ screen: 'title' }, 'ko')).toBe('Cubound — 작은 큐브의 집 찾기 여행')
  })

  it('스테이지 선택은 보고 있는 월드 이름을 쓴다', () => {
    expect(documentTitle({ screen: 'select', world: 1 }, 'ko')).toBe('Cubound — 낮은 계단의 땅')
    expect(documentTitle({ screen: 'select', world: 6 }, 'ko')).toBe('Cubound — 발이 묶이는 땅')
    expect(documentTitle({ screen: 'select', world: 1 }, 'en')).toBe('Cubound — Land of Low Steps')
  })

  it('장 고르기는 그 장의 이름을 쓴다', () => {
    expect(documentTitle({ screen: 'select', world: 1, chapters: true }, 'ko')).toBe(
      'Cubound — 돌 위의 첫걸음',
    )
    expect(documentTitle({ screen: 'select', world: 6, chapters: true }, 'ko')).toBe(
      'Cubound — 풀이 우거진 길',
    )
  })

  it('스테이지는 두 자리 번호와 이름을 함께 쓴다', () => {
    expect(documentTitle({ screen: 'play', stageId: '1-3' }, 'ko')).toBe('Cubound — 03 디딤돌')
    expect(documentTitle({ screen: 'play', stageId: '1-10' }, 'en')).toBe(
      'Cubound — 10 The Long Way',
    )
  })
})
