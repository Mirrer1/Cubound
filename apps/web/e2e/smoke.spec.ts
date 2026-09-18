import { type Page, expect, test } from '@playwright/test'

// Playwright에 터치 드래그가 없어 CDP로 직접 보낸다
const swipe = async (page: Page, x: number, y: number, dx: number, dy: number) => {
  const cdp = await page.context().newCDPSession(page)
  const send = (type: string, points: { x: number; y: number }[]) =>
    cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points })

  await send('touchStart', [{ x, y }])
  await send('touchMove', [{ x: x + dx / 2, y: y + dy / 2 }])
  await send('touchMove', [{ x: x + dx, y: y + dy }])
  await send('touchEnd', [])
  await cdp.detach()
}

test('타이틀에서 스테이지를 골라 가이드를 넘기고 방향키로 이동하고 재시작한다', async ({
  page,
}) => {
  await page.goto('/')

  await page.getByRole('button', { name: '시작' }).click()
  await page.getByRole('button', { name: /01/ }).click()
  await expect(page.getByText('STAGE 01')).toBeVisible()

  const moves = page.getByText('MOVES').locator('..')
  await expect(page.getByText('GUIDE 1 / 2')).toBeVisible()
  await page.keyboard.press('ArrowUp')
  await page.keyboard.press('r')
  await expect(moves).toContainText('0')

  await page.keyboard.press('Enter')
  await expect(page.getByText('GUIDE 2 / 2')).toBeVisible()
  await page.keyboard.press('Enter')
  await expect(page.getByText(/GUIDE/)).toBeHidden()

  await page.keyboard.press('ArrowUp')
  await expect(moves).toContainText('1')

  await page.keyboard.press('r')
  await expect(moves).toContainText('0')
})

test('타이틀에서 언어를 영어로 바꾸면 문구와 html lang이 바뀐다', async ({ page }) => {
  await page.goto('/')

  await page.getByRole('button', { name: '한국어' }).click()
  await page.getByRole('button', { name: 'English' }).click()

  await expect(page.getByRole('button', { name: 'Start' })).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')

  await page.reload()
  await expect(page.getByRole('button', { name: 'Start' })).toBeVisible()
})

test.describe('모바일', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

  test('가이드 중에는 스와이프가 막히고 탭으로 넘긴 뒤 스와이프로 이동한다', async ({ page }) => {
    await page.goto('/')

    await page.getByRole('button', { name: '시작' }).click()
    await page.getByRole('button', { name: /01/ }).click()
    const moves = page.getByText('MOVES').locator('..')
    await expect(page.getByText('GUIDE 1 / 2')).toBeVisible()

    await swipe(page, 195, 420, 60, -60)
    await expect(moves).toContainText('0')

    await page.touchscreen.tap(195, 420)
    await expect(page.getByText('GUIDE 2 / 2')).toBeVisible()
    await page.touchscreen.tap(195, 420)
    await expect(page.getByText(/GUIDE/)).toBeHidden()

    await swipe(page, 195, 420, 60, -60)
    await expect(moves).toContainText('1')
  })
})
