import { useCallback } from 'react'

// 문서 시계에 맞춘 무한 반복 연출, 그리는 순서가 바뀌어 요소가 옮겨져도 이어지는 위상
export const useLoop = (keyframes: Keyframe[], duration: number) =>
  useCallback(
    (element: Element | null) => {
      if (!element || matchMedia('(prefers-reduced-motion: reduce)').matches) return
      const loop = element.animate(keyframes, { duration, iterations: Infinity })
      loop.startTime = 0
      return () => loop.cancel()
    },
    [keyframes, duration],
  )
