import { test } from '@playwright/test'

// 화면이나 글꼴이 바뀌면 pnpm shot으로 다시 찍는 배포용 이미지
const ICONS = [
  { file: 'apple-touch-icon.png', size: 180 },
  { file: 'icon-192.png', size: 192 },
  { file: 'icon-512.png', size: 512 },
]

// 1~3월드를 다 깬 진행. 모든 월드가 열리고 가이드가 뜨지 않는다
const OPENED = {
  version: 1,
  stages: Object.fromEntries(
    [1, 2, 3].flatMap((world) =>
      Array.from({ length: 10 }, (_, i) => [`${world}-${i + 1}`, { bestMoves: 8, stars: 3 }]),
    ),
  ),
}

const OG_SCENES = {
  title: '/',
  'stage-1-3': '/#/play/1-3',
  'stage-3-9': '/#/play/3-9',
  'stage-4-3': '/#/play/4-3',
}

// 공유 카드에 쓸 장면. 사다리와 상자와 짝 칸과 무너지는 칸이 한 화면에 다 나온다
const OG_CHOICE: keyof typeof OG_SCENES = 'stage-3-9'

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

    for (const [name, url] of Object.entries(OG_SCENES)) {
      await page.goto(url)
      await page.waitForTimeout(900)
      await page.screenshot({ path: `e2e/.screenshots/og-${name}.png` })
      if (name === OG_CHOICE) await page.screenshot({ path: 'public/og.png' })
    }
  })
})
