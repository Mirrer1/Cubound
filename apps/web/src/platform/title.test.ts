import { describe, expect, it } from 'vitest'

import { documentTitle } from './title'

describe('documentTitle', () => {
  it('타이틀 화면은 이름만 쓴다', () => {
    expect(documentTitle({ screen: 'title' }, 'ko')).toBe('Cubound')
  })

  it('스테이지 선택은 고른 언어를 따른다', () => {
    expect(documentTitle({ screen: 'select' }, 'ko')).toBe('Cubound — 스테이지 선택')
    expect(documentTitle({ screen: 'select' }, 'en')).toBe('Cubound — Stages')
  })

  it('스테이지는 두 자리 번호와 이름을 함께 쓴다', () => {
    expect(documentTitle({ screen: 'play', stageId: '1-3' }, 'ko')).toBe('Cubound — 03 디딤돌')
    expect(documentTitle({ screen: 'play', stageId: '1-10' }, 'en')).toBe(
      'Cubound — 10 The Long Way',
    )
  })
})
