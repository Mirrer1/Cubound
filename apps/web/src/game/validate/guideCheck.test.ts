import { describe, expect, it } from 'vitest'

import { VALID, errorsOf } from './testStages'

describe('checkGuides', () => {
  it('가이드는 없어도 되고 있으면 1~3단계여야 한다', () => {
    expect(errorsOf({ ...VALID, guides: undefined })).toEqual([])
    expect(errorsOf({ ...VALID, guides: [] })).toContain('guides는 1~3단계여야 한다')
    expect(errorsOf({ ...VALID, guides: [...VALID.guides, VALID.guides[0]] })).toContain(
      'guides는 1~3단계여야 한다',
    )
  })

  it('가이드 단계는 문구 id가 있어야 한다', () => {
    expect(errorsOf({ ...VALID, guides: [{ id: '', target: 'moves' }] })).toContain(
      'guides[0]의 id가 비어 있다',
    )
  })

  it('가이드 대상 칸은 맵 안에 있어야 한다', () => {
    const target = (value: unknown) => errorsOf({ ...VALID, guides: [{ id: 'a', target: value }] })

    expect(target({ x: 1, y: 1 })).toEqual([])
    expect(target({ x: 3, y: 0 })).toContain('guides[0]의 target이 맵 밖이다')
    expect(target({ x: 0, y: -1 })).toContain('guides[0]의 target이 맵 밖이다')
    expect(target({ x: 0.5, y: 0 })).toContain('guides[0]의 target이 맵 밖이다')
  })

  it('가이드 대상 화면 요소는 정해진 이름만 허용한다', () => {
    expect(errorsOf({ ...VALID, guides: [{ id: 'a', target: 'climbs' }] })).toEqual([])
    expect(errorsOf({ ...VALID, guides: [{ id: 'a', target: 'rides' }] })).toEqual([])
    expect(errorsOf({ ...VALID, guides: [{ id: 'a', target: 'dir' }] })).toEqual([])
    expect(errorsOf({ ...VALID, guides: [{ id: 'a', target: 'lock' }] })).toEqual([])
    expect(errorsOf({ ...VALID, guides: [{ id: 'a', target: 'undo' }] })).toContain(
      'guides[0]의 target을 알 수 없다',
    )
    expect(errorsOf({ ...VALID, guides: [{ id: 'a', target: 3 }] })).toContain(
      'guides[0]의 target을 알 수 없다',
    )
  })
})
