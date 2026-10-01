import { describe, expect, it } from 'vitest'

import { blend, checker, darken, dim, shade } from './shade'

describe('shade', () => {
  it('윗면은 흰색을 14% 섞는다', () => {
    expect(shade('cube', 'top')).toBe('color-mix(in srgb, var(--color-cube), white 14%)')
  })

  it('왼쪽 면은 검은색을 24%, 오른쪽 면은 9% 섞는다', () => {
    expect(shade('cube', 'left')).toBe('color-mix(in srgb, var(--color-cube), black 24%)')
    expect(shade('cube', 'right')).toBe('color-mix(in srgb, var(--color-cube), black 9%)')
  })
})

describe('darken', () => {
  it('토큰 색에 검은색을 그만큼 섞는다', () => {
    expect(darken('ground', 30)).toBe('color-mix(in srgb, var(--color-ground), black 30%)')
  })
})

describe('blend', () => {
  it('진행도를 뒤 색의 비율로 쓴다', () => {
    expect(blend('red', 'blue', 0.25)).toBe('color-mix(in srgb, red, blue 25%)')
  })

  it('진행도 0과 1도 그대로 비율이 된다', () => {
    expect(blend('red', 'blue', 0)).toBe('color-mix(in srgb, red, blue 0%)')
    expect(blend('red', 'blue', 1)).toBe('color-mix(in srgb, red, blue 100%)')
  })
})

describe('dim', () => {
  it('이미 만든 색에 검은색을 그만큼 섞는다', () => {
    expect(dim('var(--color-ground)', 12)).toBe(
      'color-mix(in srgb, var(--color-ground), black 12%)',
    )
  })
})

describe('checker', () => {
  it('짝 칸은 검은색을 3.4% 섞는다', () => {
    expect(checker('red', true)).toBe('color-mix(in srgb, red, black 3.4%)')
  })

  it('홀 칸은 색을 그대로 둔다', () => {
    expect(checker('red', false)).toBe('red')
  })
})
