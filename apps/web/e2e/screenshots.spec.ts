import { test } from '@playwright/test'

const KEYS = {
  up: 'ArrowUp',
  right: 'ArrowRight',
  down: 'ArrowDown',
  left: 'ArrowLeft',
} as const

// 임시 스테이지 1-1의 풀이와 캡처할 이동 번호
const SOLUTION =
  'right up right right right right left left left up left left up right right right right right right right right right'
const SHOTS: Record<number, string> = {
  0: 'start',
  1: 'ladder-carried',
  6: 'switch-pressed',
  15: 'box-climbed',
  17: 'gap-filled',
  21: 'ladder-placed',
  22: 'cleared',
}

test('@shot 임시 스테이지 상태별 화면', async ({ page }) => {
  await page.goto('/')
  await page.getByText('STAGE 01').waitFor()

  const moves = SOLUTION.split(' ') as (keyof typeof KEYS)[]
  for (let i = 0; i <= moves.length; i++) {
    if (SHOTS[i]) {
      await page.waitForTimeout(600)
      await page.screenshot({
        path: `e2e/.screenshots/${String(i).padStart(2, '0')}-${SHOTS[i]}.png`,
      })
    }
    if (i < moves.length) await page.keyboard.press(KEYS[moves[i]])
  }
})
