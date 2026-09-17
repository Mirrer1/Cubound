import { useEffect } from 'react'

import Board from '@/components/board/Board'
import { directionFromKey, isRestartKey } from '@/platform/input'
import { useGameStore } from '@/store/gameStore'

const PlayScreen = () => {
  const game = useGameStore((s) => s.game)
  const move = useGameStore((s) => s.move)
  const restart = useGameStore((s) => s.restart)

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const direction = directionFromKey(e.key)
      if (direction) {
        e.preventDefault()
        move(direction)
      } else if (isRestartKey(e.key)) {
        restart()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [move, restart])

  return (
    <main className="flex h-dvh p-4 sm:p-8">
      <section className="flex min-h-0 flex-1 flex-col rounded-[22px] border border-line bg-base-bg">
        <header className="flex items-start justify-between gap-6 px-6 pt-6 sm:px-9 sm:pt-8">
          <div className="flex flex-col gap-1.5">
            <span className="font-mono text-[11px] tracking-[0.22em] text-mute">
              STAGE {game.stage.id.split('-')[1].padStart(2, '0')}
            </span>
            <span className="text-[27px] tracking-tight">{game.stage.name}</span>
          </div>
          <div className="flex items-center gap-7">
            <div className="flex flex-col items-end gap-0.5">
              <span className="font-mono text-[10px] tracking-[0.22em] text-mute">MOVES</span>
              <span className="text-[32px] leading-none font-light tabular-nums">{game.moves}</span>
            </div>
            <button
              type="button"
              onClick={restart}
              title="다시 하기 (R)"
              className="flex size-11 cursor-pointer items-center justify-center rounded-[13px] border border-line-strong text-lg transition-colors hover:bg-floor-top"
            >
              ↺
            </button>
          </div>
        </header>
        <p
          className={`text-center text-sm tracking-widest text-mute transition-opacity duration-500 ${game.cleared ? 'opacity-100' : 'opacity-0'}`}
        >
          집에 도착 · R로 다시 하기
        </p>
        <div className="min-h-0 flex-1 p-6">
          <Board game={game} />
        </div>
      </section>
    </main>
  )
}

export default PlayScreen
