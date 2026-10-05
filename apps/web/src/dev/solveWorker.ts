import { solve } from '@/game/solver'
import type { Stage } from '@/game/types'

self.onmessage = (e: MessageEvent<Stage>) => {
  self.postMessage(solve(e.data))
}
