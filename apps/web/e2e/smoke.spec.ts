import { expect, test } from '@playwright/test'

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
