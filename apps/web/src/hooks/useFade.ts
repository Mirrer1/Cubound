import { useCallback, useLayoutEffect, useRef } from 'react'

const EASE_SOFT = 'cubic-bezier(0.37, 0, 0.63, 1)'

// 투명도가 바뀔 때 서서히 옮겨 가는 Web Animations, 그리는 순서가 바뀌어 요소가 옮겨져도 이어지는 전환, from은 처음 그려질 때 시작 투명도
// grow는 옅을 때의 크기 비, 진해지며 커지고 옅어지며 줄어드는 전환
export const useFade = (opacity: number, duration = 320, from = opacity, grow = 1) => {
  const elements = useRef(new Set<Element>())
  const last = useRef(from)

  useLayoutEffect(() => {
    const from = last.current
    last.current = opacity
    if (from === opacity || matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const rising = opacity > from
    for (const element of elements.current) {
      const running = element.getAnimations()
      const style = getComputedStyle(element)
      const start = running.length > 0 ? Number(style.opacity) : from
      const scaled = running.length > 0 ? style.transform : `scale(${rising ? grow : 1})`
      running.forEach((animation) => animation.cancel())
      const frames =
        grow === 1
          ? [{ opacity: start }, { opacity }]
          : [
              { opacity: start, transform: scaled },
              { opacity, transform: `scale(${rising ? 1 : grow})` },
            ]
      element.animate(frames, { duration, easing: EASE_SOFT })
    }
  }, [opacity, duration, grow])

  return useCallback((element: Element | null) => {
    if (!element) return
    elements.current.add(element)
    return () => {
      elements.current.delete(element)
    }
  }, [])
}
