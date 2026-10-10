import { Component, type ReactNode } from 'react'

import Button from './Button'
import { useText } from '@/hooks/useText'

const reload = () => window.location.reload()

const ErrorScreen = () => {
  const t = useText()

  return (
    <main className="mx-auto flex h-dvh max-w-[1920px] screen-pad">
      <section className="flex min-h-0 flex-1 flex-col items-center justify-center gap-5 rounded-[1.375rem] border border-line bg-base-bg">
        <span className="font-mono text-[0.6875rem] tracking-[0.22em] text-mute">ERROR</span>
        <p className="text-lg">{t('error.message')}</p>
        <Button onClick={reload}>{t('error.reload')}</Button>
      </section>
    </main>
  )
}

// 렌더링 중 오류를 잡는 데 필요한 클래스
class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    return this.state.failed ? <ErrorScreen /> : this.props.children
  }
}

export default ErrorBoundary
