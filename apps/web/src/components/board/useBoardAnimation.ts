import { type AnimationPlaybackControls, animate, useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'

import { type Chain, type SwampTime, durationOf } from './frame'
import type { GameEvent } from '@/game/types'

// 기다리는 입력이 있으면 조금 빠르게 재생해 다음 입력을 일찍 받는다
const CATCH_UP = [1, 1.3]
const SPEED_RAMP = 0.15

const speedFor = (queued: number) => CATCH_UP[Math.min(queued, CATCH_UP.length - 1)]

// 이동 한 번의 연출 진행도 t와 앞뒤 이동과의 이어짐
export const useBoardAnimation = (
  turn: number,
  events: GameEvent[],
  onEnd: () => void,
  queued: number,
  chained: boolean,
  restartSeconds: number, // 재시작 연출 길이, 0이면 이동 연출
  swamp: SwampTime, // 늪에 드나드는 데 더 드는 시간
): { t: number; chain: Chain } => {
  const [progress, setProgress] = useState({ turn: -1, t: 1, out: false })
  const controls = useRef<AnimationPlaybackControls | null>(null)
  const queuedRef = useRef(queued)
  const reduced = useReducedMotion()
  const duration = (restartSeconds || durationOf(events, swamp)) * (reduced ? 0.35 : 1)
  const speed = speedFor(queued)

  useEffect(() => {
    queuedRef.current = queued
  }, [queued])

  useEffect(() => {
    const current = controls.current
    if (!current) return
    const ramp = animate(current.speed, speed, {
      duration: SPEED_RAMP,
      onUpdate: (value) => {
        current.speed = value
      },
    })
    return () => ramp.stop()
  }, [speed])

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
    current.speed = speedFor(queuedRef.current)
    controls.current = current
    return () => current.stop()
  }, [turn, duration, onEnd])

  const active = progress.turn === turn
  return {
    t: active ? progress.t : duration === 0 ? 1 : 0,
    chain: { in: chained, out: active && progress.out },
  }
}
