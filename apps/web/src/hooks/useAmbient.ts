import { useEffect, useRef, useState } from 'react'

import { AMBIENT, type AmbientKind, type AmbientPlan } from '@/components/board/view'
import type { Point } from '@/game/types'

// 판에 들어와 첫 연출까지 ms
const FIRST_DELAY = 1000

export interface AmbientShown {
  key: string // 차례를 고른 판 id
  kind: AmbientKind
  cells: Point[]
  at: number // 문서 시계 기준 바퀴 안에서 시작하는 ms
  cycle: number
}

// 판에 들어온 때부터 도는 분위기 연출 차례, 차례가 시작될 때 한 번 고른 칸
// 칸 고르는 바퀴 번호는 들어올 때마다 다른 수에서 시작
export const useAmbient = (
  key: string,
  plan: AmbientPlan | null,
  pick: (kind: AmbientKind, round: number, slot: number, last: Point[]) => Point[],
) => {
  const [shown, setShown] = useState<AmbientShown | null>(null)
  const pickRef = useRef(pick)

  useEffect(() => {
    pickRef.current = pick
  })

  useEffect(() => {
    if (!plan || matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const clock = () => Number(document.timeline.currentTime ?? performance.now())
    const origin = clock() + FIRST_DELAY
    const entry = Math.floor(Math.random() * 100000)
    let current = ''
    const last = new Map<AmbientKind, Point[]>()
    let timer = 0
    const tick = () => {
      const now = clock() - origin
      const round = Math.floor(now / plan.cycle)
      const into = now - round * plan.cycle
      const index = plan.slots.findIndex(
        (slot) => into >= slot.at && into < slot.at + AMBIENT[slot.kind].life,
      )
      const slot = plan.slots[index]
      const id = slot && round >= 0 ? `${round}-${index}` : ''
      if (id !== current) {
        current = id
        const cells = id
          ? pickRef.current(slot.kind, round + entry, index, last.get(slot.kind) ?? [])
          : []
        if (cells.length > 0) last.set(slot.kind, cells)
        setShown(
          slot && cells.length > 0
            ? {
                key,
                kind: slot.kind,
                cells,
                at: (origin + slot.at) % plan.cycle,
                cycle: plan.cycle,
              }
            : null,
        )
      }
      const next = slot
        ? slot.at + AMBIENT[slot.kind].life
        : (plan.slots.find((s) => s.at > into)?.at ?? plan.cycle + plan.slots[0].at)
      timer = window.setTimeout(tick, next - into + 1)
    }
    timer = window.setTimeout(tick, FIRST_DELAY)
    return () => window.clearTimeout(timer)
  }, [key, plan])

  return shown?.key === key ? shown : null
}
