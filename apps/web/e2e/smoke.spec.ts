import { expect, test } from '@playwright/test'

test('게임 화면이 뜨고 방향키로 이동하면 이동 수가 오른다', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByText('STAGE 01')).toBeVisible()
  await expect(page.locator('svg polygon').first()).toBeVisible()

  await page.keyboard.press('ArrowUp')
  await expect(page.getByText('MOVES').locator('..')).toContainText('1')

  await page.keyboard.press('r')
  await expect(page.getByText('MOVES').locator('..')).toContainText('0')
})
