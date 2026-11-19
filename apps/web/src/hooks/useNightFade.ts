import { useCallback, useEffect, useState } from 'react'

import type { NightBeat } from '@/components/board/frame'

// 같은 수의 첫 전환, 판 바탕 CSS 전환처럼 그 화면이 그려지는 프레임에 시작
// 뒤에 생긴 요소는 그 시작 시각을 따라 진행도에서 이어짐
const leaders = new WeakMap<NightBeat, Animation>()
// 그 수의 전환이 처음 시작한 때, 전환이 끝난 뒤 생긴 요소는 처음부터 다시 틀지 않고 끝 값으로
const began = new WeakMap<NightBeat, number>()

// 어둠 세기 --veil을 판 바탕 전환과 같은 시간과 곡선으로, 막 조각 진하기는 --veil × 빛 지도 값
// 투명도를 움직이면 브라우저가 칸 막을 따로 떼어 그려 경계에 흰 선, 값만 움직여 함께 그림
export const useNightFade = (beat: NightBeat | null) =>
  useCallback(
    (element: Element | null) => {
      if (!element || !beat) return
      const target = element as SVGElement | HTMLElement
      const settle = () => target.style.setProperty('--veil', String(beat.to))
      const now = performance.now()
      if (!began.has(beat)) began.set(beat, now)
      const over = now - (began.get(beat) ?? now) > (beat.seconds + beat.delay) * 1000 + 30
      if (beat.from === beat.to || over) {
        settle()
        return () => target.style.removeProperty('--veil')
      }
      const fade = element.animate([{ '--veil': beat.from }, { '--veil': beat.to }], {
        duration: beat.seconds * 1000,
        delay: beat.delay * 1000,
        easing: beat.ease,
        fill: 'both',
      })
      const leader = leaders.get(beat)
      // 진행 위치를 바로 맞춤, 시작 시각만 맞추면 폰 브라우저는 첫 화면을 처음 값으로 그려 새 그림이 번쩍임
      // 기준 그림이 떼어졌으면 전환이 처음 시작한 시각으로 맞춤, 처음부터 다시 틀면 밝은 값으로 번쩍임
      if (leader?.currentTime != null) fade.currentTime = leader.currentTime
      else fade.currentTime = now - (began.get(beat) ?? now)
      if (!leader || leader.playState === 'idle') leaders.set(beat, fade)
      fade.finished
        .then(() => {
          settle()
          fade.cancel()
        })
        .catch(() => {})
      return () => {
        // 떼어진 첫 전환은 다음 요소가 이어받음, 개발 모드는 붙였다 떼었다 다시 붙임
        if (leaders.get(beat) === fade) leaders.delete(beat)
        fade.cancel()
        target.style.removeProperty('--veil')
      }
    },
    [beat],
  )

// 이 수의 어둠 세기가 아직 바뀌는 중인지, 첫 전환이 끝나면 false
export const useNightTurning = (beat: NightBeat | null) => {
  const [settled, setSettled] = useState<NightBeat | null>(null)
  const turning = beat !== null && beat.from !== beat.to
  useEffect(() => {
    if (!beat || !turning) return
    let live = true
    let wait = 0
    const done = () => live && setSettled(beat)
    // 첫 전환이 끝나는 때, 첫 전환이 떼어지면 이어받은 전환, 없으면 시간으로
    const watch = () => {
      const leader = leaders.get(beat)
      if (leader) leader.finished.then(done, () => live && watch())
      else wait = window.setTimeout(done, (beat.seconds + beat.delay) * 1000 + 30)
    }
    watch()
    return () => {
      live = false
      window.clearTimeout(wait)
    }
  }, [beat, turning])
  return turning && settled !== beat
}
