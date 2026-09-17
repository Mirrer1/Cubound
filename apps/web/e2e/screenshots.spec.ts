import { type Page, test } from '@playwright/test'

const KEYS = {
  up: 'ArrowUp',
  right: 'ArrowRight',
  down: 'ArrowDown',
  left: 'ArrowLeft',
} as const

// 임시 스테이지 1-1의 풀이와 캡처할 이동 번호
const SOLUTION =
  'right up right right right right left left left up left left up right right right right right right right right right'
const PLAY_SHOTS: Record<number, string> = {
  0: 'start',
  1: 'ladder-carried',
  6: 'switch-pressed',
  15: 'box-climbed',
  17: 'gap-filled',
  21: 'ladder-placed',
  22: 'cleared',
}

const shot = async (page: Page, name: string) => {
  await page.waitForTimeout(1200)
  await page.screenshot({ path: `e2e/.screenshots/${name}.png` })
}

const openStage = async (page: Page) => {
  await page.getByRole('button', { name: '시작' }).click()
  await page.getByRole('button', { name: /01/ }).click()
  await page.getByText('STAGE 01').waitFor()
}

// 가이드 1단계, 방향키 막힘, 2단계, 건너뛰기 뒤를 찍는다
const shootGuide = async (page: Page, prefix: string) => {
  await page.getByText('GUIDE 1 / 2').waitFor()
  await shot(page, `${prefix}-guide-1-cube`)

  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('ArrowUp')
  await shot(page, `${prefix}-guide-blocked`)

  if (prefix === 'mobile') await page.touchscreen.tap(60, 400)
  else await page.mouse.click(60, 400)
  await page.getByText('GUIDE 2 / 2').waitFor()
  await shot(page, `${prefix}-guide-2-goal`)

  await page.getByRole('button', { name: '건너뛰기' }).click()
  await shot(page, `${prefix}-guide-skipped`)
}

const solve = async (page: Page, onMove?: (index: number) => Promise<void>) => {
  const moves = SOLUTION.split(' ') as (keyof typeof KEYS)[]
  for (let i = 0; i <= moves.length; i++) {
    await onMove?.(i)
    if (i < moves.length) {
      await page.keyboard.press(KEYS[moves[i]])
      await page.waitForTimeout(320)
    }
  }
}

test('@shot 데스크톱 화면', async ({ page }) => {
  test.setTimeout(90_000)
  await page.goto('/')
  await shot(page, 'desktop-title')

  await page.getByRole('button', { name: '시작' }).click()
  await shot(page, 'desktop-select')

  await page.setViewportSize({ width: 1280, height: 520 })
  await shot(page, 'desktop-select-short')
  await page.setViewportSize({ width: 1280, height: 800 })

  await page.getByRole('button', { name: /01/ }).click()
  await page.getByText('STAGE 01').waitFor()
  await shootGuide(page, 'desktop')
  await page.keyboard.press('ArrowRight')
  await page.waitForTimeout(90)
  await page.screenshot({ path: 'e2e/.screenshots/desktop-rolling-mid.png' })
  await page.keyboard.press('r')

  await solve(page, async (i) => {
    if (i === 16) await shot(page, 'desktop-camera-zone-b')
    if (i === 22) {
      await page.waitForTimeout(450)
      await page.screenshot({ path: 'e2e/.screenshots/desktop-clear-effect.png' })
    }
    if (PLAY_SHOTS[i])
      await shot(page, `desktop-play-${String(i).padStart(2, '0')}-${PLAY_SHOTS[i]}`)
  })
  await page.waitForTimeout(1600)
  await shot(page, 'desktop-clear-card')

  await page.getByRole('button', { name: '스테이지 선택' }).click()
  await shot(page, 'desktop-select-after-clear')

  await page.getByRole('button', { name: /01/ }).click()
  await shot(page, 'desktop-guide-none-after-clear')
})

test.describe('모바일', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

  test('@shot 모바일 화면', async ({ page }) => {
    await page.goto('/')
    await shot(page, 'mobile-title')

    await openStage(page)
    await shootGuide(page, 'mobile')
    await shot(page, 'mobile-play')

    await solve(page)
    await page.waitForTimeout(1600)
    await shot(page, 'mobile-clear-card')

    await page.getByRole('button', { name: '스테이지 선택' }).click()
    await shot(page, 'mobile-select')
  })
})
