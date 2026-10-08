import { useCallback, useLayoutEffect, useRef } from 'react'

const EASE_SOFT = 'cubic-bezier(0.37, 0, 0.63, 1)'

// 투명도가 바뀔 때 서서히 옮겨 가는 Web Animations, 그리는 순서가 바뀌어 요소가 옮겨져도 이어지는 전환
export const useFade = (opacity: number, duration = 320) => {
  const elements = useRef(new Set<Element>())
  const last = useRef(opacity)

  useLayoutEffect(() => {
    const from = last.current
    last.current = opacity
    if (from === opacity || matchMedia('(prefers-reduced-motion: reduce)').matches) return
    for (const element of elements.current) {
      const running = element.getAnimations()
      const start = running.length > 0 ? Number(getComputedStyle(element).opacity) : from
      running.forEach((animation) => animation.cancel())
      element.animate([{ opacity: start }, { opacity }], { duration, easing: EASE_SOFT })
    }
  }, [opacity, duration])

  return useCallback((element: Element | null) => {
    if (!element) return
    elements.current.add(element)
    return () => {
      elements.current.delete(element)
    }
  }, [])
}
