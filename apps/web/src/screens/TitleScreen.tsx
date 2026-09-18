import Button from '@/components/ui/Button'
import LanguageMenu from '@/components/ui/LanguageMenu'
import Logo from '@/components/ui/Logo'
import TitleScene from '@/components/ui/TitleScene'
import { useText } from '@/i18n/useText'
import { useGameStore } from '@/store/gameStore'

const TitleScreen = () => {
  const goTo = useGameStore((s) => s.goTo)
  const t = useText()

  return (
    <main className="flex h-dvh p-4 sm:p-8">
      <section className="relative flex min-h-0 flex-1 flex-col items-center justify-center overflow-hidden rounded-[22px] border border-line bg-base-bg">
        <TitleScene
          opacity={0.4}
          className="pointer-events-none absolute -top-10 -left-16 w-64 sm:w-72"
        />
        <TitleScene
          opacity={0.6}
          className="pointer-events-none absolute -right-10 bottom-40 w-72 sm:-bottom-8 sm:w-96"
        />
        <div className="absolute top-4 right-4 z-10 sm:top-6 sm:right-6">
          <LanguageMenu />
        </div>
        <div className="relative flex flex-1 flex-col items-center justify-center gap-5 sm:flex-none">
          <Logo />
          <span className="font-mono text-xs tracking-[0.3em] text-mute">ISOMETRIC PUZZLE</span>
        </div>
        <div className="relative flex w-full flex-col items-center gap-4 p-6 sm:mt-10 sm:w-auto sm:p-0">
          <Button variant="primary" className="w-full sm:w-52" onClick={() => goTo('select')}>
            {t('title.start')}
          </Button>
          <span className="font-mono text-[11px] tracking-[0.25em] text-faint sm:hidden">
            SWIPE TO MOVE
          </span>
        </div>
      </section>
    </main>
  )
}

export default TitleScreen
