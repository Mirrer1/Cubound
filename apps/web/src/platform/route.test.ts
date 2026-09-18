import { describe, expect, it } from 'vitest'

import { hashOf, parseRoute, resolveRoute } from './route'

const canPlay = (stageId: string) => stageId === '1-1' || stageId === '1-2'

describe('parseRoute', () => {
  it('빈 주소와 슬래시는 타이틀이다', () => {
    expect(parseRoute('')).toEqual({ screen: 'title' })
    expect(parseRoute('#')).toEqual({ screen: 'title' })
    expect(parseRoute('#/')).toEqual({ screen: 'title' })
  })

  it('스테이지 선택 주소를 읽는다', () => {
    expect(parseRoute('#/stages')).toEqual({ screen: 'select' })
  })

  it('게임 주소에서 스테이지 id를 읽는다', () => {
    expect(parseRoute('#/play/1-3')).toEqual({ screen: 'play', stageId: '1-3' })
  })

  it('모르는 주소는 null이다', () => {
    expect(parseRoute('#/nope')).toBeNull()
    expect(parseRoute('#/play')).toBeNull()
    expect(parseRoute('#/play/')).toBeNull()
    expect(parseRoute('#/play/1-3/extra')).toBeNull()
    expect(parseRoute('#/play/one')).toBeNull()
  })
})

describe('hashOf', () => {
  it('화면마다 주소를 만든다', () => {
    expect(hashOf({ screen: 'title' })).toBe('#/')
    expect(hashOf({ screen: 'select' })).toBe('#/stages')
    expect(hashOf({ screen: 'play', stageId: '1-3' })).toBe('#/play/1-3')
  })

  it('만든 주소를 다시 읽으면 같은 화면이다', () => {
    const route = { screen: 'play', stageId: '1-2' } as const
    expect(parseRoute(hashOf(route))).toEqual(route)
  })
})

describe('resolveRoute', () => {
  it('갈 수 있는 주소는 그대로 둔다', () => {
    expect(resolveRoute('#/stages', canPlay)).toEqual({ screen: 'select' })
    expect(resolveRoute('#/play/1-2', canPlay)).toEqual({ screen: 'play', stageId: '1-2' })
  })

  it('모르는 주소는 타이틀로 보낸다', () => {
    expect(resolveRoute('#/nope', canPlay)).toEqual({ screen: 'title' })
  })

  it('잠겼거나 없는 스테이지는 스테이지 선택으로 보낸다', () => {
    expect(resolveRoute('#/play/1-9', canPlay)).toEqual({ screen: 'select' })
    expect(resolveRoute('#/play/9-9', canPlay)).toEqual({ screen: 'select' })
  })
})
