import { useEffect, useSyncExternalStore } from 'react'

import { type Route, type RouteContext, hashOf, replaceHash, resolveRoute } from '@/routes/route'

const subscribe = (onChange: () => void) => {
  window.addEventListener('hashchange', onChange)
  return () => window.removeEventListener('hashchange', onChange)
}

const currentHash = () => window.location.hash

// 화면의 기준인 주소, 갈 수 없는 주소면 갈 수 있는 주소로 덮어쓰기
export const useRoute = (context: RouteContext): Route => {
  const hash = useSyncExternalStore(subscribe, currentHash)
  const route = resolveRoute(hash, context)
  const target = hashOf(route)

  useEffect(() => {
    if (target !== window.location.hash) replaceHash(target)
  }, [target])

  return route
}
