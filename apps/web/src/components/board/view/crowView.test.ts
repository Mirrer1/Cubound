import { describe, expect, it } from 'vitest'

import {
  CROW,
  CROW_FOOT,
  crowBodyPath,
  crowLegs,
  crowPose,
  crowSeats,
  crowSide,
  crowTransform,
  crowWing,
  flockCells,
} from './crowView'

// 변환 문자열의 화면 자리와 날개 끝 자리
const place = (transform: string) => {
  const [x, y] = transform
    .match(/translate\(([-\d.]+) ([-\d.]+)\)/)!
    .slice(1)
    .map(Number)
  return { x, y }
}
const tipOf = (wing: string) => wing.split(' ')[2].split(',').map(Number)

const SEAT = crowSeats(3)[0]
const pose = (ms: number, takeoff = CROW.takeoff, side = 0) =>
  crowPose(ms, 0, takeoff, SEAT.face, side)

// 단위 길이 점의 화면 자리
const toScreen = (seat: typeof SEAT, p: ReturnType<typeof pose>, [ux, uy]: number[]) => {
  const at = place(crowTransform(seat, p))
  const a = (-p.pitch * Math.PI) / 180
  return [
    at.x + (ux * Math.cos(a) - uy * Math.sin(a)) * CROW.scale * p.facing,
    at.y + (ux * Math.sin(a) + uy * Math.cos(a)) * CROW.scale,
  ]
}

describe('crowSeats', () => {
  it('한 칸에 둘이면 두 자리, 두 칸이면 칸마다 한 마리', () => {
    expect(crowSeats(3).map((s) => s.index)).toEqual([0, 1])
    expect(crowSeats(1).map((s) => s.index)).toEqual([0])
    expect(crowSeats(2).map((s) => s.index)).toEqual([1])
  })

  it('두 마리는 서로 다른 쪽을 봄', () => {
    const [a, b] = crowSeats(3)
    expect(a.face).toBe(-b.face)
  })
})

describe('flockCells', () => {
  const heights = [
    [0, 0, 1],
    [0, 0, 0],
  ]

  it('첫 칸에 붙은 같은 높이 후보를 고르는 순서대로 하나 더함', () => {
    const cells = [
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
    ]
    expect(flockCells([cells[0]], cells, heights)).toEqual([
      { x: 1, y: 0 },
      { x: 1, y: 1 },
    ])
  })

  it('붙은 후보가 없으면 한 칸', () => {
    const cells = [
      { x: 0, y: 0 },
      { x: 2, y: 0 },
    ]
    expect(flockCells([cells[0]], cells, heights)).toEqual([{ x: 0, y: 0 }])
    expect(flockCells([], [], heights)).toEqual([])
  })

  it('together면 붙은 후보가 있어도 한 칸', () => {
    const cells = [
      { x: 1, y: 0 },
      { x: 1, y: 1 },
    ]
    expect(flockCells([cells[0]], cells, heights, true)).toEqual([{ x: 1, y: 0 }])
  })
})

describe('crowSide', () => {
  it('큐브가 옆 칸이면 화면에서 큐브 반대쪽', () => {
    expect(crowSide([{ x: 3, y: 1 }], { x: 2, y: 1 }, true)).toBe(1)
    expect(crowSide([{ x: 3, y: 1 }], { x: 4, y: 1 }, true)).toBe(-1)
    expect(crowSide([{ x: 3, y: 1 }], { x: 3, y: 0 }, true)).toBe(-1)
  })

  it('큐브가 멀거나 화면에서 바로 앞뒤면 0, 각자 보던 쪽', () => {
    expect(crowSide([{ x: 3, y: 1 }], { x: 0, y: 0 }, false)).toBe(0)
    expect(crowSide([{ x: 3, y: 2 }], { x: 4, y: 3 }, true)).toBe(0)
  })
})

