import { motion, useReducedMotion } from 'motion/react'
import { type ReactNode, useEffect, useState } from 'react'

import {
  capsDisplay,
  meltDisplay,
  mudDisplay,
  tideDisplay,
  vinesDisplay,
  windDisplay,
} from '@/components/board/frame'
import TriangleIcon from '@/components/ui/icons/TriangleIcon'
import { climbsLeft, dirLeft, movesLeft, pushesLeft, ridesLeft } from '@/game/rules'
import type { GameEvent, GameState } from '@/game/types'
import { useLoop } from '@/hooks/useLoop'

interface PlayCountsProps {
  game: GameState
  prevGame: GameState | null
  events: GameEvent[]
  turn: number
  animating: boolean
}

// 녹을 0에서 큐브가 둘레에 서서 버티는 동안 숫자가 옅어졌다 돌아오는 한 바퀴
const MELT_HOLD: Keyframe[] = [{ opacity: 1 }, { opacity: 0.3 }, { opacity: 1 }]

// 보스 숫자를 좌우로 흔드는 자리 px와 초
const SHAKE = { x: [0, -3.5, 3.5, -2.5, 2.5, -1, 0], duration: 0.4 }

// 보스 제약에 막히거나 곧 바뀌는 수의 숫자 흔들림, hit은 이어서 막혀도 다시 흔드는 그 수의 차례
// alert는 다음 수에 바뀌는 제약을 미리 알리는 경고색, 흔들 때 새로 그려져도 이어지게 바깥 몫
const LimitCount = ({
  hit,
  alert = false,
  children,
}: {
  hit: number | null
  alert?: boolean
  children: ReactNode
}) => (
  <span className={alert ? 'text-alert' : undefined}>
    <motion.span
      key={hit ?? 'idle'}
      animate={{ x: hit === null ? 0 : SHAKE.x }}
      transition={{ duration: SHAKE.duration, ease: 'easeOut' }}
      className="inline-block text-[32px] leading-none font-light tabular-nums short:text-2xl narrow:text-[19px]"
    >
      {children}
    </motion.span>
  </span>
)

