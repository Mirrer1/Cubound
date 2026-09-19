import { type Page, test } from '@playwright/test'

// 캡처는 서로 기대지 않아 나눠 돌린다
test.describe.configure({ mode: 'parallel' })

const KEYS = {
  up: 'ArrowUp',
  right: 'ArrowRight',
  down: 'ArrowDown',
  left: 'ArrowLeft',
} as const

// 브라우저 언어로 고른 화면 문구
const LABELS = {
  ko: { start: '시작', skip: '건너뛰기', select: '목록', next: '다음 스테이지' },
  en: { start: 'Start', skip: 'Skip', select: 'All stages' },
}

interface StageShots {
  solution: string
  guide?: string[] // 가이드 단계마다 남길 장면 이름
  shots: Record<number, string> // 이동 번호 → 장면 이름
  extra?: (page: Page, prefix: string) => Promise<void> // 풀이 전에 따로 찍고 처음으로 되돌리는 장면
}

// 이동 0.24~0.32초, 구역 카메라 0.6초, 가이드 등장 0.5초가 끝나기를 기다린다
const SETTLE = 600
// 클리어 카드는 1.3초 뒤에 떠서 0.4초에 걸쳐 나타난다
const CARD = 2200

const shot = async (page: Page, name: string, settle = SETTLE) => {
  await page.waitForTimeout(settle)
  await page.screenshot({ path: `e2e/.screenshots/${name}.png` })
}

const solve = async (page: Page, solution: string, onMove?: (index: number) => Promise<void>) => {
  const moves = solution.split(' ') as (keyof typeof KEYS)[]
  for (let i = 0; i <= moves.length; i++) {
    await onMove?.(i)
    if (i < moves.length) {
      await page.keyboard.press(KEYS[moves[i]])
      await page.waitForTimeout(320)
    }
  }
}

// 스테이지 7에서 큐브가 스위치를 밟아도 문까지 닿지 못하는 것을 찍고 처음으로 되돌린다
const shootFarDoor = async (page: Page, prefix: string) => {
  await solve(page, 'down down down down right right right')
  await shot(page, `${prefix}-switch-pressed`)

  await page.keyboard.press('ArrowRight')
  await page.waitForTimeout(320)
  await shot(page, `${prefix}-door-closed`)

  await page.keyboard.press('r')
  await page.waitForTimeout(800)
}

// 스테이지 9에서 사다리를 타고 오르내리는 중간 프레임을 찍고 처음으로 되돌린다
const shootLadderMid = async (page: Page, prefix: string) => {
  await solve(page, 'left left')

  await page.keyboard.press('ArrowLeft')
  await page.waitForTimeout(120)
  await page.screenshot({ path: `e2e/.screenshots/${prefix}-climb-mid.png` })
  await page.waitForTimeout(400)

  await solve(page, 'left right')
  await page.keyboard.press('ArrowRight')
  await page.waitForTimeout(130)
  await page.screenshot({ path: `e2e/.screenshots/${prefix}-take-back-mid.png` })
  await page.waitForTimeout(500)

  await page.keyboard.press('r')
  await page.waitForTimeout(900)
}

