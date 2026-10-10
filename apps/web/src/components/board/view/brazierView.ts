import { clamp01 } from './cellView'
import { CUBE, FACES, type Vec, rotate } from './cubeView'
import { blend, shade } from './shadeView'
import { TILE } from '@/game/iso'
import type { Direction } from '@/game/types'

// 화로 돌 그릇 칸 폭 배수와 높이 px, 숯 바닥 칸 폭 배수, 그릇 불티가 오르는 높이 px
export const BRAZIER = { bowl: 0.8, height: 8, bed: 0.66, rise: 17 }

// 그릇 숯불 다섯 덩이와 노란 속불 셋의 u, v와 칸 폭 배수
export const BRAZIER_COALS = [
  [-0.14, -0.1, 0.26],
  [0.13, -0.06, 0.24],
  [-0.04, 0.14, 0.22],
  [0.12, 0.16, 0.16],
  [-0.18, 0.08, 0.14],
]
export const BRAZIER_CORES = [
  [-0.14, -0.1, 0.13],
  [0.13, -0.06, 0.12],
  [-0.04, 0.14, 0.1],
]

// 빛 띠 세 겹의 높이 비와 진하기 비, 맨 아래 띠가 가장 진한 값
const BANDS = [
  [1, 0.35],
  [0.62, 0.6],
  [0.32, 1],
]

// 큐브 옆면 빛 띠 높이 한 변 배수와 진하기, 발밑 빛 칸 폭 배수와 세기마다 커지는 몫과 진하기, 남은 수 1의 깜빡임 바닥
export const CUBE_HEAT = {
  band: 0.55,
  bandOpacity: 0.42,
  pool: 0.62,
  poolGrow: 0.3,
  poolOpacity: 0.22,
  dip: 0.7,
}

// 남은 수 1에서 0.8초마다 약해졌다 돌아오는 진행도, 세기는 flame-dip 몫
export const DIP_LOOP: Keyframe[] = [
  { '--dip-phase': 0, easing: 'ease-in-out' },
  { '--dip-phase': 1, easing: 'ease-in-out' },
  { '--dip-phase': 0 },
]
export const DIP_MS = 800

const H = CUBE / 2

const round = (v: number) => Math.round(v * 100) / 100

const points = (list: number[][]) => list.map(([x, y]) => `${round(x)},${round(y)}`).join(' ')

// 면에서 높이 c 아래 몫
const below = (face: Vec[], c: number) =>
  face.flatMap((p, i) => {
    const q = face[(i + 1) % face.length]
    const cut: Vec[] = p[2] <= c ? [p] : []
    if (p[2] <= c === q[2] <= c) return cut
    const t = (c - p[2]) / (q[2] - p[2])
    return [...cut, [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, c] as Vec]
  })

const project = ([x, y, z]: Vec) => [
  ((x - y) * TILE.width) / 2,
  ((x + y) * TILE.height) / 2 - z * TILE.height,
]

// 굴러가는 큐브 보이는 면마다 땅에서 rise 비만큼 오른 높이 아래 몫, 기운 큐브에서도 땅 쪽에 남는 빛 띠 세 겹
export const cubeHeatBands = (
  x: number,
  y: number,
  level: number,
  direction: Direction,
  angle: number,
  rise: number,
) => {
  const lift = H * (Math.abs(Math.cos(angle)) + Math.abs(Math.sin(angle)))
  const world = (v: Vec): Vec => {
    const [vx, vy, vz] = rotate(v, direction, angle)
    return [x + vx, y + vy, level * CUBE + lift + vz]
  }
  const shown = FACES.filter(({ normal }) => {
    const n = rotate(normal, direction, angle)
    return n[0] + n[1] + n[2] > 1e-6
  }).map(({ corners }) => corners.map(world))
  return BANDS.flatMap(([k, opacity]) =>
    shown
      .map((face) => below(face, level * CUBE + CUBE * rise * k))
      .filter((part) => part.length >= 3)
      .map((part) => ({ points: points(part.map(project)), opacity })),
  )
}

