import { type RefObject, useEffect } from 'react'

// 떠 있는 카드가 닫힐 때까지 Tab이 카드 안에서만 돌게 한다
export const useFocusTrap = (ref: RefObject<HTMLElement | null>) => {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const card = ref.current
      if (e.key !== 'Tab' || !card) return

      const items = [...card.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')]
      if (items.length === 0) return

      const last = items[items.length - 1]
      const edge = e.shiftKey ? items[0] : last
      if (document.activeElement !== edge && card.contains(document.activeElement)) return

      e.preventDefault()
      const next = e.shiftKey ? last : items[0]
      next.focus()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [ref])
}
