export type Route =
  { screen: 'title' } | { screen: 'select'; world: number } | { screen: 'play'; stageId: string }

// 주소에 월드 번호가 없을 수 있어 parseRoute만 월드를 비워 둔다
type ParsedRoute = Route | { screen: 'select'; world?: number }

export interface RouteContext {
  canPlay: (stageId: string) => boolean
  worlds: number[]
  currentWorld: number // 월드를 적지 않은 주소가 갈 월드
}

const TITLE: Route = { screen: 'title' }

// 잠금 없이 아무 스테이지나 열어 보는 중인지. 주소에 남겨 새로고침해도 유지된다
let all: boolean | undefined

export const showingAll = () => (all ??= new URLSearchParams(window.location.search).has('all'))

// 경로까지 적지 않으면 지금 주소를 기준으로 읽혀서 쿼리가 그대로 남는다
export const setShowingAll = (on: boolean) => {
  const { pathname, hash } = window.location
  all = on
  window.history.replaceState(null, '', `${pathname}${on ? '?all' : ''}${hash}`)
}

const STAGES_PATH = /^\/stages\/(\d+)$/
const PLAY_PATH = /^\/play\/(\d+-\d+)$/

// 정적 배포에서 어느 주소로 새로고침해도 404가 나지 않게 화면을 해시에 둔다
export const parseRoute = (hash: string): ParsedRoute | null => {
  const path = hash.replace(/^#/, '')
  if (path === '' || path === '/') return TITLE
  if (path === '/stages') return { screen: 'select' }

  const stages = STAGES_PATH.exec(path)
  if (stages) return { screen: 'select', world: Number(stages[1]) }

  const play = PLAY_PATH.exec(path)
  return play ? { screen: 'play', stageId: play[1] } : null
}

export const hashOf = (route: Route) => {
  if (route.screen === 'play') return `#/play/${route.stageId}`
  return route.screen === 'select' ? `#/stages/${route.world}` : '#/'
}

// 모르는 주소는 타이틀로 보내고 없는 월드와 아직 열리지 않은 스테이지는 진행 중인 월드로 보낸다
export const resolveRoute = (
  hash: string,
  { canPlay, worlds, currentWorld }: RouteContext,
): Route => {
  const route = parseRoute(hash)
  if (!route) return TITLE

  if (route.screen === 'select') {
    const { world } = route
    return {
      screen: 'select',
      world: world !== undefined && worlds.includes(world) ? world : currentWorld,
    }
  }

  return route.screen === 'play' && !canPlay(route.stageId)
    ? { screen: 'select', world: currentWorld }
    : route
}

export const goTo = (route: Route) => {
  window.location.hash = hashOf(route)
}

// 뒤로 가기로 갈 수 없는 주소에 다시 오지 않게 기록을 덮어쓴다
export const replaceHash = (hash: string) => {
  window.location.replace(hash)
}
