import { describe, expect, it } from 'vitest'

import { PIT_FLOOR, PLATE } from '../view'
import { guideRect } from './guideFrame'
import { WHIRL_STAGE } from './testStages'
import { TILE, toScreen } from '@/game/iso'
import { createState } from '@/game/rules'
import type { GameState, Point, Stage } from '@/game/types'

const FLAT: Stage = {
  version: 1,
  id: 'test-guide',
  heights: [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ],
  start: { x: 0, y: 0 },
  goal: { x: 2, y: 2 },
  entities: [],
}

const MID = { x: 1, y: 1 }

// 사각형 위, 아래와 윗면 중심 사이 거리
const spanOf = (game: GameState, p: Point, surface = 0) => {
  const rect = guideRect(game, p)
  const center = toScreen(p, 0).y - surface
  return { above: center - rect.y, below: rect.y + rect.height - center }
}

describe('guideRect', () => {
  it('빈 칸은 윗면 마름모에 사방 같은 여백을 둔다', () => {
    const rect = guideRect(createState(FLAT), MID)
    const center = toScreen(MID, 0)
    const margin = center.x - TILE.width / 2 - rect.x
    expect(rect.width).toBe(TILE.width + margin * 2)
    expect(rect.height).toBe(TILE.height + margin * 2)
    expect(rect.y + rect.height / 2).toBe(center.y)
  })

  it('높은 칸은 높이만큼 위에서 재고 앞 칸보다 높은 옆면만 아래에 넣는다', () => {
    const stage = {
      ...FLAT,
      heights: [
        [0, 0, 0],
        [0, 2, 1],
        [0, 0, 0],
      ],
    }
    const span = spanOf(createState(stage), MID, 2 * TILE.layer)
    const flat = spanOf(createState(FLAT), MID)
    expect(span.above).toBe(flat.above)
    expect(span.below).toBe(flat.below + 2 * TILE.layer)
  })

  it('앞이 빈 칸은 땅 아래 두께까지 넣는다', () => {
    const stage = {
      ...FLAT,
      heights: [
        [0, 0, 0],
        [0, 1, -1],
        [0, 0, -1],
      ],
    }
    const span = spanOf(createState(stage), MID, TILE.layer)
    expect(span.below).toBe(spanOf(createState(FLAT), MID).below + TILE.layer + TILE.lip)
  })

  it('대각선 앞 칸이 가린 옆면 아래쪽은 넣지 않는다', () => {
    const open = {
      ...FLAT,
      heights: [
        [0, 0, 0],
        [0, 1, -1],
        [0, 0, -1],
      ],
    }
    const covered = {
      ...FLAT,
      heights: [
        [0, 0, 0],
        [0, 1, -1],
        [0, 0, 0],
      ],
    }
    const full = spanOf(createState(open), MID, TILE.layer).below
    expect(spanOf(createState(covered), MID, TILE.layer).below).toBe(full - TILE.lip / 2)
  })

  it('바닥 없는 구덩이 칸은 앞이 비면 팬 바닥 깊이만큼 넣는다', () => {
    const open = {
      ...FLAT,
      heights: [
        [0, 0, 0],
        [0, -1, -1],
        [0, -1, -1],
      ],
    }
    const closed = {
      ...FLAT,
      heights: [
        [0, 0, 0],
        [0, -1, 0],
        [0, 0, 0],
      ],
    }
    const flat = spanOf(createState(FLAT), MID).below
    expect(spanOf(createState(open), MID).below).toBe(flat + PIT_FLOOR)
    expect(spanOf(createState(closed), MID).below).toBe(flat)
  })

  it('물 칸은 바닥이 아닌 수면 높이에서 잰다', () => {
    const game = createState(WHIRL_STAGE)
    const whirl = { x: 1, y: 1 }
    const rect = guideRect(game, whirl)
    const surface = toScreen(whirl, WHIRL_STAGE.water!).y + 6
    const flat = guideRect(createState(FLAT), MID)
    expect(rect.y - surface).toBe(flat.y - toScreen(MID, 0).y)
  })

  it('뜬 상자는 수면 위로 낮아 위쪽 여유를 늘리지 않는다', () => {
    const game = createState(WHIRL_STAGE)
    const water = spanOf(game, { x: 2, y: 1 }, 24)
    const boat = spanOf(game, { x: 3, y: 1 }, 24)
    expect(boat.above).toBe(water.above)
  })

  it('큐브와 땅 위 상자는 제 높이만큼 위쪽을 늘린다', () => {
    const stage = { ...FLAT, start: MID, entities: [{ type: 'box' as const, x: 2, y: 1 }] }
    const game = createState(stage)
    const flat = spanOf(createState(FLAT), { x: 2, y: 1 })
    const reach = TILE.layer + (TILE.width * TILE.layer) / TILE.height / 4 - TILE.height / 2
    expect(spanOf(game, MID).above).toBe(flat.above + reach)
    expect(spanOf(game, { x: 2, y: 1 }).above).toBe(flat.above + reach)
  })

  it('닫힌 문은 솟은 높이를 넣고 열린 문은 넣지 않는다', () => {
    const stage: Stage = {
      ...FLAT,
      entities: [
        { type: 'door', id: 'a', x: 1, y: 1 },
        { type: 'switch', target: 'a', x: 0, y: 1 },
      ],
    }
    const closed = spanOf(createState(stage), MID)
    const open = spanOf(createState({ ...stage, start: { x: 0, y: 1 } }), MID)
    expect(closed.above - open.above).toBe(
      TILE.layer + PLATE.rise + (TILE.width * PLATE.scale) / 4 - TILE.height / 2,
    )
    expect(open.above).toBe(spanOf(createState(FLAT), MID).above)
  })

  it('버섯 갓이 윗면보다 솟은 만큼 위쪽을 늘린다', () => {
    const stage = { ...FLAT, mushroom: ['...', '.#.', '...'] }
    const above = spanOf(createState(stage), MID).above
    expect(above).toBeGreaterThan(spanOf(createState(FLAT), MID).above)
  })

  it('올라간 승강 발판은 한 층 위에서 잰다', () => {
    const stage: Stage = {
      ...FLAT,
      start: { x: 0, y: 1 },
      entities: [
        { type: 'lift', id: 'a', x: 1, y: 1 },
        { type: 'switch', target: 'a', x: 0, y: 1 },
      ],
    }
    const raised = guideRect(createState(stage), MID)
    const flat = guideRect(createState(FLAT), MID)
    expect(raised.y).toBe(flat.y - TILE.layer)
  })

  it('뒤쪽 벽에 기댄 사다리는 앞쪽 벽에 기댄 사다리보다 높이 닿는다', () => {
    const game = createState(FLAT)
    const leaning = (direction: 'up' | 'down') =>
      spanOf({ ...game, leaningLadders: [{ ...MID, direction }] }, MID).above
    expect(leaning('up') - leaning('down')).toBe(TILE.height / 2)
  })
})