describe('crowPose', () => {
  it('보는 쪽 뒤 위에서 날갯짓하며 1초에 걸쳐 짙어지며 내려와 날개를 접고 앉음', () => {
    const first = pose(0)
    expect(first).toMatchObject({ opacity: 0, z: CROW.from.z, fold: 0, perch: 0 })
    expect(first.x).toBe(-SEAT.face * CROW.from.x)
    expect(pose(500).fold).toBe(0)
    expect(pose(1000)).toMatchObject({ opacity: 1, x: 0, z: 0, fold: 1, perch: 1 })
    expect(pose(1000).pitch).toBe(CROW.pitch.sit)
  })

  it('둘째는 0.15초 늦게 날아옴', () => {
    expect(crowPose(150, 1, CROW.takeoff, 1, 0).opacity).toBe(0)
    expect(crowPose(1150, 1, CROW.takeoff, 1, 0).fold).toBe(1)
  })

  it('머묾 동안 번갈아 갸웃과 까악, 겹치지 않음', () => {
    for (let ms = 1150; ms < CROW.takeoff; ms += 10) {
      const a = crowPose(ms, 0, CROW.takeoff, -1, 0)
      const b = crowPose(ms, 1, CROW.takeoff, 1, 0)
      const busy = [a.tilt, a.caw, b.tilt, b.caw].filter((v) => v > 0)
      expect(busy.length).toBeLessThanOrEqual(1)
    }
    expect(pose(1950).tilt).toBe(1)
    expect(crowPose(2650, 1, CROW.takeoff, 1, 0).caw).toBeCloseTo(1)
    expect(pose(3350).caw).toBeCloseTo(1)
  })

  it('3초 머문 뒤 보던 쪽으로 스스로 날아가고 둘째는 0.05초 뒤', () => {
    const t = CROW.takeoff
    expect(pose(t).z).toBe(0)
    expect(pose(t + 40).z).toBeGreaterThan(0)
    expect(crowPose(t + 40, 1, t, 1, 0).z).toBe(0)
    expect(Math.sign(pose(t + 400).x)).toBe(SEAT.face)
  })

  it('떠나는 순간 접힌 날개를 0.1초에 올림까지 펴고 다리를 거둠', () => {
    expect(pose(CROW.takeoff).fold).toBe(1)
    const up = pose(CROW.takeoff + 100)
    expect(up.fold).toBe(0)
    expect(up.flap).toBeCloseTo(-1)
    expect(pose(CROW.takeoff + 150).perch).toBe(0)
  })

  it('큐브 반대쪽으로 날면 0.2초에 몸을 돌림', () => {
    const away = -SEAT.face
    expect(pose(2000, 2000, away).facing).toBe(SEAT.face)
    expect(pose(2200, 2000, away).facing).toBe(away)
    expect(Math.sign(pose(2600, 2000, away).x)).toBe(away)
  })

  it('0.8초에 옅어져 사라지고 그림자도 오르며 옅어짐', () => {
    expect(pose(2000 + 550, 2000).opacity).toBe(1)
    expect(pose(2000 + 800, 2000).opacity).toBe(0)
    expect(pose(2000 + 300, 2000).shadow).toBeLessThan(CROW.shadow.opacity)
    expect(pose(2000).shadow).toBe(CROW.shadow.opacity)
  })

  it('한 번은 5초 안에 끝남', () => {
    expect(CROW.life).toBe(5000)
    expect(crowPose(CROW.life, 1, CROW.takeoff, 1, 0).opacity).toBe(0)
  })
})

// 16ms마다 몸 자리와 두 날개 끝이 가장 크게 옮겨 간 화면 px
const biggestJump = (from: number, to: number, takeoff: number, side = 0) => {
  let last: number[][] | null = null
  let top = 0
  for (let ms = from; ms <= to; ms += 16) {
    const p = pose(ms, takeoff, side)
    const now = [
      toScreen(SEAT, p, [0, 0]),
      ...(['near', 'far'] as const).map((w) =>
        toScreen(SEAT, p, tipOf(crowWing(w, p.flap, p.fold, p.perch))),
      ),
    ]
    if (last) {
      const prev = last
      now.forEach(([x, y], i) => {
        top = Math.max(top, Math.hypot(x - prev[i][0], y - prev[i][1]))
      })
    }
    last = now
  }
  return top
}

