import { type Page, test } from '@playwright/test'

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

const SOLUTIONS = {
  '1-1': 'up up right right right down down left',
  '1-2': 'right right right right down down down left left left left down down',
  '1-3': 'up right down down down right down down down right right right right right',
  '1-4': 'right right right right right right down down down left right right right down',
  '1-5': 'up right down down down right down right right right right down down down',
  '1-6': 'right right right right down down down down right right right down down left down',
  '1-7':
    'down down right right right left left left down down right down down right right right down',
  '1-8':
    'down down right right right right left left left left down down right right right right right right right down',
  '1-9':
    'left left left left right right right right down down left left left left left up up left left down down',
  '1-10':
    'right right down down right right right right right right right right down down down down left down down up left left left left left left left down up up left left down left',
}

// 이동 번호마다 남길 장면 이름
const PLAY_SHOTS: Record<keyof typeof SOLUTIONS, Record<number, string>> = {
  '1-1': { 0: 'start', 8: 'cleared' },
  '1-2': { 8: 'occluded' },
  '1-3': {
    0: 'start',
    3: 'box-pushed',
    4: 'box-climbed',
    7: 'zone-changed',
    8: 'occluded',
    13: 'box-stair',
  },
  '1-4': {
    0: 'start',
    1: 'bridge-filled',
    2: 'bridge-crossing',
    3: 'zone-changed',
    9: 'box-climbed',
    11: 'bridge-2',
  },
  '1-5': { 0: 'start', 9: 'high-bridge', 10: 'high-bridge-crossing', 13: 'box-stair' },
  '1-6': {
    0: 'start',
    1: 'on-switch',
    2: 'on-door',
    3: 'door-closed-behind',
    9: 'fork',
    12: 'zone-changed',
    13: 'gate-2',
  },
  '1-7': { 0: 'start', 5: 'box-on-switch', 12: 'on-door', 13: 'zone-changed' },
  '1-8': { 0: 'start', 6: 'box-on-switch', 16: 'box-on-door', 19: 'on-box' },
  '1-9': {
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
  '1-10': {
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
}

const shot = async (page: Page, name: string) => {
  await page.waitForTimeout(1200)
  await page.screenshot({ path: `e2e/.screenshots/${name}.png` })
}

const openStage = async (page: Page, start: string) => {
  await page.getByRole('button', { name: start }).click()
  await page.getByRole('button', { name: /01/ }).click()
  await page.getByText('STAGE 01').waitFor()
}

// 가이드 1단계, 방향키 막힘, 2단계, 건너뛰기 뒤를 찍는다
const shootGuide = async (page: Page, prefix: string, skip: string) => {
  await page.getByText('GUIDE 1 / 2').waitFor()
  await shot(page, `${prefix}-guide-1-cube`)

  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('ArrowUp')
  await shot(page, `${prefix}-guide-blocked`)

  if (prefix.includes('mobile')) await page.touchscreen.tap(60, 400)
  else await page.mouse.click(60, 400)
  await page.getByText('GUIDE 2 / 2').waitFor()
  await shot(page, `${prefix}-guide-2-goal`)

  await page.getByRole('button', { name: skip }).click()
  await shot(page, `${prefix}-guide-skipped`)
}

// 스테이지 2의 한 단계짜리 높이 가이드를 찍고 시작한다
const shootHeightGuide = async (page: Page, prefix: string, start: string) => {
  await page.getByText('STAGE 02').waitFor()
  await page.getByText('GUIDE 1 / 1').waitFor()
  await shot(page, `${prefix}-stage-02-guide`)
  await page.getByRole('button', { name: start, exact: true }).click()
}

// 스테이지 3의 두 단계짜리 상자 가이드를 찍고 시작한다
const shootBoxGuide = async (page: Page, prefix: string, start: string) => {
  await page.getByText('STAGE 03').waitFor()
  await page.getByText('GUIDE 1 / 2').waitFor()
  await shot(page, `${prefix}-stage-03-guide-1-box`)

  if (prefix.includes('mobile')) await page.touchscreen.tap(60, 400)
  else await page.mouse.click(60, 400)
  await page.getByText('GUIDE 2 / 2').waitFor()
  await shot(page, `${prefix}-stage-03-guide-2-restart`)

  await page.getByRole('button', { name: start, exact: true }).click()
}

// 스테이지 6의 두 단계짜리 스위치와 문 가이드를 찍고 시작한다
const shootSwitchGuide = async (page: Page, prefix: string, start: string) => {
  await page.getByText('STAGE 06').waitFor()
  await page.getByText('GUIDE 1 / 2').waitFor()
  await shot(page, `${prefix}-stage-06-guide-1-switch`)

  if (prefix.includes('mobile')) await page.touchscreen.tap(60, 400)
  else await page.mouse.click(60, 400)
  await page.getByText('GUIDE 2 / 2').waitFor()
  await shot(page, `${prefix}-stage-06-guide-2-door`)

  await page.getByRole('button', { name: start, exact: true }).click()
}

// 스테이지 9의 두 단계짜리 사다리 가이드를 찍고 시작한다
const shootLadderGuide = async (page: Page, prefix: string, start: string) => {
  await page.getByText('STAGE 09').waitFor()
  await page.getByText('GUIDE 1 / 2').waitFor()
  await shot(page, `${prefix}-stage-09-guide-1-ladder`)

  if (prefix.includes('mobile')) await page.touchscreen.tap(60, 400)
  else await page.mouse.click(60, 400)
  await page.getByText('GUIDE 2 / 2').waitFor()
  await shot(page, `${prefix}-stage-09-guide-2-climb`)

  await page.getByRole('button', { name: start, exact: true }).click()
}

// 스테이지 10의 한 단계짜리 보스 가이드를 찍고 시작한다
const shootBossGuide = async (page: Page, prefix: string, start: string) => {
  await page.getByText('STAGE 10').waitFor()
  await page.getByText('GUIDE 1 / 1').waitFor()
  await shot(page, `${prefix}-stage-10-guide-moves`)

  await page.getByRole('button', { name: start, exact: true }).click()
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

// 풀이를 두면서 정해둔 장면과 클리어 카드를 찍는다
const playStage = async (page: Page, id: keyof typeof SOLUTIONS, prefix: string) => {
  const shots = PLAY_SHOTS[id]
  await solve(page, SOLUTIONS[id], async (i) => {
    if (shots[i]) await shot(page, `${prefix}-${shots[i]}`)
  })
  await page.waitForTimeout(1600)
  await shot(page, `${prefix}-clear-card`)
}

// 스테이지 7에서 큐브가 스위치를 밟아도 문까지 닿지 못하는 것을 찍고 처음으로 되돌린다
const shootFarDoor = async (page: Page, prefix: string) => {
  await solve(page, 'down down down down right right right')
  await shot(page, `${prefix}-stage-07-switch-pressed`)

  await page.keyboard.press('ArrowRight')
  await page.waitForTimeout(320)
  await shot(page, `${prefix}-stage-07-door-closed`)

  await page.keyboard.press('r')
  await page.waitForTimeout(800)
}

// 스테이지 9에서 사다리를 타고 오르내리는 중간 프레임을 찍고 처음으로 되돌린다
const shootLadderMid = async (page: Page, prefix: string) => {
  await solve(page, 'left left')

  await page.keyboard.press('ArrowLeft')
  await page.waitForTimeout(120)
  await page.screenshot({ path: `e2e/.screenshots/${prefix}-stage-09-climb-mid.png` })
  await page.waitForTimeout(400)

  await solve(page, 'left right')
  await page.keyboard.press('ArrowRight')
  await page.waitForTimeout(130)
  await page.screenshot({ path: `e2e/.screenshots/${prefix}-stage-09-take-back-mid.png` })
  await page.waitForTimeout(500)

  await page.keyboard.press('r')
  await page.waitForTimeout(900)
}

// 배치가 갈라지는 화면 크기
const SIZES = [
  { name: '320x568', width: 320, height: 568, mobile: true },
  { name: '844x390', width: 844, height: 390, mobile: true },
  { name: '768x1024', width: 768, height: 1024, mobile: true },
  { name: '2560x1440', width: 2560, height: 1440, mobile: false },
  { name: '3440x1440', width: 3440, height: 1440, mobile: false },
]

// 1~9를 클리어한 진행. 보스가 열린다
const BOSS_OPENED = {
  version: 1,
  stages: Object.fromEntries(
    Array.from({ length: 9 }, (_, i) => [`1-${i + 1}`, { bestMoves: 8, stars: 3 }]),
  ),
}

// 1~4를 클리어한 진행. 5까지 열리고 가이드가 자동으로 뜨지 않는다
const OPENED = {
  version: 1,
  stages: {
    '1-1': { bestMoves: 8, stars: 3 },
    '1-2': { bestMoves: 13, stars: 3 },
    '1-3': { bestMoves: 14, stars: 3 },
    '1-4': { bestMoves: 14, stars: 3 },
  },
}

test('@shot 데스크톱 화면', async ({ page }) => {
  test.setTimeout(600_000)
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
  await shootGuide(page, 'desktop', LABELS.ko.skip)
  await page.keyboard.press('ArrowUp')
  await page.waitForTimeout(90)
  await page.screenshot({ path: 'e2e/.screenshots/desktop-rolling-mid.png' })
  await page.keyboard.press('r')
  await page.waitForTimeout(110)
  await page.screenshot({ path: 'e2e/.screenshots/desktop-restart-mid.png' })

  await solve(page, SOLUTIONS['1-1'], async (i) => {
    if (i === 8) {
      await page.waitForTimeout(450)
      await page.screenshot({ path: 'e2e/.screenshots/desktop-clear-effect.png' })
    }
    if (PLAY_SHOTS['1-1'][i])
      await shot(page, `desktop-play-${String(i).padStart(2, '0')}-${PLAY_SHOTS['1-1'][i]}`)
  })
  await page.waitForTimeout(1600)
  await shot(page, 'desktop-clear-card')

  await page.getByRole('button', { name: LABELS.ko.next }).click()
  await shootHeightGuide(page, 'desktop', LABELS.ko.start)
  await shot(page, 'desktop-stage-02-start')
  await playStage(page, '1-2', 'desktop-stage-02')

  await page.getByRole('button', { name: LABELS.ko.next }).click()
  await shootBoxGuide(page, 'desktop', LABELS.ko.start)
  await playStage(page, '1-3', 'desktop-stage-03')

  await page.getByRole('button', { name: LABELS.ko.next }).click()
  await page.getByText('STAGE 04').waitFor()
  await playStage(page, '1-4', 'desktop-stage-04')

  await page.getByRole('button', { name: LABELS.ko.next }).click()
  await page.getByText('STAGE 05').waitFor()
  await playStage(page, '1-5', 'desktop-stage-05')

  await page.getByRole('button', { name: LABELS.ko.next }).click()
  await shootSwitchGuide(page, 'desktop', LABELS.ko.start)
  await playStage(page, '1-6', 'desktop-stage-06')

  await page.getByRole('button', { name: LABELS.ko.next }).click()
  await page.getByText('STAGE 07').waitFor()
  await shootFarDoor(page, 'desktop')
  await playStage(page, '1-7', 'desktop-stage-07')

  await page.getByRole('button', { name: LABELS.ko.next }).click()
  await page.getByText('STAGE 08').waitFor()
  await playStage(page, '1-8', 'desktop-stage-08')

  await page.getByRole('button', { name: LABELS.ko.next }).click()
  await shootLadderGuide(page, 'desktop', LABELS.ko.start)
  await shootLadderMid(page, 'desktop')
  await playStage(page, '1-9', 'desktop-stage-09')

  await page.getByRole('button', { name: LABELS.ko.select, exact: true }).click()
  await shot(page, 'desktop-select-after-clear')

  await page.getByRole('button', { name: /01/ }).click()
  await shot(page, 'desktop-guide-none-after-clear')
})

test.describe('모바일', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

  test('@shot 모바일 화면', async ({ page }) => {
    test.setTimeout(600_000)
    await page.goto('/')
    await shot(page, 'mobile-title')

    await page.getByRole('button', { name: '한국어' }).click()
    await shot(page, 'mobile-language-menu')
    await page.keyboard.press('Escape')

    await openStage(page, LABELS.ko.start)
    await shootGuide(page, 'mobile', LABELS.ko.skip)
    await shot(page, 'mobile-play')

    await solve(page, SOLUTIONS['1-1'])
    await page.waitForTimeout(1600)
    await shot(page, 'mobile-clear-card')

    await page.getByRole('button', { name: LABELS.ko.select, exact: true }).click()
    await shot(page, 'mobile-select')

    await page.getByRole('button', { name: /02/ }).click()
    await shootHeightGuide(page, 'mobile', LABELS.ko.start)
    await shot(page, 'mobile-stage-02-play')
    await playStage(page, '1-2', 'mobile-stage-02')

    await page.getByRole('button', { name: LABELS.ko.next }).click()
    await shootBoxGuide(page, 'mobile', LABELS.ko.start)
    await playStage(page, '1-3', 'mobile-stage-03')

    await page.getByRole('button', { name: LABELS.ko.next }).click()
    await page.getByText('STAGE 04').waitFor()
    await playStage(page, '1-4', 'mobile-stage-04')

    await page.getByRole('button', { name: LABELS.ko.next }).click()
    await page.getByText('STAGE 05').waitFor()
    await playStage(page, '1-5', 'mobile-stage-05')

    await page.getByRole('button', { name: LABELS.ko.next }).click()
    await shootSwitchGuide(page, 'mobile', LABELS.ko.start)
    await playStage(page, '1-6', 'mobile-stage-06')

    await page.getByRole('button', { name: LABELS.ko.next }).click()
    await page.getByText('STAGE 07').waitFor()
    await playStage(page, '1-7', 'mobile-stage-07')

    await page.getByRole('button', { name: LABELS.ko.next }).click()
    await page.getByText('STAGE 08').waitFor()
    await playStage(page, '1-8', 'mobile-stage-08')

    await page.getByRole('button', { name: LABELS.ko.next }).click()
    await shootLadderGuide(page, 'mobile', LABELS.ko.start)
    await shootLadderMid(page, 'mobile')
    await playStage(page, '1-9', 'mobile-stage-09')
  })
})

// 보스는 한 판이 34수라 앞 스테이지 흐름과 묶지 않고 따로 찍는다
test.describe('보스', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((progress) => {
      localStorage.setItem('cubound:progress', JSON.stringify(progress))
    }, BOSS_OPENED)
  })

  test('@shot 보스 화면', async ({ page }) => {
    test.setTimeout(600_000)
    await page.goto('/')

    await page.getByRole('button', { name: LABELS.ko.start }).click()
    await shot(page, 'desktop-select-boss-open')

    await page.getByRole('button', { name: /10/ }).click()
    await shootBossGuide(page, 'desktop', LABELS.ko.start)
    await playStage(page, '1-10', 'desktop-stage-10')

    await page.getByRole('button', { name: LABELS.ko.select, exact: true }).click()
    await shot(page, 'desktop-select-boss-cleared')
  })

  // 제한을 다 쓰면 큐브가 멈추고 재시작 버튼이 진해진다
  test('@shot 보스 이동 제한', async ({ page }) => {
    test.setTimeout(300_000)
    await page.goto('/#/play/1-10')
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

  test.describe('모바일', () => {
    test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

    test('@shot 보스 모바일 화면', async ({ page }) => {
      test.setTimeout(600_000)
      await page.goto('/')

      await page.getByRole('button', { name: LABELS.ko.start }).click()
      await shot(page, 'mobile-select-boss-open')

      await page.getByRole('button', { name: /10/ }).click()
      await shootBossGuide(page, 'mobile', LABELS.ko.start)
      await playStage(page, '1-10', 'mobile-stage-10')
    })
  })
})

// 브라우저 언어가 영어면 처음부터 영어로 시작하는지 함께 본다
test.describe('영어', () => {
  test.use({ locale: 'en-US' })

  test('@shot 영어 데스크톱 화면', async ({ page }) => {
    test.setTimeout(60_000)
    await page.goto('/')
    await shot(page, 'en-desktop-title')

    await openStage(page, LABELS.en.start)
    await shootGuide(page, 'en-desktop', LABELS.en.skip)
    await shot(page, 'en-desktop-play')

    await solve(page, SOLUTIONS['1-1'])
    await page.waitForTimeout(1600)
    await shot(page, 'en-desktop-clear-card')

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
      await shootGuide(page, 'en-mobile', LABELS.en.skip)
      await shot(page, 'en-mobile-play')

      await solve(page, SOLUTIONS['1-1'])
      await page.waitForTimeout(1600)
      await shot(page, 'en-mobile-clear-card')

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
      await page.addInitScript((progress) => {
        localStorage.setItem('cubound:progress', JSON.stringify(progress))
      }, OPENED)
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
      await solve(page, SOLUTIONS['1-1'])
      await page.waitForTimeout(1600)
      await shot(page, `size-${size.name}-clear-card`)
    })
  })
}

// 키보드로 옮겨 다닐 때 포커스가 보이는 자리
test('@shot 키보드 포커스', async ({ page }) => {
  await page.addInitScript((progress) => {
    localStorage.setItem('cubound:progress', JSON.stringify(progress))
  }, OPENED)
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

  await solve(page, SOLUTIONS['1-4'])
  await page.waitForTimeout(1600)
  await shot(page, 'desktop-focus-clear-card')
})
