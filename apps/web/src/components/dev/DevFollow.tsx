// 개발 서버 전용 화면이라 i18n 사전 대신 코드에 둔 한국어 문구, dev 폴더 한정 예외
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'

import {
  type Follow,
  type FollowMark,
  arrowGroups,
  fillGroup,
  followMarks,
  followNote,
  followStatus,
  groupAt,
  nextFollow,
  sessionKey,
  tracePath,
} from '@/dev/follow'
import { loadCollapsed, loadShown, saveCollapsed } from '@/dev/followStorage'
import SolveWorker from '@/dev/solveWorker?worker'
import type { SolveResult } from '@/game/solver'
import type { Direction, GameState } from '@/game/types'

interface DevFollowProps {
  game: GameState
}

// 글자마다 폭이 다른 화살표의 같은 칸 폭, 묶음이 바뀌어도 띠 폭 고정
const ARROW = 'w-[1.05em] shrink-0 text-center'

const MARK_CLASS: Record<FollowMark, string> = {
  done: 'text-faint',
  next: 'text-ink underline decoration-2 underline-offset-[5px]',
  todo: 'text-ink',
  off: 'rounded-sm bg-red-600 text-base-bg',
}

const DevFollow = ({ game }: DevFollowProps) => {
  const [result, setResult] = useState<SolveResult | null>(null)
  const [trace, setTrace] = useState<string[] | null>(null)
  const [seen, setSeen] = useState<{ key: string; follow: Follow | null }>({
    key: '',
    follow: null,
  })
  const [shown] = useState(loadShown)
  const [collapsed, setCollapsed] = useState(loadCollapsed)

  // 수가 바뀔 때마다 렌더 중에 한 번 맞춰 보는 따라가기, 벗어난 자리를 기억하는 상태
  const key = sessionKey(game)
  if (trace && key !== seen.key) {
    setSeen({ key, follow: nextFollow(seen.follow, trace, key, game.moves) })
  }
  const path: Direction[] = result?.status === 'solved' ? result.path : []
  const follow = trace ? seen.follow : null
  const marks = follow ? followMarks(path.length, follow) : []
  const groups = arrowGroups(path)
  const at = groupAt(follow, path.length)
  const current = fillGroup(groups[at])
  const upcoming = fillGroup(groups[at + 1])
  const status = result ? followStatus(result, follow) : ''
  const note = collapsed ? null : followNote(follow)
  const off = follow?.kind === 'off'

  const toggle = () =>
    setCollapsed((c) => {
      saveCollapsed(!c)
      return !c
    })

  useEffect(() => {
    if (!shown) return
    const worker = new SolveWorker()
    worker.onmessage = (e: MessageEvent<SolveResult>) => {
      setResult(e.data)
      if (e.data.status === 'solved') setTrace(tracePath(game.stage, e.data.path))
    }
    worker.postMessage(game.stage)
    return () => worker.terminate()
  }, [game.stage, shown])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Backquote') toggle()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    shown && (
      <div
        data-dev-follow
        className="@container pointer-events-none flex min-w-0 flex-1 justify-center self-center narrow:order-[10000] narrow:w-full narrow:flex-none"
      >
        <div className="relative flex min-w-0 items-center gap-x-2.5 rounded-[13px] border border-line bg-surface/85 py-1 pr-3 pl-1 font-mono text-[13px] text-mute wide:text-sm">
          <span className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={toggle}
              title="풀이 띠 접기 (`)"
              className="pointer-events-auto flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-[9px] text-mute transition-soft hover:bg-hover"
            >
              {collapsed ? '▸' : '▾'}
            </button>
            {!collapsed &&
              (result ? (
                groups.length > 0 && (
                  <span className="flex min-w-0 items-center gap-x-3 text-[20px] leading-none wide:text-2xl">
                    <span className="flex">
                      {current.map((cell, i) => (
                        <span
                          key={i}
                          className={`${ARROW} ${cell ? MARK_CLASS[marks[cell.index] ?? 'todo'] : ''}`}
                        >
                          {cell?.arrow}
                        </span>
                      ))}
                    </span>
                    <span className="hidden text-mute @min-[24rem]:flex">
                      {upcoming.map((cell, i) => (
                        <span key={i} className={ARROW}>
                          {cell?.arrow}
                        </span>
                      ))}
                    </span>
                  </span>
                )
              ) : (
                // 개발 전용이라 useLoop 대신 쓴 CSS 회전
                <span className="size-4 animate-spin rounded-full border-2 border-line-strong border-t-ink" />
              ))}
          </span>
          {!collapsed && result && <span className="whitespace-pre tabular-nums">{status}</span>}
          {/* 띠 높이를 바꾸지 않는 아래쪽 안내, 방향키 자리 고정 */}
          <AnimatePresence>
            {note && (
              <motion.div
                key={note}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0, transition: { duration: 0.24, ease: 'easeOut' } }}
                exit={{ opacity: 0, y: -2, transition: { duration: 0.16, ease: 'easeIn' } }}
                className="absolute inset-x-0 top-full mt-1.5 flex justify-center"
              >
                <span
                  className={`rounded-[10px] border border-line bg-surface/90 px-3 py-1 text-center whitespace-nowrap ${off ? 'text-red-600' : 'text-ink'}`}
                >
                  {note}
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    )
  )
}

export default DevFollow