const PlayCounts = ({ game, prevGame, events, turn, animating }: PlayCountsProps) => {
  const [gustTurn, setGustTurn] = useState(-1) // 바람이 불어 숫자가 바뀐 차례
  const [passedAt, setPassedAt] = useState({ turn: -1, passed: 0 })
  const left = game ? movesLeft(game) : null
  const pushesOver = game ? pushesLeft(game) : null
  const climbsOver = game ? climbsLeft(game) : null
  const ridesOver = game ? ridesLeft(game) : null
  const dirOver = game ? dirLeft(game) : null
  // 이 수에 다 써서 0이 된 숫자, 막혔을 때처럼 그 수에 흔듦
  const emptied = (leftOf: (state: GameState) => number | null) =>
    game !== null && prevGame !== null && leftOf(prevGame) !== 0 && leftOf(game) === 0
  const shakeOf = (limit: string, leftOf: (state: GameState) => number | null) =>
    limited === limit || emptied(leftOf) ? turn : null
  const passed = passedAt.turn === turn ? passedAt.passed : 0
  const countView = { game, prevGame, events, animating, passed }
  const { at: mudAt, count: mudSinks } = mudDisplay(countView)
  const { at: capsAt, count: caps } = capsDisplay(countView)
  const { at: vinesAt, count: vines } = vinesDisplay(countView)
  const countAt = [...mudAt, ...capsAt, ...vinesAt]
  const nextCountAt = countAt[passed] ?? null
  const lastCountAt = countAt[passed - 1] ?? 0
  const reduced = useReducedMotion()
  const { gustAt, wind } = windDisplay({ game, prevGame, events, animating })
  const gusting = gustAt !== null && gustTurn === turn && animating
  const melt = meltDisplay(game, events, animating)
  const tide = tideDisplay(game, events, animating)
  const meltHold = useLoop(MELT_HOLD, 600)
  const limitedDir = game?.stage.rules?.dirLimit?.dir
  const limited = events.flatMap((e) => (e.type === 'limit' ? [e.limit] : []))[0]

  useEffect(() => {
    if (nextCountAt === null) return
    const delay = (nextCountAt - lastCountAt) * 1000 * (reduced ? 0.35 : 1)
    const timer = setTimeout(() => setPassedAt({ turn, passed: passed + 1 }), delay)
    return () => clearTimeout(timer)
  }, [nextCountAt, lastCountAt, passed, turn, reduced])

  useEffect(() => {
    if (gustAt === null) return
    const timer = setTimeout(() => setGustTurn(turn), gustAt * 1000 * (reduced ? 0.35 : 1))
    return () => clearTimeout(timer)
  }, [gustAt, turn, reduced])

  return (
    <div className="flex items-center gap-5 wide:gap-7 narrow:order-last narrow:w-full narrow:justify-center narrow:gap-4 narrow:[&>*+*]:border-l narrow:[&>*+*]:border-line narrow:[&>*+*]:pl-4">
      {pushesOver !== null && (
        <div
          data-guide="pushes"
          className="flex flex-col items-end gap-0.5 short:flex-row short:items-baseline short:gap-2 narrow:flex-row narrow:items-baseline narrow:gap-2"
        >
          <span
            className={`font-mono text-[10px] tracking-[0.22em] ${pushesOver === 0 ? 'text-alert' : 'text-mute'}`}
          >
            PUSHES
          </span>
          <LimitCount hit={shakeOf('pushes', pushesLeft)} alert={pushesOver === 0}>
            {pushesOver}
          </LimitCount>
        </div>
      )}
      {climbsOver !== null && (
        <div
          data-guide="climbs"
          className="flex flex-col items-end gap-0.5 short:flex-row short:items-baseline short:gap-2 narrow:flex-row narrow:items-baseline narrow:gap-2"
        >
          <span
            className={`font-mono text-[10px] tracking-[0.22em] ${climbsOver === 0 ? 'text-alert' : 'text-mute'}`}
          >
            CLIMBS
          </span>
          <LimitCount hit={shakeOf('climbs', climbsLeft)} alert={climbsOver === 0}>
            {climbsOver}
          </LimitCount>
        </div>
      )}
      {ridesOver !== null && (
        <div
          data-guide="rides"
          className="flex flex-col items-end gap-0.5 short:flex-row short:items-baseline short:gap-2 narrow:flex-row narrow:items-baseline narrow:gap-2"
        >
          <span
            className={`font-mono text-[10px] tracking-[0.22em] ${ridesOver === 0 ? 'text-alert' : 'text-mute'}`}
          >
            RIDES
          </span>
          <LimitCount hit={shakeOf('rides', ridesLeft)} alert={ridesOver === 0}>
            {ridesOver}
          </LimitCount>
        </div>
      )}
      {dirOver !== null && limitedDir && (
        <div
          data-guide="dir"
          className="flex flex-col items-end gap-0.5 short:flex-row short:items-baseline short:gap-2 narrow:flex-row narrow:items-baseline narrow:gap-2"
        >
          <span
            className={`font-mono text-[10px] tracking-[0.22em] ${dirOver === 0 ? 'text-alert' : 'text-mute'}`}
          >
            {limitedDir.toUpperCase()}
          </span>
          <LimitCount hit={shakeOf('dir', dirLeft)} alert={dirOver === 0}>
            {dirOver}
          </LimitCount>
        </div>
      )}
      {mudSinks !== null && (
        <div className="flex flex-col items-end gap-0.5 short:flex-row short:items-baseline short:gap-2 narrow:flex-row narrow:items-baseline narrow:gap-2">
          <span className="font-mono text-[10px] tracking-[0.22em] text-mute">MUD</span>
          <LimitCount hit={null}>{mudSinks}</LimitCount>
        </div>
      )}
      {caps !== null && (
        <div className="flex flex-col items-end gap-0.5 short:flex-row short:items-baseline short:gap-2 narrow:flex-row narrow:items-baseline narrow:gap-2">
          <span className="font-mono text-[10px] tracking-[0.22em] text-mute">CAPS</span>
          <LimitCount hit={null}>{caps}</LimitCount>
        </div>
      )}
      {vines !== null && (
        <div className="flex flex-col items-end gap-0.5 short:flex-row short:items-baseline short:gap-2 narrow:flex-row narrow:items-baseline narrow:gap-2">
          <span className="font-mono text-[10px] tracking-[0.22em] text-mute">VINE</span>
          <LimitCount hit={null}>{vines}</LimitCount>
        </div>
      )}
      {wind !== null && (
        <div
          data-guide="wind"
          className="flex flex-col items-end gap-0.5 short:flex-row short:items-baseline short:gap-2 narrow:flex-row narrow:items-baseline narrow:gap-2"
        >
          <span
            className={`font-mono text-[10px] tracking-[0.22em] ${gusting ? 'text-alert' : 'text-mute'}`}
          >
            WIND
          </span>
          {gusting ? (
            <LimitCount hit={turn} alert>
              0
            </LimitCount>
          ) : (
            <LimitCount hit={null}>{wind}</LimitCount>
          )}
        </div>
      )}
      {melt && (
        <div
          data-guide="melt"
          className="flex flex-col items-end gap-0.5 short:flex-row short:items-baseline short:gap-2 narrow:flex-row narrow:items-baseline narrow:gap-2"
        >
          <span
            className={`font-mono text-[10px] tracking-[0.22em] ${melt.holding || melt.melting ? 'text-alert' : 'text-mute'}`}
          >
            MELT
          </span>
          <span
            key={melt.holding ? 'hold' : 'count'}
            ref={melt.holding ? meltHold : undefined}
            className={melt.faint ? 'text-faint transition-soft-colors' : 'transition-soft-colors'}
          >
            <LimitCount
              hit={melt.melting || (melt.holding && prevGame?.melt !== 0) ? turn : null}
              alert={melt.holding || melt.melting}
            >
              {melt.count}
            </LimitCount>
          </span>
        </div>
      )}
      {tide && (
        <div
          data-guide="tide"
          className="flex flex-col items-end gap-0.5 short:flex-row short:items-baseline short:gap-2 narrow:flex-row narrow:items-baseline narrow:gap-2"
        >
          <span
            className={`font-mono text-[10px] tracking-[0.22em] ${tide.turning ? 'text-alert' : 'text-mute'}`}
          >
            TIDE
          </span>
          <span className="flex items-center gap-1.5 narrow:gap-1">
            <span
              className={`text-[11px] narrow:text-[9px] ${tide.turning ? 'text-alert' : 'text-ink'}`}
            >
              <TriangleIcon className={`block h-[0.73em] w-[1em] ${tide.up ? '' : 'rotate-180'}`} />
            </span>
            <LimitCount hit={limited === 'tide' || tide.turning ? turn : null} alert={tide.turning}>
              {tide.left}
            </LimitCount>
          </span>
        </div>
      )}
      <div
        data-guide="moves"
        className="flex flex-col items-end gap-0.5 short:flex-row short:items-baseline short:gap-2 narrow:flex-row narrow:items-baseline narrow:gap-2"
      >
        <span
          className={`font-mono text-[10px] tracking-[0.22em] ${left === 0 ? 'text-alert' : 'text-mute'}`}
        >
          MOVES
        </span>
        <LimitCount hit={shakeOf('moves', movesLeft)} alert={left === 0}>
          {left ?? game.moves}
        </LimitCount>
      </div>
    </div>
  )
}

export default PlayCounts