// 스테이지가 늘면 코드가 아니라 이 표에만 줄을 더한다
const STAGES: Record<string, StageShots> = {
  '1-1': {
    solution: 'up up right right right down down left',
    guide: ['guide-1-cube', 'guide-2-goal'],
    shots: { 0: 'start', 8: 'cleared' },
  },
  '1-2': {
    solution: 'right right right right down down down left left left left down down',
    guide: ['guide'],
    shots: { 0: 'start', 8: 'occluded' },
  },
  '1-3': {
    solution: 'up right down down down right down down down right right right right right',
    guide: ['guide-1-box', 'guide-2-restart'],
    shots: {
      0: 'start',
      3: 'box-pushed',
      4: 'box-climbed',
      7: 'zone-changed',
      8: 'occluded',
      13: 'box-stair',
    },
  },
  '1-4': {
    solution: 'right right right right right right down down down left right right right down',
    shots: {
      0: 'start',
      1: 'bridge-filled',
      2: 'bridge-crossing',
      3: 'zone-changed',
      9: 'box-climbed',
      11: 'bridge-2',
    },
  },
  '1-5': {
    solution: 'up right down down down right down right right right right down down down',
    shots: { 0: 'start', 9: 'high-bridge', 10: 'high-bridge-crossing', 13: 'box-stair' },
  },
  '1-6': {
    solution: 'right right right right down down down down right right right down down left down',
    guide: ['guide-1-switch', 'guide-2-door'],
    shots: {
      0: 'start',
      1: 'on-switch',
      2: 'on-door',
      3: 'door-closed-behind',
      9: 'fork',
      12: 'zone-changed',
      13: 'gate-2',
    },
  },
  '1-7': {
    solution:
      'down down right right right left left left down down right down down right right right down',
    shots: { 0: 'start', 5: 'box-on-switch', 12: 'on-door', 13: 'zone-changed' },
    extra: shootFarDoor,
  },
  '1-8': {
    solution:
      'down down right right right right left left left left down down right right right right right right right down',
    shots: { 0: 'start', 6: 'box-on-switch', 16: 'box-on-door', 19: 'on-box' },
  },
  '1-9': {
    solution:
      'left left left left right right right right down down left left left left left up up left left down down',
    guide: ['guide-1-ladder', 'guide-2-climb'],
    shots: {
      0: 'start',
      1: 'ladder-carried',
      2: 'ladder-leaning',
      3: 'ladder-climbed',
      4: 'box-dropped',
      6: 'ladder-taken-back',
      15: 'zone-kept',
      17: 'on-box-with-ladder',
      20: 'ladder-at-goal',
    },
    extra: shootLadderMid,
  },
  '1-10': {
    solution:
      'right right down down right right right right right right right right down down down down left down down up left left left left left left left down up up left left down left',
    guide: ['guide-moves'],
    shots: {
      0: 'start',
      5: 'box-stair',
      8: 'zone-2',
      10: 'bridge',
      13: 'bridge-2',
      16: 'zone-3',
      19: 'ladder-carried',
      21: 'ladder-leaning',
      22: 'ladder-climbed',
      25: 'zone-4',
      28: 'door-opened',
      33: 'on-door',
    },
  },
  '2-1': {
    solution: 'right down left down right down down right',
    shots: { 0: 'start', 1: 'long-slide', 3: 'on-ground', 7: 'goal-lined-up', 8: 'cleared' },
    guide: ['guide-ice'],
  },
  '2-2': {
    solution: 'left down left down right right up left up right down left down down down',
    shots: {
      0: 'start',
      4: 'before-sled',
      5: 'box-bridge',
      6: 'zone-changed',
      13: 'box-step',
      14: 'on-box',
      15: 'cleared',
    },
  },
  '2-3': {
    solution: 'right down right down left up right down down right down left up right down',
    shots: {
      0: 'start',
      1: 'long-slide',
      5: 'above-trap',
      7: 'ledge-edge',
      8: 'dropped',
      12: 'lower-slide',
      15: 'cleared',
    },
  },
  '2-4': {
    solution: 'right up up up up left left left down down down right right right down left down',
    shots: {
      0: 'start',
      1: 'slid-past-switch',
      10: 'box-on-switch',
      11: 'on-box',
      13: 'on-door',
      17: 'cleared',
    },
  },
}

const stageNumber = (id: string) => String(Number(id.split('-')[1])).padStart(2, '0')

// 해시만 바꾸면 페이지를 다시 읽지 않아 심어 둔 진행이 반영되지 않는다. 쿼리를 달아 새로 읽게 한다
const openPlay = async (page: Page, id: string) => {
  await page.goto(`/?stage=${id}#/play/${id}`)
  await page.getByText(`STAGE ${stageNumber(id)}`).waitFor()
}

const order = (id: string) => {
  const [world, number] = id.split('-').map(Number)
  return world * 100 + number
}

// 앞 스테이지까지 클리어한 진행을 심는다. 그 스테이지와 월드가 열리고 가이드가 자동으로 뜬다
const unlock = async (page: Page, id: string) => {
  const cleared = Object.keys(STAGES)
    .filter((key) => order(key) < order(id))
    .map((key) => [key, { bestMoves: 8, stars: 3 }])
  await page.addInitScript((stages) => {
    localStorage.setItem('cubound:progress', JSON.stringify({ version: 1, stages }))
  }, Object.fromEntries(cleared))
}

const tap = async (page: Page, prefix: string) => {
  if (prefix.includes('mobile')) await page.touchscreen.tap(60, 400)
  else await page.mouse.click(60, 400)
}

// 가이드 단계를 차례로 찍고 시작한다
const shootGuide = async (page: Page, prefix: string, names: string[] = []) => {
  if (names.length === 0) return

  for (const [i, name] of names.entries()) {
    await page.getByText(`GUIDE ${i + 1} / ${names.length}`).waitFor()
    await shot(page, `${prefix}-${name}`)
    if (i < names.length - 1) await tap(page, prefix)
  }
  await page.getByRole('button', { name: LABELS.ko.start, exact: true }).click()
}

// 풀이를 두면서 정해둔 장면과 클리어 카드를 찍는다
const playStage = async (page: Page, id: string, prefix: string) => {
  const { solution, shots } = STAGES[id]
  await solve(page, solution, async (i) => {
    if (shots[i]) await shot(page, `${prefix}-${shots[i]}`)
  })
  await shot(page, `${prefix}-clear-card`, CARD)
}

