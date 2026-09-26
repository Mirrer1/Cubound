import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { zoneIndexAt } from '@/game/camera'
import { type Hidden, type HiddenKind, hiddenObjects } from '@/game/occlusion'
import { createState, move } from '@/game/rules'
import { deadEnds, minPushes, moveLimit, solutionCount, solve, statesWithin } from '@/game/solver'
import type { Direction, Stage } from '@/game/types'
import { validateStage } from '@/game/validate'

const STAGES_DIR = 'src/stages'

const ARROWS: Record<Direction, string> = { up: '↑', right: '→', down: '↓', left: '←' }

// 한글은 터미널에서 두 칸을 차지한다
const width = (text: string) =>
  [...text].reduce((n, c) => n + (c.charCodeAt(0) > 0x2e7f ? 2 : 1), 0)

const pad = (text: string, size: number) => text + ' '.repeat(Math.max(0, size - width(text)))

const row = (label: string, value: string) => console.log(`  ${label}  ${value}`)

const deadText = (count: number, earliest: number | null) =>
  count === 0 ? '0개' : `${count}개 (가장 빨리 ${earliest}수)`

const KINDS: Record<HiddenKind, string> = {
  mushroom: '버섯',
  swamp: '늪',
  goal: '구멍',
  box: '상자',
  ladder: '사다리',
}

const hiddenText = (hidden: Hidden[]) => {
  if (hidden.length === 0) return '없음'
  const listed = hidden
    .slice(0, 3)
    .map(
      ({ kind, target: o, cover: c, px }) =>
        `${KINDS[kind]}(${o.x},${o.y}) h${o.h} ← (${c.x},${c.y}) h${c.h} ${px}px`,
    )
  const rest = hidden.length > 3 ? ` 외 ${hidden.length - 3}건` : ''
  return `${hidden.length}건 (${listed.join(', ')}${rest})`
}

const jsonIn = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((entry) =>
      entry.isDirectory()
        ? jsonIn(join(dir, entry.name))
        : entry.name.endsWith('.json')
          ? [join(dir, entry.name)]
          : [],
    )

const files = (arg: string): string[] => {
  const path = [join(STAGES_DIR, arg), arg].find(existsSync)
  if (!path) return []
  return statSync(path).isDirectory() ? jsonIn(path) : [path]
}

// 풀이를 구역 경계로 잘라 구역마다 몇 수를 쓰는지 센다. 넘어가는 수는 들어선 구역 몫이다
const zoneMoves = (stage: Stage, path: Direction[]) => {
  const zones = stage.zones
  if (!zones || zones.length < 2) return null

  const counts = zones.map(() => 0)
  let state = createState({ ...stage, rules: undefined })
  let zone = zoneIndexAt(zones, state.player, 0)

  for (const direction of path) {
    state = move(state, direction).state
    zone = zoneIndexAt(zones, state.player, zone)
    counts[zone] += 1
  }

  return counts
}

interface Summary {
  id: string
  best: string
  pushes: string
  dead: string
  alternatives: string
  states: string
  hidden: string
  ms: string
}

