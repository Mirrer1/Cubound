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

test('타이틀에서 스테이지를 골라 가이드를 넘기고 방향키로 이동하고 확인을 거쳐 재시작한다', async ({
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

  // 5수부터는 재시작 전에 물어본다. 내려앉기 연출 중에는 이동이 막혀서 끝나기를 기다린다
  await page.waitForTimeout(600)
  for (const key of ['ArrowUp', 'ArrowUp', 'ArrowRight', 'ArrowRight', 'ArrowRight']) {
    await page.keyboard.press(key)
    await page.waitForTimeout(300)
  }
  await expect(moves).toContainText('5')

  const keep = page.getByRole('button', { name: '계속하기' })
  await page.keyboard.press('r')
  await expect(keep).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(keep).toBeHidden()
  await expect(moves).toContainText('5')

  await page.keyboard.press('r')
  await page.getByRole('button', { name: '다시 시작' }).click()
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

  test('헤더 버튼 위에서 스와이프하면 움직이고 탭하면 버튼이 눌린다', async ({ page }) => {
    await page.goto('/')

    await page.getByRole('button', { name: '시작' }).click()
    await page.getByRole('button', { name: /01/ }).click()
    await page.getByRole('button', { name: '건너뛰기' }).click()
    // 사라지는 중인 가이드 카드가 버튼을 덮고 있어 다 사라진 뒤에 잰다
    await expect(page.getByText(/GUIDE/)).toBeHidden()

    const moves = page.getByText('MOVES').locator('..')
    const box = await page.getByRole('button', { name: '↺' }).boundingBox()
    const x = box!.x + box!.width / 2
    const y = box!.y + box!.height / 2

    await page.keyboard.press('ArrowUp')
    await expect(moves).toContainText('1')
    await page.touchscreen.tap(x, y)
    await expect(moves).toContainText('0')

    // 재시작 내려앉기 연출 중에는 이동이 막혀서 끝나기를 기다린다
    await page.waitForTimeout(600)
    await swipe(page, x, y, 60, -60)
    await expect(moves).toContainText('1')

    // 버튼 안에서 끝나는 짧은 드래그는 클릭이 버튼에 떨어지는데, 스와이프라 재시작이 눌리지 않는다
    await page.mouse.move(x, y)
    await page.mouse.down()
    await page.mouse.move(x + 30, y - 20, { steps: 4 })
    await page.mouse.up()
    await page.waitForTimeout(400)
    await expect(moves).toContainText('2')
  })
})
