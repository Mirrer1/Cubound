import { type Page, test } from '@playwright/test'

// 화면이나 글꼴이 바뀌면 pnpm shot으로 다시 찍는 배포용 이미지
const ICONS = [
  { file: 'apple-touch-icon.png', size: 180 },
  { file: 'icon-192.png', size: 192 },
  { file: 'icon-512.png', size: 512 },
]

// 1~9를 클리어한 진행. 모든 스테이지가 열리고 가이드가 뜨지 않는다
const OPENED = {
  version: 1,
  stages: Object.fromEntries(
    Array.from({ length: 9 }, (_, i) => [`1-${i + 1}`, { bestMoves: 8, stars: 3 }]),
  ),
}

const OG_SCENES = {
  title: async () => {},
  'stage-03': async (page: Page) => {
    await page.getByRole('button', { name: '시작' }).click()
    await page.getByRole('button', { name: /03/ }).click()
    await page.getByText('STAGE 03').waitFor()
  },
  'stage-10': async (page: Page) => {
    await page.getByRole('button', { name: '시작' }).click()
    await page.getByRole('button', { name: /10/ }).click()
    await page.getByText('STAGE 10').waitFor()
    await page.getByRole('button', { name: '건너뛰기' }).click()
  },
}

// 공유 카드에 쓸 장면
const OG_CHOICE: keyof typeof OG_SCENES = 'stage-03'

test('@shot 아이콘 PNG', async ({ page }) => {
  for (const icon of ICONS) {
    await page.setViewportSize({ width: icon.size, height: icon.size })
    await page.goto('/icon.svg')
    await page.screenshot({ path: `public/${icon.file}` })
  }
})

test.describe('공유 이미지', () => {
  test.use({ viewport: { width: 1200, height: 630 } })

  test('@shot OG 이미지', async ({ page }) => {
    await page.addInitScript((progress) => {
      localStorage.setItem('cubound:progress', JSON.stringify(progress))
    }, OPENED)

    for (const [name, setup] of Object.entries(OG_SCENES)) {
      await page.goto('/')
      await setup(page)
      await page.waitForTimeout(900)
      await page.screenshot({ path: `e2e/.screenshots/og-${name}.png` })
      if (name === OG_CHOICE) await page.screenshot({ path: 'public/og.png' })
    }
  })
})
