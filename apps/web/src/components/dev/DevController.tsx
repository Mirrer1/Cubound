// 개발 서버 전용 화면이라 i18n 사전 대신 코드에 둔 한국어 문구, dev 폴더 한정 예외
import { AnimatePresence, motion } from 'motion/react'
import {
  type FocusEvent as ReactFocusEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import devSolutions from 'virtual:dev-solutions'

import { loadCollapsed, loadShown, saveCollapsed } from '@/dev/controllerStorage'
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
import {
  backTarget,
  controlsOf,
  jumpTarget,
  nextMove,
  playStops,
  splitStatus,
  stateAt,
} from '@/dev/playback'
import { type SolutionEntry, pickSolution } from '@/dev/solutionCache'
import SolveWorker from '@/dev/solveWorker?worker'
import { toSession } from '@/game/session'
import type { SolveResult } from '@/game/solver'
import type { Direction, GameState, Stage } from '@/game/types'
import { directionFromKey } from '@/platform/input'
import { localSessionStorage } from '@/platform/storage'
import { useGameStore } from '@/store/gameStore'

interface DevControllerProps {
  game: GameState
}

// 한 수 연출이 끝난 뒤 재생이 다음 수를 누르기까지 쉬는 ms
const PAUSE = 300

// 글자마다 폭이 다른 화살표의 같은 칸 폭, 묶음이 바뀌어도 띠 폭 고정
const ARROW = 'w-[1.05em] shrink-0 text-center'

const BUTTON =
  'pointer-events-auto flex size-8 shrink-0 @max-[21rem]:size-7 cursor-pointer items-center justify-center rounded-[9px] text-mute transition-soft hover:bg-hover disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent'

const VIEWPORT = 'width=device-width, initial-scale=1.0, viewport-fit=cover'

// 보이는 크기는 그대로 두고 넓힌 누르는 자리
const TAP =
  'pointer-events-auto relative cursor-pointer transition-soft after:absolute hover:bg-hover'

const SOLUTION_EVENT = 'cubound:solution'

// 개발 서버가 새로 구해 보내는 풀이까지 받아 두는 판별 풀이, 지금 안 보는 판 포함
const solutions: Record<string, SolutionEntry> = { ...devSolutions }
import.meta.hot?.on(SOLUTION_EVENT, ({ id, entry }: { id: string; entry: SolutionEntry }) => {
  solutions[id] = entry
})

const MARK_CLASS: Record<FollowMark, string> = {
  done: 'text-faint',
  next: 'text-ink underline decoration-2 underline-offset-[5px]',
  todo: 'text-ink',
  off: 'rounded-sm bg-red-600 text-base-bg',
}

const DevController = ({ game }: DevControllerProps) => {
  const [found, setFound] = useState<{ stage: Stage; result: SolveResult } | null>(null)
  const [seen, setSeen] = useState<{ key: string; follow: Follow | null }>({
    key: '',
    follow: null,
  })
  const [shown] = useState(loadShown)
  const [collapsed, setCollapsed] = useState(loadCollapsed)
  const [play, setPlay] = useState<number | null>(null)
  const [tapPaused, setTapPaused] = useState(false)
  const [editing, setEditing] = useState(false)
  const cancelJump = useRef(false)
  const animating = useGameStore((s) => s.animating)
  const restarting = useGameStore((s) => s.restarting)
  const guideOpen = useGameStore((s) => s.guideStep !== null)
  const move = useGameStore((s) => s.move)
  const cached = useMemo(
    () => (shown ? pickSolution(game.stage, solutions[game.stage.id]) : null),
    [game.stage, shown],
  )
  const result = cached ?? (found?.stage === game.stage ? found.result : null)
  const trace = useMemo(
    () => (result?.status === 'solved' ? tracePath(game.stage, result.path) : null),
    [game.stage, result],
  )

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
  const count = splitStatus(status)
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
  // 되돌리기가 없는 게임이라 처음부터 풀이를 다시 적용해 만든 n수째 상태
  const jumpTo = (target: number | null) => {
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
    if (target > 0 && !state.cleared) localSessionStorage.save(toSession(state))
    else localSessionStorage.clear()
    setSeen({ key: sessionKey(state), follow: { kind: 'on', at: target } })
    setPlay(null)
    setTapPaused(false)
  }
  const handleBack = () => jumpTo(backTarget(follow))
  // 게임 키 처리로 새지 않는 입력창 키, 아이폰 숫자 키패드는 Enter가 없어 입력창을 떠날 때 이동
  const handleJumpKey = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation()
    if (e.key === 'Enter') {
      e.preventDefault()
      e.currentTarget.blur()
    } else if (e.key === 'Escape') {
      cancelJump.current = true
      e.currentTarget.blur()
    }
  }
  // 아이폰 사파리가 16px보다 작은 입력창에 포커스하며 확대하는 것을 막는 입력 동안의 배율 잠금
  const handleJumpOpen = () => {
    const viewport = document.querySelector('meta[name="viewport"]')
    viewport?.setAttribute('content', `${VIEWPORT}, maximum-scale=1`)
    setEditing(true)
  }
  const handleJumpBlur = (e: ReactFocusEvent<HTMLInputElement>) => {
    document.querySelector('meta[name="viewport"]')?.setAttribute('content', VIEWPORT)
    setEditing(false)
    if (cancelJump.current) cancelJump.current = false
    else jumpTo(jumpTarget(e.currentTarget.value, path.length))
  }
  // 띠를 누른 손가락으로 스와이프 판정이 시작되어 클릭이 버려지는 일 방지
  const stopSwipe = (e: ReactPointerEvent) => e.stopPropagation()

  useEffect(() => {
    if (!next) return
    const timer = setTimeout(() => {
      setPlay(useGameStore.getState().game!.moves + 1)
      move(next)
    }, PAUSE)
    return () => clearTimeout(timer)
  }, [next, game.moves, move])

  // 저장된 풀이가 없으면 직접 풀고, 개발 서버가 먼저 구해 보내면 그쪽 사용
  useEffect(() => {
    if (!shown || cached) return
    const stage = game.stage
    const worker = new SolveWorker()
    worker.onmessage = (e: MessageEvent<SolveResult>) => setFound({ stage, result: e.data })
    worker.postMessage(stage)
    const onSolution = ({ id, entry }: { id: string; entry: SolutionEntry }) => {
      const picked = id === stage.id ? pickSolution(stage, entry) : null
      if (!picked) return
      worker.terminate()
      setFound({ stage, result: picked })
    }
    import.meta.hot?.on(SOLUTION_EVENT, onSolution)
    return () => {
      worker.terminate()
      import.meta.hot?.off(SOLUTION_EVENT, onSolution)
    }
  }, [game.stage, shown, cached])

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
      if ((e.target as Element).closest('button, a, input')) return
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
        data-dev-controller
        onPointerDown={stopSwipe}
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
                      {current.map((cell, i) =>
                        cell ? (
                          <button
                            key={i}
                            type="button"
                            onClick={() => jumpTo(cell.index)}
                            className={`${ARROW} ${TAP} rounded-sm after:inset-x-0 after:-inset-y-2.5 ${MARK_CLASS[marks[cell.index] ?? 'todo']}`}
                          >
                            {cell.arrow}
                          </button>
                        ) : (
                          <span key={i} className={ARROW} />
                        ),
                      )}
                    </span>
                    <span className="hidden text-mute @min-[32rem]:flex">
                      {upcoming.map((cell, i) =>
                        cell ? (
                          <button
                            key={i}
                            type="button"
                            onClick={() => jumpTo(cell.index)}
                            className={`${ARROW} ${TAP} rounded-sm after:inset-x-0 after:-inset-y-2.5`}
                          >
                            {cell.arrow}
                          </button>
                        ) : (
                          <span key={i} className={ARROW} />
                        ),
                      )}
                    </span>
                  </span>
                )
              ) : (
                // 개발 전용이라 useLoop 대신 쓴 CSS 회전
                <span className="mr-2.5 -ml-1 size-4 animate-spin rounded-full border-2 border-line-strong border-t-ink" />
              ))}
          </span>
          {!collapsed && result && (
            <span className="whitespace-pre tabular-nums @max-[18.5rem]:hidden">
              {count ? (
                <>
                  <span className="relative inline-block">
                    <button
                      type="button"
                      onClick={handleJumpOpen}
                      title="바로 갈 수"
                      className={`${TAP} rounded-sm text-ink after:-inset-x-1.5 after:-inset-y-2.5`}
                    >
                      {count[0]}
                    </button>
                    {editing && (
                      <input
                        autoFocus
                        inputMode="numeric"
                        defaultValue={follow?.at ?? 0}
                        onFocus={(e) => e.currentTarget.select()}
                        onKeyDown={handleJumpKey}
                        onBlur={handleJumpBlur}
                        className="pointer-events-auto absolute inset-0 size-full min-w-0 rounded-sm bg-surface p-0 text-right text-ink tabular-nums outline-1! outline-offset-0!"
                      />
                    )}
                  </span>
                  {count[1]}
                </>
              ) : (
                status
              )}
            </span>
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
                <svg viewBox="0 0 12 12" className="size-3 fill-current">
                  <rect x="1" y="2" width="2" height="8" />
                  <path d="M11 2v8L4 6z" />
                </svg>
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
                <svg viewBox="0 0 12 12" className="size-3 fill-current">
                  <path d="M1 2v8l7-4z" />
                  <rect x="9" y="2" width="2" height="8" />
                </svg>
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

export default DevController
