export type Route = { screen: 'title' } | { screen: 'select' } | { screen: 'play'; stageId: string }

const TITLE: Route = { screen: 'title' }
const SELECT: Route = { screen: 'select' }

const PLAY_PATH = /^\/play\/(\d+-\d+)$/

// 정적 배포에서 어느 주소로 새로고침해도 404가 나지 않게 화면을 해시에 둔다
export const parseRoute = (hash: string): Route | null => {
  const path = hash.replace(/^#/, '')
  if (path === '' || path === '/') return TITLE
  if (path === '/stages') return SELECT

  const play = PLAY_PATH.exec(path)
  return play ? { screen: 'play', stageId: play[1] } : null
}

export const hashOf = (route: Route) => {
  if (route.screen === 'play') return `#/play/${route.stageId}`
  return route.screen === 'select' ? '#/stages' : '#/'
}

// 모르는 주소는 타이틀로 보내고 아직 열리지 않은 스테이지는 스테이지 선택으로 보낸다
export const resolveRoute = (hash: string, canPlay: (stageId: string) => boolean): Route => {
  const route = parseRoute(hash)
  if (!route) return TITLE
  return route.screen === 'play' && !canPlay(route.stageId) ? SELECT : route
}

export const goTo = (route: Route) => {
  window.location.hash = hashOf(route)
}

// 뒤로 가기로 갈 수 없는 주소에 다시 오지 않게 기록을 덮어쓴다
export const replaceHash = (hash: string) => {
  window.location.replace(hash)
}
