import { describe, expect, it } from 'vitest'

import {
  KEG_HEIGHT,
  KEG_SHAPE,
  burstLook,
  burstSparks,
  dustPuffs,
  isoEllipse,
  kegBlocks,
  kegCordSpan,
  kegCords,
  kegTrail,
} from './kegView'
import { TILE } from '@/game/iso'

describe('kegBlocks', () => {
  it('몸통 위에 뚜껑과 마개를 차례로 얹는다', () => {
    const { body, lid, plug, hoops } = kegBlocks(0, 0, 1)

    expect(body).toEqual({ x: 0, y: -24, width: TILE.width * 0.48, depth: 24 })
    expect(lid.y).toBe(-28)
    expect(plug.y).toBe(-KEG_HEIGHT)
    expect(hoops.map((h) => h.y)).toEqual([-6, -21])
    expect(hoops[0].depth).toBe(KEG_SHAPE.hoop)
  })

  it('부푼 만큼 넓고 높아진다', () => {
    const { body } = kegBlocks(0, 0, 1.07)

    expect(body.depth).toBeCloseTo(24 * 1.07)
    expect(body.width).toBeCloseTo(TILE.width * 0.48 * 1.07)
  })
})

describe('kegCords', () => {
  it('남은 마디 수만큼 심지를 감는다', () => {
    expect(kegCords(0, 0, 4, 1).parts).toHaveLength(4)
    expect(kegCords(0, 0, 2.5, 1).parts).toHaveLength(3)
    expect(kegCords(0, 0, 0, 1)).toEqual({ parts: [], tip: null, ember: null })
  })

  it('타는 끝 마디는 끝에서부터 짧아진다', () => {
    const full = kegCords(0, 0, 1, 1)
    const half = kegCords(0, 0, 0.5, 1)

    expect(full.ember).not.toEqual(half.ember)
    expect(half.ember?.y).toBeLessThan(full.ember?.y ?? 0)
  })

  it('끝 불빛은 몸통 윗단 높이에 있다', () => {
    const { ember } = kegCords(0, 0, 4, 1)

    expect(ember?.y).toBeLessThan(-KEG_SHAPE.bodyHeight)
  })
})

describe('kegCordSpan', () => {
  it('두 마디 자리 사이의 심지 조각을 마디마다 나눠 준다', () => {
    expect(kegCordSpan(0, 0, 3, 4, 1)).toHaveLength(1)
    expect(kegCordSpan(0, 0, 2.5, 3.5, 1)).toHaveLength(2)
    expect(kegCordSpan(0, 0, 3, 3, 1)).toEqual([])
  })
})

describe('kegTrail', () => {
  it('밀리는 반대쪽으로 처진 불티 자리를 준다', () => {
    expect(Math.hypot(kegTrail(0, 0).x, kegTrail(0, 0).y)).toBe(0)
    expect(kegTrail(-1, 0).x).toBeLessThan(0)
  })
})

describe('burstLook', () => {
  it('터짐 0.16초에 가장 밝고 0.4초에 다 가라앉는다', () => {
    expect(burstLook(0).poolOpacity).toBe(0)
    expect(burstLook(0.16)).toMatchObject({ pool: 3.1, poolOpacity: 0.26, core: 0.42, rings: 1 })
    expect(burstLook(0.4)).toMatchObject({ poolOpacity: 0, core: 0, rings: 0, sparks: 0 })
  })

  it('불티는 터진 뒤 바깥으로 퍼진다', () => {
    const near = burstSparks(0, 0, burstLook(0.16).spread)
    const far = burstSparks(0, 0, burstLook(0.28).spread)

    expect(near).toHaveLength(12)
    expect(Math.abs(far[0].x)).toBeGreaterThan(Math.abs(near[0].x))
  })
})

describe('isoEllipse', () => {
  it('칸 폭 배수 반지름의 원을 2대 1 타원으로 그린다', () => {
    const { rx, ry } = isoEllipse(1)

    expect(rx / ry).toBeCloseTo(2)
  })
})

describe('dustPuffs', () => {
  it('터지기 전과 끝난 뒤에는 보이지 않는다', () => {
    expect(dustPuffs(0, 0, 1, 0, 0).every((p) => p.opacity === 0)).toBe(true)
    expect(dustPuffs(0, 0, 1, 0, 0.4).every((p) => p.opacity === 0)).toBe(true)
  })

  it('화약통 반대쪽으로 퍼진다', () => {
    const rise = dustPuffs(0, 0, 1, 0, 0.16)[0]
    const spread = dustPuffs(0, 0, 1, 0, 0.28)[0]

    expect(rise.opacity).toBeCloseTo(0.5)
    expect(spread.x).toBeGreaterThan(rise.x)
  })
})