const openStage = async (page: Page, start: string) => {
  await page.getByRole('button', { name: start }).click()
  await page.getByRole('button', { name: /01/ }).click()
  await page.getByText('STAGE 01').waitFor()
}

// 스테이지 1 가이드는 방향키가 막히는 모습과 건너뛴 뒤까지 함께 찍는다
const shootFirstGuide = async (page: Page, prefix: string, skip: string) => {
  await page.getByText('GUIDE 1 / 2').waitFor()
  await shot(page, `${prefix}-guide-1-cube`)

  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('ArrowUp')
  await shot(page, `${prefix}-guide-blocked`)

  await tap(page, prefix)
  await page.getByText('GUIDE 2 / 2').waitFor()
  await shot(page, `${prefix}-guide-2-goal`)

  await page.getByRole('button', { name: skip }).click()
  await shot(page, `${prefix}-guide-skipped`)
}

// 배치가 갈라지는 화면 크기
const SIZES = [
  { name: '320x568', width: 320, height: 568, mobile: true },
  { name: '844x390', width: 844, height: 390, mobile: true },
  { name: '768x1024', width: 768, height: 1024, mobile: true },
  { name: '2560x1440', width: 2560, height: 1440, mobile: false },
  { name: '3440x1440', width: 3440, height: 1440, mobile: false },
]

test('@shot 데스크톱 화면', async ({ page }) => {
  test.setTimeout(120_000)
  await page.goto('/')
  await shot(page, 'desktop-title')

  await page.getByRole('button', { name: '한국어' }).click()
  await shot(page, 'desktop-language-menu')
  await page.keyboard.press('Escape')

  await page.getByRole('button', { name: LABELS.ko.start }).click()
  await shot(page, 'desktop-select')

  await page.setViewportSize({ width: 1280, height: 520 })
  await shot(page, 'desktop-select-short')
  await page.setViewportSize({ width: 1280, height: 800 })

  await page.getByRole('button', { name: /01/ }).click()
  await page.getByText('STAGE 01').waitFor()
  await shootFirstGuide(page, 'desktop', LABELS.ko.skip)
  await page.keyboard.press('ArrowUp')
  await page.waitForTimeout(90)
  await page.screenshot({ path: 'e2e/.screenshots/desktop-rolling-mid.png' })
  await page.keyboard.press('r')
  await page.waitForTimeout(110)
  await page.screenshot({ path: 'e2e/.screenshots/desktop-restart-mid.png' })

  await solve(page, STAGES['1-1'].solution, async (i) => {
    const last = i === 8
    if (last) {
      await page.waitForTimeout(450)
      await page.screenshot({ path: 'e2e/.screenshots/desktop-clear-effect.png' })
    }
    if (STAGES['1-1'].shots[i])
      await shot(
        page,
        `desktop-play-${String(i).padStart(2, '0')}-${STAGES['1-1'].shots[i]}`,
        last ? CARD : SETTLE,
      )
  })
  await shot(page, 'desktop-clear-card', CARD)

  await page.getByRole('button', { name: LABELS.ko.select, exact: true }).click()
  await shot(page, 'desktop-select-after-clear')

  await page.getByRole('button', { name: /01/ }).click()
  await shot(page, 'desktop-guide-none-after-clear')
})

test.describe('모바일', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

  test('@shot 모바일 화면', async ({ page }) => {
    test.setTimeout(120_000)
    await page.goto('/')
    await shot(page, 'mobile-title')

    await page.getByRole('button', { name: '한국어' }).click()
    await shot(page, 'mobile-language-menu')
    await page.keyboard.press('Escape')

    await openStage(page, LABELS.ko.start)
    await shootFirstGuide(page, 'mobile', LABELS.ko.skip)
    await shot(page, 'mobile-play')

    await solve(page, STAGES['1-1'].solution)
    await shot(page, 'mobile-clear-card', CARD)

    await page.getByRole('button', { name: LABELS.ko.select, exact: true }).click()
    await shot(page, 'mobile-select')
  })
})

// 제한을 다 쓰면 큐브가 멈추고 재시작 버튼이 진해진다
test('@shot 보스 이동 제한', async ({ page }) => {
  test.setTimeout(120_000)
  await unlock(page, '1-10')
  await page.goto('/')

  await page.getByRole('button', { name: LABELS.ko.start }).click()
  await shot(page, 'desktop-select-boss-open')

  await openPlay(page, '1-10')
  await page.getByRole('button', { name: LABELS.ko.start, exact: true }).click()

  const left = page.locator('[data-guide="moves"] span').last()
  for (let i = 0; i < 80 && (await left.textContent()) !== '0'; i++) {
    await page.keyboard.press(i % 2 === 0 ? 'ArrowRight' : 'ArrowLeft')
    await page.waitForTimeout(300)
  }
  await shot(page, 'desktop-stage-10-moves-zero')

  await page.keyboard.press('ArrowRight')
  await shot(page, 'desktop-stage-10-moves-zero-blocked')
})

