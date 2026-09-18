import { type AnimationPlaybackControls, animate, useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'

import { type Chain, durationOf } from './frame'
import type { GameEvent } from '@/game/types'

// 입력이 2개 밀렸을 때만 이만큼 살짝 빠르게 재생하고 속도는 서서히 바꾼다
const CATCH_UP_SPEED = 1.3
const CATCH_UP_QUEUE = 2
const SPEED_RAMP = 0.15

// 이동 한 번의 연출 진행도 t와 앞뒤 이동과의 이어짐
export const useBoardAnimation = (
  turn: number,
  events: GameEvent[],
  onEnd: () => void,
  queued: number,
  chained: boolean,
  restartSeconds: number, // 재시작 연출 길이, 0이면 이동 연출
): { t: number; chain: Chain } => {
  const [progress, setProgress] = useState({ turn: -1, t: 1, out: false })
  const controls = useRef<AnimationPlaybackControls | null>(null)
  const queuedRef = useRef(queued)
  const reduced = useReducedMotion()
  const duration = (restartSeconds || durationOf(events)) * (reduced ? 0.35 : 1)
  const hurry = queued >= CATCH_UP_QUEUE

  useEffect(() => {
    queuedRef.current = queued
  }, [queued])

  useEffect(() => {
    const current = controls.current
    if (!current) return
    const ramp = animate(current.speed, hurry ? CATCH_UP_SPEED : 1, {
      duration: SPEED_RAMP,
      onUpdate: (speed) => {
        current.speed = speed
      },
    })
    return () => ramp.stop()
  }, [hurry])

  useEffect(() => {
    if (duration === 0) {
      onEnd()
      return
    }

    // 뒤쪽 절반에 들어서면 다음 입력 여부를 고정해 도중에 위치가 튀지 않게 한다
    let out = false
    const current = animate(0, 1, {
      duration,
      ease: 'linear',
      onUpdate: (t) => {
        if (t < 0.5) out = queuedRef.current > 0
        setProgress({ turn, t, out })
      },
      onComplete: onEnd,
    })
    current.speed = queuedRef.current >= CATCH_UP_QUEUE ? CATCH_UP_SPEED : 1
    controls.current = current
    return () => current.stop()
  }, [turn, duration, onEnd])

  const active = progress.turn === turn
  return {
    t: active ? progress.t : duration === 0 ? 1 : 0,
    chain: { in: chained, out: active && progress.out },
  }
}
