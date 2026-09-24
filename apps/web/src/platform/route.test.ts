import { describe, expect, it } from 'vitest'

import { type RouteContext, hashOf, parseRoute, resolveRoute, screenKeyOf } from './route'

const CONTEXT: RouteContext = {
  canPlay: (stageId: string) => stageId === '1-1' || stageId === '1-2',
  worlds: [1, 2],
  currentWorld: 2,
}

describe('parseRoute', () => {
  it('빈 주소와 슬래시는 타이틀이다', () => {
    expect(parseRoute('')).toEqual({ screen: 'title' })
    expect(parseRoute('#')).toEqual({ screen: 'title' })
    expect(parseRoute('#/')).toEqual({ screen: 'title' })
  })

  it('스테이지 선택 주소에서 월드 번호를 읽는다', () => {
    expect(parseRoute('#/stages/1')).toEqual({ screen: 'select', world: 1 })
    expect(parseRoute('#/stages/2')).toEqual({ screen: 'select', world: 2 })
  })

  it('월드를 적지 않은 스테이지 선택 주소도 읽는다', () => {
    expect(parseRoute('#/stages')).toEqual({ screen: 'select' })
  })

  it('게임 주소에서 스테이지 id를 읽는다', () => {
    expect(parseRoute('#/play/1-3')).toEqual({ screen: 'play', stageId: '1-3' })
  })

  it('모르는 주소는 null이다', () => {
    expect(parseRoute('#/nope')).toBeNull()
    expect(parseRoute('#/stages/abc')).toBeNull()
    expect(parseRoute('#/stages/1/2')).toBeNull()
    expect(parseRoute('#/play')).toBeNull()
    expect(parseRoute('#/play/')).toBeNull()
    expect(parseRoute('#/play/1-3/extra')).toBeNull()
    expect(parseRoute('#/play/one')).toBeNull()
  })
})

describe('hashOf', () => {
  it('화면마다 주소를 만든다', () => {
    expect(hashOf({ screen: 'title' })).toBe('#/')
    expect(hashOf({ screen: 'select', world: 2 })).toBe('#/stages/2')
    expect(hashOf({ screen: 'play', stageId: '1-3' })).toBe('#/play/1-3')
  })

  it('만든 주소를 다시 읽으면 같은 화면이다', () => {
    const select = { screen: 'select', world: 2 } as const
    const play = { screen: 'play', stageId: '1-2' } as const
    const chapters = { screen: 'select', world: 2, chapters: true } as const

    expect(parseRoute(hashOf(select))).toEqual(select)
    expect(parseRoute(hashOf(play))).toEqual(play)
    expect(parseRoute(hashOf(chapters))).toEqual(chapters)
  })

  it('장 고르기는 목록 주소에 한 겹 더 붙인다', () => {
    expect(hashOf({ screen: 'select', world: 6, chapters: true })).toBe('#/stages/6/chapters')
  })
})

describe('screenKeyOf', () => {
  it('장 고르기는 목록과 같은 화면이다', () => {
    const list = screenKeyOf({ screen: 'select', world: 6 })

    expect(screenKeyOf({ screen: 'select', world: 6, chapters: true })).toBe(list)
    expect(screenKeyOf({ screen: 'select', world: 7 })).not.toBe(list)
  })
})

describe('resolveRoute', () => {
  it('갈 수 있는 주소는 그대로 둔다', () => {
    expect(resolveRoute('#/stages/1', CONTEXT)).toEqual({ screen: 'select', world: 1 })
    expect(resolveRoute('#/play/1-2', CONTEXT)).toEqual({ screen: 'play', stageId: '1-2' })
  })

  it('월드를 적지 않은 주소는 진행 중인 월드로 보낸다', () => {
    expect(resolveRoute('#/stages', CONTEXT)).toEqual({ screen: 'select', world: 2 })
  })

  it('없는 월드는 진행 중인 월드로 보낸다', () => {
    expect(resolveRoute('#/stages/99', CONTEXT)).toEqual({ screen: 'select', world: 2 })
  })

  it('모르는 주소는 타이틀로 보낸다', () => {
    expect(resolveRoute('#/nope', CONTEXT)).toEqual({ screen: 'title' })
  })

  it('잠겼거나 없는 스테이지는 스테이지 선택으로 보낸다', () => {
    expect(resolveRoute('#/play/1-9', CONTEXT)).toEqual({ screen: 'select', world: 2 })
    expect(resolveRoute('#/play/2-1', CONTEXT)).toEqual({ screen: 'select', world: 2 })
    expect(resolveRoute('#/play/9-9', CONTEXT)).toEqual({ screen: 'select', world: 2 })
  })
})
