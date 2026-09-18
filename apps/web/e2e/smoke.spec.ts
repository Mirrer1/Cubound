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

test('게임 중 새로고침하면 하던 상태로 돌아오고 뒤로 가기로 목록에 간다', async ({ page }) => {
  await page.goto('/')

  await page.getByRole('button', { name: '시작' }).click()
  await page.getByRole('button', { name: /01/ }).click()
  await page.getByRole('button', { name: '건너뛰기' }).click()

  const moves = page.getByText('MOVES').locator('..')
  await page.keyboard.press('ArrowUp')
  await page.keyboard.press('ArrowUp')
  await expect(moves).toContainText('2')

  await page.reload()
  await expect(page.getByText('STAGE 01')).toBeVisible()
  await expect(moves).toContainText('2')
  await expect(page.getByText(/GUIDE/)).toBeHidden()

  await page.goBack()
  await expect(page.getByText('WORLD 1')).toBeVisible()
})

test('키보드만으로 타이틀에서 스테이지를 클리어하고 다음 스테이지로 간다', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '시작' }).waitFor()

  // 타이틀은 첫 포커스를 두지 않아 언어 버튼을 지나 시작 버튼에 닿는다
  await page.keyboard.press('Tab')
  await page.keyboard.press('Tab')
  await page.keyboard.press('Enter')
  await expect(page.getByText('WORLD 1')).toBeVisible()
  await page.keyboard.press('Enter')
  await expect(page.getByText('STAGE 01')).toBeVisible()

  await page.getByText('GUIDE 1 / 2').waitFor()
  await page.keyboard.press('Enter')
  await page.getByText('GUIDE 2 / 2').waitFor()
  await page.keyboard.press('Enter')
  await expect(page.getByText(/GUIDE/)).toBeHidden()

  // WASD로 푼다
  for (const key of ['w', 'w', 'd', 'd', 'd', 's', 's', 'a']) {
    await page.keyboard.press(key)
    await page.waitForTimeout(300)
  }

  await expect(page.getByText(/CLEAR/)).toBeVisible()
  await page.waitForTimeout(1800)
  await page.keyboard.press('Enter')
  await expect(page.getByText('STAGE 02')).toBeVisible()
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