const check = (file: string): Summary | null => {
  console.log(`\n${file}`)

  const result = validateStage(JSON.parse(readFileSync(file, 'utf8')))
  if (!result.ok) {
    result.errors.forEach((error) => row('형식', error))
    return null
  }

  const stage = result.stage
  row('형식', '통과')

  const hidden = hiddenObjects(stage)
  row('가림', hiddenText(hidden))

  const started = Date.now()
  const solved = solve(stage)
  const ms = Date.now() - started

  if (solved.status !== 'solved') {
    row('최소', solved.status === 'limit' ? '탐색 한도 초과' : '풀 수 없다')
    return null
  }

  const { moves, path } = solved
  const limit = stage.rules?.moveLimit
  const pushLimit = stage.rules?.pushLimit
  const pushed = minPushes(stage)
  const counted = solutionCount(stage)
  const inside = limit === undefined ? null : statesWithin(stage, limit)
  const stuck = deadEnds(stage)
  const zones = zoneMoves(stage, path)
  const directions = new Set(path)

  row('최소', `${moves}수 (best ${stage.best ?? '없음'} ${stage.best === moves ? '일치' : '다름'})`)
  row(
    '제한',
    limit === undefined
      ? `없음 (★★ 기준 ${moveLimit(moves)}수)`
      : `${limit}수 (여유 ${limit - moves}수)`,
  )
  row(
    '밀기',
    pushed.status !== 'solved'
      ? '탐색 한도 초과'
      : `최소 ${pushed.pushes}번` +
          (pushLimit === undefined
            ? ''
            : ` (제한 ${pushLimit}번, 여유 ${pushLimit - pushed.pushes}번)`),
  )
  row('풀이', path.map((d) => ARROWS[d]).join(' '))
  row(
    '탐색',
    stuck.status !== 'ok'
      ? `한도 초과, ${ms}ms`
      : `상태 ${stuck.states}개${Number.isFinite(stuck.depth) ? ` (${stuck.depth}수까지)` : ''}, ${ms}ms`,
  )
  row(
    '막힘',
    stuck.status !== 'ok'
      ? '탐색 한도 초과'
      : stuck.beyond === stuck.dead
        ? deadText(stuck.dead, stuck.earliest)
        : `제한 ${deadText(stuck.beyond, stuck.beyondEarliest)}, 구조 ${deadText(stuck.dead, stuck.earliest)}`,
  )

  const ways = counted.status === 'ok' ? counted.count : 0
  const room = inside?.status === 'ok' ? inside.count : 0
  row(
    '대체',
    counted.status !== 'ok'
      ? '탐색 한도 초과'
      : `${moves}수 풀이 ${ways}가지` + (inside === null ? '' : `, 제한 안 상태 ${room}개`),
  )
  row('구역', zones ? zones.map((n, i) => `${i + 1}구역 ${n}수`).join(', ') : '하나')
  row('방향', `${directions.size}개 (${[...directions].map((d) => ARROWS[d]).join(' ')})`)

  return {
    id: stage.id,
    best: `${moves}${limit === undefined ? '' : `/${limit}`}`,
    pushes:
      pushed.status !== 'solved'
        ? '?'
        : `${pushed.pushes}${pushLimit === undefined ? '' : `/${pushLimit}`}`,
    dead:
      stuck.status === 'ok' ? (stuck.dead === 0 ? '0' : `${stuck.dead}@${stuck.earliest}`) : '?',
    alternatives: `${ways}${inside === null ? '' : `가지, ${room}개`}`,
    states: stuck.status === 'ok' ? `${stuck.states}` : '?',
    hidden: hidden.length === 0 ? '0' : `${hidden.length}@${hidden[0].px}px`,
    ms: `${ms}`,
  }
}

const COLUMNS: [keyof Summary, string, number][] = [
  ['id', '스테이지', 10],
  ['best', '최소/제한', 11],
  ['pushes', '밀기/제한', 11],
  ['states', '상태', 8],
  ['dead', '막힘@수', 10],
  ['alternatives', '풀이/여유', 14],
  ['hidden', '가림@최대', 11],
  ['ms', '탐색ms', 8],
]

const table = (rows: Summary[]) => {
  console.log(`\n${COLUMNS.map(([, title, size]) => pad(title, size)).join('')}`)
  rows.forEach((summary) => {
    console.log(COLUMNS.map(([key, , size]) => pad(summary[key], size)).join(''))
  })
}

export const main = (args: string[]) => {
  const targets = (args.length > 0 ? args : ['']).flatMap(files)
  if (targets.length === 0) {
    console.error(`스테이지를 찾지 못했다: ${args.join(' ')}`)
    process.exitCode = 1
    return
  }

  const rows = targets.map(check).filter((summary) => summary !== null)
  if (rows.length > 1) table(rows)
  if (rows.length < targets.length) process.exitCode = 1
}
