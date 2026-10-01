import { describe, expect, it } from 'vitest'

import { STAGE } from './testStages'
import { durationOf } from './timeFrame'
import { vineFrames, vineLooks, vineProgress } from './vineFrame'
import { createState, move } from '@/game/rules'
import type { GameState, Stage } from '@/game/types'

// 뿌리 (0,1)에서 오른쪽으로 세 칸 자라는 덩굴
const VINE_STAGE: Stage = {
  version: 1,
  id: 'test-frame-vine',
  heights: [
    [0, 0, 0, 0, 0],
    [0, -1, -1, -1, 0],
    [0, 0, 0, 0, 0],
  ],
  start: { x: 0, y: 0 },
  goal: { x: 4, y: 0 },
  entities: [
    {
      type: 'vine',
      id: 'a',
      x: 0,
      y: 1,
      cells: [
        { x: 1, y: 1 },
        { x: 2, y: 1 },
        { x: 3, y: 1 },
      ],
    },
  ],
}

const grownTo = (stage: Stage, grown: number, stopped = false): GameState => ({
  ...createState(stage),
  vines: [{ id: 'a', grown, stopped }],
})

const look = (kind: string, enter: string | null, leave: string | null, hard = false) => ({
  kind,
  enter,
  leave,
  hard,
  knot: false,
})

describe('vineLooks', () => {
  it('처음에는 뿌리가 자랄 쪽을 가리키고 첫 칸이 다음 자랄 칸이다', () => {
    const looks = vineLooks(createState(VINE_STAGE))

    expect(looks.get('0-1')).toEqual(look('root', null, 'right'))
    expect(looks.get('1-1')).toEqual(look('next', 'right', 'right'))
    expect(looks.get('2-1')).toEqual(look('future', 'right', 'right'))
    expect(looks.get('3-1')).toEqual(look('future', 'right', 'right'))
    expect(looks.size).toBe(4)
  })

  it('자란 칸 다음 한 칸만 다음 자랄 칸이다', () => {
    const looks = vineLooks(grownTo(VINE_STAGE, 2))

    expect(looks.get('1-1')?.kind).toBe('grown')
    expect(looks.get('2-1')?.kind).toBe('grown')
    expect(looks.get('3-1')?.kind).toBe('next')
  })

  it('다 자란 끝 칸의 줄기는 들어온 쪽으로 곧게 나간다', () => {
    expect(vineLooks(grownTo(VINE_STAGE, 3)).get('3-1')).toEqual(look('grown', 'right', 'right'))
  })

  it('꺾이는 칸은 들어오는 방향과 나가는 방향이 다르다', () => {
    const stage: Stage = {
      ...VINE_STAGE,
      heights: [
        [0, 0, 0, 0, 0],
        [0, -1, -1, 0, 0],
        [0, 0, -1, -1, 0],
        [0, 0, 0, 0, 0],
      ],
      entities: [
        {
          type: 'vine',
          id: 'a',
          x: 0,
          y: 1,
          cells: [
            { x: 1, y: 1 },
            { x: 2, y: 1 },
            { x: 2, y: 2 },
            { x: 3, y: 2 },
          ],
        },
      ],
    }
    const looks = vineLooks(grownTo(stage, 4))

    expect(looks.get('1-1')).toEqual(look('grown', 'right', 'right'))
    expect(looks.get('2-1')).toEqual(look('grown', 'right', 'down'))
    expect(looks.get('2-2')).toEqual(look('grown', 'down', 'right'))
    expect(looks.get('3-2')).toEqual(look('grown', 'right', 'right'))
  })

  it('왼쪽이나 위로 자라는 덩굴도 방향을 그대로 돌려준다', () => {
    const stage: Stage = {
      ...VINE_STAGE,
      entities: [
        {
          type: 'vine',
          id: 'a',
          x: 4,
          y: 1,
          cells: [
            { x: 3, y: 1 },
            { x: 2, y: 1 },
          ],
        },
      ],
    }
    const looks = vineLooks(createState(stage))

    expect(looks.get('4-1')).toEqual(look('root', null, 'left'))
    expect(looks.get('3-1')).toEqual(look('next', 'left', 'left'))
  })

  it('굳은 덩굴은 자란 칸이 짙어지고 끝 칸이 봉오리로 닫히며 남은 자리는 빈 구덩이다', () => {
    const looks = vineLooks(grownTo({ ...VINE_STAGE, rules: { vineStop: true } }, 2, true))

    expect(looks.get('1-1')).toEqual(look('grown', 'right', 'right', true))
    expect(looks.get('2-1')).toEqual({ ...look('grown', 'right', 'right', true), knot: true })
    expect(looks.get('3-1')).toEqual(look('spent', 'right', 'right'))
  })

  it('덩굴이 없는 판은 비어 있다', () => {
    expect(vineLooks(createState(STAGE)).size).toBe(0)
  })
})

