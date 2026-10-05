import { useCallback } from 'react'

// 문서 시계에 맞춘 무한 반복 연출, 그리는 순서가 바뀌어 요소가 옮겨져도 이어지는 위상, delay는 위상을 늦추는 ms
export const useLoop = (keyframes: Keyframe[], duration: number, delay = 0) =>
  useCallback(
    (element: Element | null) => {
      if (!element || matchMedia('(prefers-reduced-motion: reduce)').matches) return
      const loop = element.animate(keyframes, { duration, delay, iterations: Infinity })
      loop.startTime = 0
      return () => loop.cancel()
    },
    [keyframes, duration, delay],
  )
