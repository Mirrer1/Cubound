import { type Page, test } from '@playwright/test'

const KEYS = {
  up: 'ArrowUp',
  right: 'ArrowRight',
  down: 'ArrowDown',
  left: 'ArrowLeft',
} as const

// 브라우저 언어로 고른 화면 문구
const LABELS = {
  ko: { start: '시작', skip: '건너뛰기', select: '스테이지' },
  en: { start: 'Start', skip: 'Skip', select: 'Stages' },
}

// 스테이지별 풀이와 1-1에서 캡처할 이동 번호
const SOLUTIONS = {
  '1-1': 'up up right right right down down left',
  '1-2': 'right right right right down down down left left left left down down',
}
const PLAY_SHOTS: Record<number, string> = {
  0: 'start',
  8: 'cleared',
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

test('@shot 데스크톱 화면', async ({ page }) => {
  test.setTimeout(150_000)
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
    if (PLAY_SHOTS[i])
      await shot(page, `desktop-play-${String(i).padStart(2, '0')}-${PLAY_SHOTS[i]}`)
  })
  await page.waitForTimeout(1600)
  await shot(page, 'desktop-clear-card')

  await page.getByRole('button', { name: '다음 스테이지' }).click()
  await shootHeightGuide(page, 'desktop', LABELS.ko.start)
  await shot(page, 'desktop-stage-02-start')
  await solve(page, SOLUTIONS['1-2'], async (i) => {
    // 앞쪽 둔덕이 큐브를 가리는 자리
    if (i === 8) await shot(page, 'desktop-stage-02-occluded')
  })
  await page.waitForTimeout(1600)
  await shot(page, 'desktop-stage-02-clear-card')

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
    await solve(page, SOLUTIONS['1-2'])
    await page.waitForTimeout(1600)
    await shot(page, 'mobile-stage-02-clear-card')
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
