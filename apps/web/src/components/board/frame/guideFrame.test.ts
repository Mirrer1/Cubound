import { describe, expect, it } from 'vitest'

import { BAR_HEIGHT, BRAZIER, KEG_SHAPE, PIT_FLOOR, PLATE, POST, pileReach } from '../view'
import { TAP } from '../view'
import { burnRect, guideRect, lockFocus, lockRect, pairRect } from './guideFrame'
import { LOCK_STAGE, SLUICE_STAGE, WHIRL_STAGE } from './testStages'
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
  it('막대는 차지한 두 칸을 다 감싸고 좌우는 받침 끝까지, 위는 막대 높이까지 올린다', () => {
    const game = createState({ ...FLAT, entities: [{ type: 'bar', x: 0, y: 1, axis: 'x' }] })
    const rect = guideRect(game, MID)
    expect(guideRect(game, { x: 0, y: 1 })).toEqual(rect)
    expect(rect.x).toBeCloseTo(toScreen({ x: -0.32, y: 1.18 }, 0).x - 12)
    expect(rect.x + rect.width).toBeCloseTo(toScreen({ x: 1.32, y: 0.82 }, 0).x + 12)
    expect(toScreen(MID, 0).y - rect.y).toBeGreaterThan(BAR_HEIGHT + 12)
  })

  it('서 있는 숯 벽은 칸이 아닌 숯 더미 둘레만 감싼다', () => {
    const stage = {
      ...FLAT,
      heights: [
        [1, 1, 1],
        [1, 1, -1],
        [1, -1, -1],
      ],
      fire: ['.*.', '.#.', '...'],
    }
    const rect = guideRect(createState(stage), MID)
    const center = toScreen(MID, 0).y - TILE.layer
    expect(rect.width).toBeCloseTo(TILE.width * 0.8 + 24)
    expect(rect.y).toBeCloseTo(center - pileReach() - 12)
    expect(rect.y + rect.height).toBeCloseTo(center + (TILE.width * 0.8) / 4 + 12)
  })

  it('불씨는 칸이 아닌 화덕 둘레만 감싼다', () => {
    const stage = { ...FLAT, fire: ['...', '.*.', '...'] }
    const rect = guideRect(createState(stage), MID)
    const center = toScreen(MID, 0).y
    expect(rect.width).toBeCloseTo(TILE.width * 0.6 + 24)
    expect(rect.y).toBeCloseTo(center - (TILE.width * 0.6) / 4 - 12)
    expect(rect.y + rect.height).toBeCloseTo(center + (TILE.width * 0.6) / 4 + 12)
  })

  it('말뚝은 칸이 아닌 말뚝 둘레만 감싼다', () => {
    const stage: Stage = {
      ...FLAT,
      heights: [
        [1, 1, 0],
        [1, 1, 0],
        [1, 1, 0],
      ],
      water: 1,
      entities: [
        { type: 'box', x: 2, y: 1 },
        { type: 'post', ...MID, length: 1, boat: { x: 2, y: 1 } },
      ],
    }
    const rect = guideRect(createState(stage), MID)
    const center = toScreen(MID, 0)
    const top = center.y - TILE.layer
    const foot = (TILE.width * POST.width) / 4
    expect(rect.x + rect.width / 2).toBeCloseTo(center.x)
    expect(rect.width).toBeCloseTo(TILE.width * POST.width + 48)
    expect(rect.y).toBeCloseTo(top - POST.height - foot - 24)
    expect(rect.y + rect.height).toBeCloseTo(top + foot + 24)
  })

  it('화약통은 칸이 아닌 통 둘레만 감싼다', () => {
    const stage: Stage = {
      ...FLAT,
      heights: [
        [0, 0, 0],
        [0, 0, -1],
        [0, -1, -1],
      ],
      entities: [{ type: 'keg', ...MID }],
    }
    const rect = guideRect(createState(stage), MID)
    const center = toScreen(MID, 0).y
    const tip =
      center - KEG_SHAPE.bodyHeight - KEG_SHAPE.lidHeight - (TILE.width * KEG_SHAPE.lid) / 4
    expect(rect.width).toBeCloseTo(TILE.width * KEG_SHAPE.body + 48)
    expect(rect.y).toBeCloseTo(tip - 24)
    expect(rect.y + rect.height).toBeCloseTo(center + (TILE.width * KEG_SHAPE.body) / 4 + 24)
  })

  it('재가 된 숯 벽 칸은 빈 칸과 같다', () => {
    const stage = { ...FLAT, fire: ['.*.', '.#.', '...'] }
    expect(guideRect({ ...createState(stage), ashes: [MID] }, MID)).toEqual(
      guideRect(createState(FLAT), MID),
    )
  })

  it('숯 다리 칸은 장작 판 두께만 옆면으로 넣는다', () => {
    const stage = {
      ...FLAT,
      heights: [
        [0, 0, 0],
        [0, 1, -1],
        [0, -1, -1],
      ],
      fire: ['.*.', '.=.', '...'],
    }

    expect(spanOf(createState(stage), MID, TILE.layer).below).toBe(
      spanOf(createState(FLAT), MID).below + TILE.lip,
    )
  })

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

  it('앞이 빈 칸은 그쪽 옆면을 넣지 않는다', () => {
    const stage = {
      ...FLAT,
      heights: [
        [0, 0, 0],
        [0, 1, -1],
        [0, -1, -1],
      ],
    }
    const span = spanOf(createState(stage), MID, TILE.layer)
    expect(span.below).toBe(spanOf(createState(FLAT), MID).below)
  })

  it('대각선 앞 칸이 가린 옆면 아래쪽은 넣지 않는다', () => {
    const open = {
      ...FLAT,
      heights: [
        [0, 0, 0],
        [0, 2, 0],
        [0, 0, 0],
      ],
    }
    const covered = {
      ...FLAT,
      heights: [
        [0, 0, 0],
        [0, 2, 0],
        [0, 0, 1],
      ],
    }
    const full = spanOf(createState(open), MID, 2 * TILE.layer).below
    expect(spanOf(createState(covered), MID, 2 * TILE.layer).below).toBeLessThan(full)
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

  it('화로는 그릇 윗면까지, 그 위 큐브와 상자는 그릇 높이만큼 더 위를 감싼다', () => {
    const stage = { ...FLAT, fire: ['...', '.@@', '...'] }
    const empty = spanOf(createState(FLAT), MID).above
    const bowl = BRAZIER.height + (TILE.width * BRAZIER.bowl) / 4 - TILE.height / 2
    expect(spanOf(createState(stage), MID).above).toBe(empty + bowl)
    const cube = spanOf(createState({ ...FLAT, start: MID }), MID).above
    expect(spanOf(createState({ ...stage, start: MID }), MID).above).toBe(cube + BRAZIER.height)
    const boxed = { ...stage, entities: [{ type: 'box' as const, x: 2, y: 1 }] }
    const box = spanOf(createState({ ...FLAT, entities: boxed.entities }), { x: 2, y: 1 }).above
    expect(spanOf(createState(boxed), { x: 2, y: 1 }).above).toBe(box + BRAZIER.height)
  })

  it('얼음 돌은 돌 가운데를 사각형 가운데에 두고 윗면까지 감싼다', () => {
    const stage = { ...FLAT, entities: [{ type: 'iceStone' as const, ...MID }] }
    const rect = guideRect(createState(stage), MID)
    const center = toScreen(MID, 0).y
    const tip = center - 26 - (TILE.width * 0.28) / 4
    const foot = center + (TILE.width * 0.64) / 4
    expect(rect.y + rect.height / 2).toBeCloseTo((tip + foot) / 2)
    expect(rect.y + rect.height).toBeCloseTo(center + TILE.height / 2 + 12)
  })

  it('바닥에 놓인 씨앗은 칸이 아닌 씨앗 둘레만 감싼다', () => {
    const stage: Stage = {
      ...FLAT,
      heights: [
        [0, 0, 0],
        [0, 0, -1],
        [0, -1, 0],
      ],
      entities: [{ type: 'seed', ...MID }],
    }
    const rect = guideRect(createState(stage), MID)
    const center = toScreen(MID, 0)
    expect(rect.x + rect.width / 2).toBeCloseTo(center.x)
    expect(rect.width).toBeCloseTo(TILE.width * 0.24 + 48)
    expect(rect.y).toBeCloseTo(center.y - 11 - (TILE.width * 0.13) / 4 - 24)
    expect(rect.y + rect.height).toBeCloseTo(center.y + (TILE.width * 0.24) / 4 + 24)
  })

  it('짝 칸도 앞 구덩이 쪽 옆면을 빼서 윗면 가운데가 사각형 가운데', () => {
    const stage: Stage = {
      ...FLAT,
      heights: [
        [0, 0, 0],
        [0, 0, -1],
        [0, -1, 0],
      ],
      entities: [
        { type: 'warp', id: 'pair', ...MID },
        { type: 'warp', id: 'pair', x: 2, y: 0 },
      ],
    }
    const rect = guideRect(createState(stage), MID)
    const center = toScreen(MID, 0).y
    expect(rect.y + rect.height / 2).toBeCloseTo(center)
    expect(rect.y + rect.height).toBeCloseTo(center + TILE.height / 2 + 12)
  })

  it('짝 칸은 낮은 바닥 쪽으로 드러난 옆면을 넣는다', () => {
    const stage: Stage = {
      ...FLAT,
      heights: [
        [0, 0, 0],
        [0, 1, 0],
        [0, 0, 0],
      ],
      entities: [
        { type: 'warp', id: 'pair', ...MID },
        { type: 'warp', id: 'pair', x: 2, y: 0 },
      ],
    }
    const { above, below } = spanOf(createState(stage), MID, TILE.layer)
    expect(above).toBeCloseTo(TILE.height / 2 + 12)
    expect(below).toBeCloseTo(TILE.height / 2 + TILE.layer + 12)
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

  it('버섯은 칸이 아닌 갓 둘레만 감싸고 갓이 솟은 만큼 위로 늘린다', () => {
    const stage = { ...FLAT, mushroom: ['...', '.#.', '...'] }
    const rect = guideRect(createState(stage), MID)
    const flat = guideRect(createState(FLAT), MID)
    expect(rect.width).toBeLessThan(flat.width)
    expect(rect.y).toBeLessThan(flat.y)
  })

  it('바닥 사다리는 칸이 아닌 사다리 둘레만 감싼다', () => {
    const stage: Stage = { ...FLAT, entities: [{ type: 'ladder', ...MID }] }
    const rect = guideRect(createState(stage), MID)
    const center = toScreen(MID, 0)
    expect(rect.x + rect.width / 2).toBeCloseTo(center.x)
    expect(rect.width).toBeCloseTo(TILE.width * 0.68 + 24)
    expect(rect.y + rect.height).toBeCloseTo(center.y + (TILE.width * 0.68) / 4 + 12)
  })

  it('올라간 승강 발판은 한 층 위에서 잰다', () => {
    const stage: Stage = {
      ...FLAT,
      start: { x: 0, y: 0 },
      entities: [
        { type: 'lift', id: 'a', x: 1, y: 1 },
        { type: 'switch', target: 'a', x: 0, y: 0 },
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

describe('guideRect 수위 장치', () => {
  it('빈 장치 칸은 꼭지 바퀴 윗면까지 감싼다', () => {
    const game = createState({ ...SLUICE_STAGE, start: { x: 2, y: 0 } })
    const rect = guideRect(game, { x: 0, y: 0 })
    const top =
      toScreen({ x: 0, y: 0 }, 2).y - TAP.height - TAP.wheelDepth - (TILE.width * TAP.wheel) / 4

    expect(rect.y).toBeLessThanOrEqual(top - 12)
  })
})

describe('guideRect 승강 발판', () => {
  it('승강 발판은 맞닿은 스위치까지 한 사각형으로 감싼다', () => {
    const stage: Stage = {
      ...FLAT,
      entities: [
        { type: 'switch', x: 1, y: 0, target: 'a' },
        { type: 'switch', x: 0, y: 2, target: 'a' },
        { type: 'lift', id: 'a', ...MID },
      ],
    }
    const game = createState(stage)
    const lift = guideRect(createState(FLAT), MID)
    const lever = guideRect(game, { x: 1, y: 0 })
    const rect = guideRect(game, MID)
    expect(rect.y).toBe(lever.y)
    expect(rect.y + rect.height).toBe(lift.y + lift.height)
    expect(rect.x).toBe(Math.min(lift.x, lever.x))
  })
})

describe('pairRect', () => {
  it('짝 칸은 짝의 사각형, 짝도 문도 아니면 null', () => {
    const stage: Stage = {
      ...FLAT,
      entities: [
        { type: 'warp', id: 'pair', ...MID },
        { type: 'warp', id: 'pair', x: 2, y: 0 },
      ],
    }
    const game = createState(stage)
    expect(pairRect(game, MID)).toEqual(guideRect(game, { x: 2, y: 0 }))
    expect(pairRect(game, { x: 0, y: 0 })).toBeNull()
  })

  it('문은 그 문을 여는 스위치의 사각형', () => {
    const stage: Stage = {
      ...FLAT,
      entities: [
        { type: 'switch', x: 0, y: 0, target: 'gate' },
        { type: 'door', id: 'gate', ...MID },
      ],
    }
    const game = createState(stage)
    expect(pairRect(game, MID)).toEqual(guideRect(game, { x: 0, y: 0 }))
  })
})

describe('lockFocus', () => {
  it('갑문 판은 장치 칸, 아니면 null', () => {
    expect(lockFocus(LOCK_STAGE)).toEqual({ x: 3, y: 1 })
    expect(lockFocus(SLUICE_STAGE)).toBeNull()
  })
})

describe('lockRect', () => {
  // 넓게 퍼진 두 웅덩이, 장치 (3,1)에서 곧은 물길이 (2,1)과 (4,1)에 닿음
  const WIDE: Stage = {
    ...LOCK_STAGE,
    heights: [
      [2, 2, 2, 2, 2, 2, 2],
      [0, 0, 1, 2, 1, 0, 0],
      [0, 2, 2, 2, 2, 2, 0],
    ],
  }
  const union = (game: GameState, cells: Point[]) => {
    const rects = cells.map((p) => guideRect(game, p))
    const left = Math.min(...rects.map((r) => r.x))
    const top = Math.min(...rects.map((r) => r.y))
    return {
      x: left,
      y: top,
      width: Math.max(...rects.map((r) => r.x + r.width)) - left,
      height: Math.max(...rects.map((r) => r.y + r.height)) - top,
    }
  }

  it('물길이 있으면 장치와 물길, 물길이 닿는 두 웅덩이 칸만 감싼다', () => {
    const game = createState(WIDE)

    expect(lockRect(game)).toEqual(
      union(game, [
        { x: 2, y: 1 },
        { x: 3, y: 1 },
        { x: 4, y: 1 },
      ]),
    )
  })

  it('물길이 없으면 두 웅덩이 칸을 다 감싼다', () => {
    const game = createState({ ...WIDE, entities: [{ type: 'sluice', x: 3, y: 0 }] })
    const pools = WIDE.heights.flatMap((row, y) =>
      row.flatMap((h, x) => (h >= 0 && h <= 1 ? [{ x, y }] : [])),
    )

    expect(lockRect(game)).toEqual(union(game, pools))
  })
})

describe('burnRect', () => {
  const BURN_STAGE: Stage = {
    version: 1,
    id: 'test-burn',
    heights: [
      [2, 2, 2],
      [2, 2, 2],
    ],
    fire: ['...', '.@.'],
    start: { x: 0, y: 0 },
    goal: { x: 2, y: 0 },
    entities: [{ type: 'box', x: 1, y: 0 }],
    rules: { burnBox: true },
  }

  it('상자와 맞닿은 화로까지 감싸고 기둥 옆면은 넣지 않는다', () => {
    const game = createState(BURN_STAGE)
    const rect = burnRect(game, { x: 1, y: 0 })
    const box = guideRect(game, { x: 1, y: 0 })
    const brazier = guideRect(game, { x: 1, y: 1 })

    expect(rect.x).toBe(Math.min(box.x, brazier.x))
    expect(rect.x + rect.width).toBe(Math.max(box.x + box.width, brazier.x + brazier.width))
    expect(rect.y).toBe(box.y)
    expect(rect.y + rect.height).toBeLessThanOrEqual(brazier.y + brazier.height)
  })
})
