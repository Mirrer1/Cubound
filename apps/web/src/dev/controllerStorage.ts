const KEY = 'cubound:devFollow'

const read = () => {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

// 자동화 브라우저의 화면 캡처와 og.png에서 빠지는 띠, 저장한 값이 있으면 예외
export const loadShown = () => !navigator.webdriver || read() !== null

export const loadCollapsed = () => read() === 'collapsed'

export const saveCollapsed = (collapsed: boolean) => {
  try {
    localStorage.setItem(KEY, collapsed ? 'collapsed' : 'open')
  } catch {
    // 저장소가 막힌 브라우저는 이번 화면에서만 기억
  }
}
