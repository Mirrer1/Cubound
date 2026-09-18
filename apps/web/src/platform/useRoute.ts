import { useEffect, useSyncExternalStore } from 'react'

import { type Route, hashOf, replaceHash, resolveRoute } from './route'

const subscribe = (onChange: () => void) => {
  window.addEventListener('hashchange', onChange)
  return () => window.removeEventListener('hashchange', onChange)
}

const currentHash = () => window.location.hash

// 주소를 화면의 기준으로 삼는다. 갈 수 없는 주소면 갈 수 있는 주소로 덮어쓴다
export const useRoute = (canPlay: (stageId: string) => boolean): Route => {
  const hash = useSyncExternalStore(subscribe, currentHash)
  const route = resolveRoute(hash, canPlay)
  const target = hashOf(route)

  useEffect(() => {
    if (target !== window.location.hash) replaceHash(target)
  }, [target])

  return route
}
