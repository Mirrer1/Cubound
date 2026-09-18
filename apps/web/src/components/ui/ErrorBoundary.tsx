import { Component, type ReactNode } from 'react'

import Button from './Button'
import { useText } from '@/i18n/useText'

const reload = () => window.location.reload()

const ErrorScreen = () => {
  const t = useText()

  return (
    <main className="mx-auto flex h-dvh max-w-[1920px] screen-pad">
      <section className="flex min-h-0 flex-1 flex-col items-center justify-center gap-5 rounded-[22px] border border-line bg-base-bg">
        <span className="font-mono text-[11px] tracking-[0.22em] text-mute">ERROR</span>
        <p className="text-lg">{t('error.message')}</p>
        <Button onClick={reload}>{t('error.reload')}</Button>
      </section>
    </main>
  )
}

// 렌더링 중 오류를 잡으려면 클래스여야 한다
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