// 브라우저 언어가 영어면 처음부터 영어로 시작하는지 함께 본다
test.describe('영어', () => {
  test.use({ locale: 'en-US' })

  test('@shot 영어 데스크톱 화면', async ({ page }) => {
    test.setTimeout(60_000)
    await page.goto('/')
    await shot(page, 'en-desktop-title')

    await openStage(page, LABELS.en.start)
    await shootFirstGuide(page, 'en-desktop', LABELS.en.skip)
    await shot(page, 'en-desktop-play')

    await solve(page, STAGES['1-1'].solution)
    await shot(page, 'en-desktop-clear-card', CARD)

    await page.getByRole('button', { name: LABELS.en.select, exact: true }).click()
    await shot(page, 'en-desktop-select')
  })

  test.describe('모바일', () => {
    test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

    test('@shot 영어 모바일 화면', async ({ page }) => {
      test.setTimeout(60_000)
      await page.goto('/')
      await shot(page, 'en-mobile-title')

      await openStage(page, LABELS.en.start)
      await shootFirstGuide(page, 'en-mobile', LABELS.en.skip)
      await shot(page, 'en-mobile-play')

      await solve(page, STAGES['1-1'].solution)
      await shot(page, 'en-mobile-clear-card', CARD)

      await page.getByRole('button', { name: LABELS.en.select, exact: true }).click()
      await shot(page, 'en-mobile-select')
    })
  })
})

for (const size of SIZES) {
  test.describe(size.name, () => {
    test.use({
      viewport: { width: size.width, height: size.height },
      hasTouch: size.mobile,
      isMobile: size.mobile,
    })

    test(`@shot ${size.name} 화면`, async ({ page }) => {
      test.setTimeout(120_000)
      await unlock(page, '1-5')
      await page.goto('/')

      await page.getByRole('button', { name: LABELS.ko.start }).click()
      await shot(page, `size-${size.name}-select`)

      await page.getByRole('button', { name: /01/ }).click()
      await page.getByText('STAGE 01').waitFor()
      await shot(page, `size-${size.name}-play`)

      await page.getByRole('button', { name: /^\?/ }).click()
      await page.getByText('GUIDE 1 / 2').waitFor()
      await shot(page, `size-${size.name}-guide`)

      await page.getByRole('button', { name: LABELS.ko.skip }).click()
      await solve(page, STAGES['1-1'].solution)
      await shot(page, `size-${size.name}-clear-card`, CARD)
    })
  })
}

// 키보드로 옮겨 다닐 때 포커스가 보이는 자리
test('@shot 키보드 포커스', async ({ page }) => {
  await unlock(page, '1-5')
  await page.goto('/')
  await page.getByRole('button', { name: LABELS.ko.start }).waitFor()

  await page.keyboard.press('Tab')
  await page.keyboard.press('Tab')
  await shot(page, 'desktop-focus-title')

  await page.keyboard.press('Enter')
  await page.getByText('WORLD 1').waitFor()
  await shot(page, 'desktop-focus-select-now')

  await page.keyboard.press('ArrowLeft')
  await shot(page, 'desktop-focus-select-moved')

  await page.keyboard.press('Enter')
  await page.getByText('STAGE 04').waitFor()
  await page.keyboard.press('Tab')
  await shot(page, 'desktop-focus-play')

  await solve(page, STAGES['1-4'].solution)
  await shot(page, 'desktop-focus-clear-card', CARD)
})

// 스테이지마다 한 판을 두며 장면을 남긴다. 1은 데스크톱 화면 테스트가 이미 찍는다
for (const id of Object.keys(STAGES).filter((key) => key !== '1-1')) {
  test(`@shot-stage ${id} 데스크톱`, async ({ page }) => {
    test.setTimeout(120_000)
    const prefix = `desktop-stage-${id}`

    await unlock(page, id)
    await openPlay(page, id)
    await shootGuide(page, prefix, STAGES[id].guide)
    await STAGES[id].extra?.(page, prefix)
    await playStage(page, id, prefix)
  })
}

// 모바일은 맵마다 배율이 달라 시작 화면과 가이드만 본다
test.describe('모바일 스테이지', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

  test('@shot-stage 모바일 스테이지', async ({ page }) => {
    test.setTimeout(120_000)

    for (const id of Object.keys(STAGES)) {
      const prefix = `mobile-stage-${id}`

      await unlock(page, id)
      await openPlay(page, id)
      await shootGuide(page, prefix, STAGES[id].guide)
      await shot(page, `${prefix}-start`)
    }
  })
})
