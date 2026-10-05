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
import { backTarget, controlsOf, nextMove, playStops, stateAt } from '@/dev/playback'
import SolveWorker from '@/dev/solveWorker?worker'
import { toSession } from '@/game/session'
import type { SolveResult } from '@/game/solver'
import type { Direction, GameState } from '@/game/types'
import { directionFromKey } from '@/platform/input'
import { localSessionStorage } from '@/platform/storage'
import { useGameStore } from '@/store/gameStore'

interface DevFollowProps {
  game: GameState
}

// 한 수 연출이 끝난 뒤 재생이 다음 수를 누르기까지 쉬는 ms
const PAUSE = 300

// 글자마다 폭이 다른 화살표의 같은 칸 폭, 묶음이 바뀌어도 띠 폭 고정
const ARROW = 'w-[1.05em] shrink-0 text-center'

const BUTTON =
  'pointer-events-auto flex size-8 shrink-0 @max-[21rem]:size-7 cursor-pointer items-center justify-center rounded-[9px] text-mute transition-soft hover:bg-hover disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent'

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
  const [play, setPlay] = useState<number | null>(null)
  const [tapPaused, setTapPaused] = useState(false)
  const animating = useGameStore((s) => s.animating)
  const restarting = useGameStore((s) => s.restarting)
  const guideOpen = useGameStore((s) => s.guideStep !== null)
  const move = useGameStore((s) => s.move)

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
  const controls = controlsOf(path, follow)
  const stops =
    play !== null &&
    playStops({
      follow,
      length: path.length,
      expect: play,
      moves: game.moves,
      restarting,
      guideOpen,
      cleared: game.cleared,
      collapsed,
    })
  if (stops) setPlay(null)
  const playing = play !== null && !stops
  const next = playing && !animating && !restarting ? nextMove(path, follow) : null

  const toggle = () =>
    setCollapsed((c) => {
      saveCollapsed(!c)
      return !c
    })
  const step = (direction: Direction) => {
    setPlay(useGameStore.getState().game!.moves + 1)
    move(direction)
  }
  const handlePlay = () => {
    const direction = nextMove(path, follow)
    setTapPaused(false)
    if (playing) setPlay(null)
    else if (direction) step(direction)
  }
  const handleForward = () => {
    const direction = nextMove(path, follow)
    if (direction) move(direction)
  }
  // 되돌리기가 없는 게임이라 처음부터 풀이를 다시 적용해 만든 한 수 전 상태
  const handleBack = () => {
    const target = backTarget(follow)
    if (target === null) return
    const state = stateAt(game.stage, path, target)
    useGameStore.setState(({ turn }) => ({
      game: state,
      prevGame: null,
      events: [],
      turn: turn + 1,
      animating: false,
      restarting: false,
      queue: [],
      chained: false,
    }))
    if (target > 0) localSessionStorage.save(toSession(state))
    else localSessionStorage.clear()
    setSeen({ key: sessionKey(state), follow: { kind: 'on', at: target } })
    setPlay(null)
    setTapPaused(false)
  }

  useEffect(() => {
    if (!next) return
    const timer = setTimeout(() => {
      setPlay(useGameStore.getState().game!.moves + 1)
      move(next)
    }, PAUSE)
    return () => clearTimeout(timer)
  }, [next, game.moves, move])

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
      if (directionFromKey(e.key)) {
        setPlay(null)
        setTapPaused(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // 화면 탭으로 재생 정지와 다시 재생, 탭으로 멈춘 재생만 다시 켬
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if ((e.target as Element).closest('button, a')) return
      const direction = nextMove(path, follow)
      if (playing) {
        setPlay(null)
        setTapPaused(true)
      } else if (tapPaused) {
        setTapPaused(false)
        if (direction) step(direction)
      }
    }
    window.addEventListener('click', onClick)
    return () => window.removeEventListener('click', onClick)
  })

  return (
    shown && (
      <div
        data-dev-follow
        className="@container pointer-events-none flex min-w-0 flex-1 justify-center self-center narrow:order-[10000] narrow:w-full narrow:flex-none"
      >
        <div className="relative flex min-w-0 items-center gap-x-2.5 rounded-[13px] border border-line bg-surface/85 py-1 pr-1.5 pl-1 font-mono text-[13px] text-mute @max-[21rem]:gap-x-2 @max-[21rem]:pr-1 wide:text-sm">
          <span className="flex min-w-0 items-center gap-2">
            <button type="button" onClick={toggle} title="풀이 띠 접기 (`)" className={BUTTON}>
              {collapsed ? '▸' : '▾'}
            </button>
            {!collapsed &&
              (result ? (
                groups.length > 0 && (
                  <span className="flex min-w-0 items-center gap-x-3 text-[20px] leading-none @max-[21rem]:text-[18px]! wide:text-2xl">
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
                    <span className="hidden text-mute @min-[32rem]:flex">
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
          {!collapsed && result && (
            <span className="whitespace-pre tabular-nums @max-[18.5rem]:hidden">{status}</span>
          )}
          {!collapsed && path.length > 0 && (
            <span className="flex items-center border-l border-line pl-1 @min-[24rem]:ml-2 @min-[24rem]:pl-3">
              <button
                type="button"
                onClick={handleBack}
                disabled={!controls.back}
                title="뒤로"
                className={BUTTON}
              >
                ◀◀
              </button>
              <button
                type="button"
                onClick={handlePlay}
                disabled={!playing && !controls.play}
                title={playing ? '정지' : '재생'}
                className={BUTTON}
              >
                {playing ? '❚❚' : '▶'}
              </button>
              <button
                type="button"
                onClick={handleForward}
                disabled={!controls.forward}
                title="앞으로"
                className={BUTTON}
              >
                ▶▶
              </button>
            </span>
          )}
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
