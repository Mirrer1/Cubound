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

// 배치가 갈라지는 화면 크기
const SIZES = [
  { name: '320x568', width: 320, height: 568, mobile: true },
  { name: '844x390', width: 844, height: 390, mobile: true },
  { name: '768x1024', width: 768, height: 1024, mobile: true },
  { name: '2560x1440', width: 2560, height: 1440, mobile: false },
  { name: '3440x1440', width: 3440, height: 1440, mobile: false },
]

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
  test.setTimeout(300_000)
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

  await page.getByRole('button', { name: LABELS.ko.select, exact: true }).click()
  await shot(page, 'desktop-select-after-clear')

  await page.getByRole('button', { name: /01/ }).click()
  await shot(page, 'desktop-guide-none-after-clear')
})

test.describe('모바일', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

  test('@shot 모바일 화면', async ({ page }) => {
    test.setTimeout(300_000)
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