describe('툭 바뀌는 프레임', () => {
  it('날아와 앉기, 떠나기, 날아오다 큐브 옆에서 떠나기 모두 한 프레임에 6px 미만', () => {
    expect(biggestJump(0, 1200, CROW.takeoff)).toBeLessThan(6)
    expect(biggestJump(CROW.takeoff - 100, CROW.takeoff + 800, CROW.takeoff)).toBeLessThan(6)
    expect(biggestJump(400, 1400, 600, -SEAT.face)).toBeLessThan(6)
  })
})

describe('그림', () => {
  it('몸은 닫힌 path 하나, 갸웃과 까악에 머리만 바뀜', () => {
    const still = crowBodyPath(0, 0)
    expect(still.match(/M/g)).toHaveLength(1)
    expect(crowBodyPath(1, 0)).not.toBe(still)
    expect(crowBodyPath(0, 1)).not.toBe(still)
    const torso = (path: string) => path.split(' ').slice(7, 19).join(' ')
    expect(torso(crowBodyPath(1, 1))).toBe(torso(still))
  })

  it('땅에 서면 꼬리 끝이 발보다 위', () => {
    const tail = crowBodyPath(0, 0).split(' ')[13].split(',').map(Number)
    expect(tail[1]).toBeLessThan(CROW_FOOT[1] - 0.1)
  })

  it('날개는 올림과 내림과 접힘에 끝이 다른 자리', () => {
    expect(crowWing('near', -1, 0, 0)).not.toBe(crowWing('near', 1, 0, 0))
    expect(tipOf(crowWing('near', 1, 1, 1))).toEqual(tipOf(crowWing('near', -1, 1, 1)))
    expect(crowWing('far', 0, 0, 0)).toMatch(/^M.*Z$/)
  })

  // 다리 하나의 엉덩이와 발끝 가운데 자리
  const legEnds = (path: string, i: number) => {
    const xy = [...path.split('Z')[i * 2].matchAll(/(-?[\d.]+),(-?[\d.]+)/g)].map((hit) => [
      Number(hit[1]),
      Number(hit[2]),
    ])
    return {
      hip: [(xy[0][0] + xy[1][0]) / 2, (xy[0][1] + xy[1][1]) / 2],
      foot: [(xy[2][0] + xy[3][0]) / 2, (xy[2][1] + xy[3][1]) / 2],
    }
  }

  it('서면 배 안에서 곧게 내려온 가는 다리 둘이 벌어져 있고 발끝이 앉은 높이', () => {
    const legs = crowLegs(1)
    expect(legs.match(/M/g)).toHaveLength(4)
    const [a, b] = [legEnds(legs, 0), legEnds(legs, 1)]
    expect(b.foot[0] - a.foot[0]).toBeGreaterThan(0.12)
    expect(a.hip[1]).toBeLessThan(0.11)
    expect(a.foot[1]).toBeCloseTo(CROW_FOOT[1])
    expect(a.foot[0]).toBeGreaterThan(a.hip[0])
  })

  it('날면 두 다리가 배 밑에서 꼬리 쪽으로 접힘', () => {
    const legs = crowLegs(0)
    for (const i of [0, 1]) {
      const { hip, foot } = legEnds(legs, i)
      expect(foot[0]).toBeLessThan(hip[0] - 0.15)
      expect(foot[1]).toBeGreaterThan(hip[1])
      expect(foot[1]).toBeLessThan(hip[1] + 0.07)
    }
  })

  it('앉으면 발끝이 앉은 자리', () => {
    const [x, y] = toScreen(SEAT, pose(2000), CROW_FOOT)
    expect(x).toBeCloseTo(SEAT.x, 0)
    expect(y).toBeCloseTo(SEAT.y, 0)
  })
})