// 상자 두 옆면 아래에서 rise px까지 오른 빛 띠 세 겹, x, y는 상자 윗면 가운데
export const boxHeatBands = (x: number, y: number, rise: number) => {
  const hw = (TILE.width * CUBE) / 2
  const hh = hw / 2
  const bottom = y + TILE.layer
  return BANDS.flatMap(([k, opacity]) => {
    const r = rise * k
    return [
      {
        points: points([
          [x - hw, bottom],
          [x, bottom + hh],
          [x, bottom + hh - r],
          [x - hw, bottom - r],
        ]),
        opacity,
      },
      {
        points: points([
          [x, bottom + hh],
          [x + hw, bottom],
          [x + hw, bottom - r],
          [x, bottom + hh - r],
        ]),
        opacity,
      },
    ]
  })
}

// 타는 상자 진행도에서 달아오름과 부서짐의 시작과 길이, 밀려 멈출 즈음 달아오르고 잠깐 탄 뒤 부서지는 몫
const BOX_BURN_STEPS = { heat: [0.2, 0.3], crumble: [0.58, 0.42] }

// 타는 상자 0.5초 진행도에서 달아오른 정도와 재로 부서진 정도, 앞 절반은 불붙는 몫
export const boxBurn = (q: number) => {
  const heat = clamp01((q - BOX_BURN_STEPS.heat[0]) / BOX_BURN_STEPS.heat[1])
  return {
    heat: q < 0 ? 0 : heat * heat * (3 - 2 * heat),
    crumble: q < 0 ? 0 : clamp01((q - BOX_BURN_STEPS.crumble[0]) / BOX_BURN_STEPS.crumble[1]),
  }
}

// 열빛, 달아오름, 불붙음마다 상자 둘레 빛 고임 칸 폭 배수와 진하기, 옆면 빛 띠 높이 px와 진하기
const HINT = { pool: 0.92, poolOpacity: 0.06, band: 12, bandOpacity: 0.2 }
const WARM = { pool: 1.1, poolOpacity: 0.07, band: TILE.layer * 0.6, bandOpacity: 0.4 }
const BURN = { pool: 1.35, poolOpacity: 0.13, band: TILE.layer, bandOpacity: 0.5 }

const mixLook = (a: typeof HINT, b: typeof HINT, t: number) => ({
  pool: a.pool + (b.pool - a.pool) * t,
  poolOpacity: a.poolOpacity + (b.poolOpacity - a.poolOpacity) * t,
  band: a.band + (b.band - a.band) * t,
  bandOpacity: a.bandOpacity + (b.bandOpacity - a.bandOpacity) * t,
})

// 상자에 비치는 열, hint는 큐브 불이 있는 동안의 열빛 세기
export const boxHeat = (hint: number, heat: number) => {
  const faint = {
    ...HINT,
    poolOpacity: HINT.poolOpacity * hint,
    bandOpacity: HINT.bandOpacity * hint,
  }
  return heat <= 0.5 ? mixLook(faint, WARM, heat / 0.5) : mixLook(WARM, BURN, (heat - 0.5) / 0.5)
}

// 숯불빛 쪽으로 섞이는 상자 면 색, 윗면이 먼저 물드는 heat
export const boxTone = (heat: number) => ({
  top: blend(
    shade('tool', 'top'),
    blend('var(--color-heat-hot)', 'var(--color-heat-top)', 0.45),
    heat * 0.75,
  ),
  left: blend(shade('tool', 'left'), 'var(--color-heat-left)', heat * 0.8),
  right: blend(shade('tool', 'right'), 'var(--color-heat-right)', heat * 0.8),
})

// 재로 무너지는 상자에 남는 재 덩이, 둘은 아직 숯불빛
export const BOX_ASH = [
  { u: -0.15, v: -0.12, scale: 0.36, height: 12, ember: true },
  { u: 0.17, v: -0.08, scale: 0.3, height: 8, ember: false },
  { u: -0.04, v: 0.18, scale: 0.28, height: 6, ember: true },
  { u: 0.2, v: 0.2, scale: 0.2, height: 4, ember: false },
]