describe('vineProgress', () => {
  const { events } = move(createState(VINE_STAGE), 'down')

  it('이동 시간에 걸쳐 0에서 1로 간다', () => {
    expect(vineProgress(events, 0)).toBe(0)
    expect(vineProgress(events, 0.5)).toBeCloseTo(0.5)
    expect(vineProgress(events, 1)).toBe(1)
  })

  it('늪에서 뽑혀 나오는 동안은 0이고 그 뒤 이동과 같이 간다', () => {
    const swamp = { lead: 0.2, tail: 0 }
    const total = durationOf(events, swamp)

    expect(vineProgress(events, 0.1 / total, swamp)).toBe(0)
    expect(vineProgress(events, (0.2 + (total - 0.2) / 2) / total, swamp)).toBeCloseTo(0.5)
    expect(vineProgress(events, 1, swamp)).toBe(1)
  })

  it('시간이 없는 수는 1이다', () => {
    expect(vineProgress([], 0.3)).toBe(1)
  })
})

describe('vineFrames', () => {
  const start = createState(VINE_STAGE)
  const grew = move(start, 'down')

  it('앞 상태가 없으면 정지 그림이다', () => {
    const frames = vineFrames(null, grew.state, [], 1)

    expect(frames.get('1-1')).toMatchObject({ kind: 'grown', growth: 1, rise: 1, sprout: 0 })
    expect(frames.get('2-1')).toMatchObject({ kind: 'next', tongue: 1, sprout: 24 })
    expect(frames.get('3-1')).toMatchObject({ kind: 'future', tongue: 0, sprout: 14 })
    expect(frames.get('0-1')).toMatchObject({ kind: 'root', opacity: 1 })
  })

  it('자라는 칸은 구덩이에서 시작해 줄기와 판이 차오르고 싹이 사라진다', () => {
    const at = (t: number) => vineFrames(start, grew.state, grew.events, t).get('1-1')

    expect(at(0)).toMatchObject({ kind: 'grown', growth: 0, rise: 0, sprout: 24, sproutOpacity: 1 })
    expect(at(0.5)?.growth).toBeCloseTo(0.5 / 0.8)
    expect(at(0.5)?.rise).toBeGreaterThan(0)
    expect(at(0.5)?.rise).toBeLessThan(1)
    expect(at(0.99)?.rise).toBeCloseTo(1, 2)
    expect(at(0.99)?.sproutOpacity).toBeCloseTo(0, 2)
  })

  it('새로 다음 자랄 칸이 된 칸은 싹이 14에서 24로 크고 줄기가 칸을 다 건넌 뒤 혀가 넘어온다', () => {
    const at = (t: number) => vineFrames(start, grew.state, grew.events, t).get('2-1')

    expect(at(0)).toMatchObject({ kind: 'next', tongue: 0, sprout: 14 })
    expect(at(0.7)?.tongue).toBe(0)
    expect(at(0.9)?.tongue).toBeCloseTo(0.5)
    expect(at(0.9)?.sprout).toBeGreaterThan(14)
    expect(at(0.9)?.sprout).toBeLessThan(24)
  })

  it('끝나는 순간은 정지 그림과 같다', () => {
    expect(vineFrames(start, grew.state, grew.events, 1)).toEqual(
      vineFrames(null, grew.state, [], 1),
    )
  })

  it('안 자란 수는 처음부터 끝까지 정지 그림이다', () => {
    const blocked = move(start, 'up')

    expect(vineFrames(start, blocked.state, blocked.events, 0.4)).toEqual(
      vineFrames(null, start, [], 1),
    )
  })

  it('굳는 수는 판과 잎이 짙어지고 끝 칸에 봉오리가 돋고 앞 싹이 사라진다', () => {
    const stage: Stage = { ...VINE_STAGE, rules: { vineStop: true } }
    const before = move(createState(stage), 'down').state
    const stepped = move(before, 'right')
    const at = (t: number) => vineFrames(before, stepped.state, stepped.events, t)

    expect(stepped.state.vines[0].stopped).toBe(true)
    expect(at(0).get('1-1')).toMatchObject({ kind: 'grown', hard: 0, knot: 0 })
    expect(at(0).get('2-1')).toMatchObject({ kind: 'next', tongue: 1, sproutOpacity: 1 })
    expect(at(0.99).get('1-1')?.hard).toBeGreaterThan(0.95)
    expect(at(0.99).get('1-1')?.knot).toBeGreaterThan(0.95)
    expect(at(0.99).get('2-1')?.sproutOpacity).toBeLessThan(0.05)
    expect(at(0.99).get('3-1')?.sproutOpacity).toBeLessThan(0.05)
  })

  it('재시작하면 자란 칸이 구덩이로 내려가고 싹이 다시 돋는다', () => {
    const grown = move(move(grew.state, 'up').state, 'down').state
    const at = (t: number) => vineFrames(grown, start, [], t, undefined, true).get('2-1')

    expect(at(0)).toMatchObject({ kind: 'grown', rise: 1, opacity: 1, sproutOpacity: 0 })
    expect(at(0.99)?.rise).toBeLessThan(0.05)
    expect(at(0.99)?.opacity).toBeLessThan(0.05)
    expect(at(0.99)?.sproutOpacity).toBeGreaterThan(0.95)
    expect(at(0.99)?.sprout).toBe(14)
  })
})
