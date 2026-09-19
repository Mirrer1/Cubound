import Button from '@/components/ui/Button'
import LanguageMenu from '@/components/ui/LanguageMenu'
import Logo from '@/components/ui/Logo'
import TitleScene from '@/components/ui/TitleScene'
import { useText } from '@/i18n/useText'
import { goTo } from '@/platform/route'
import { currentWorld } from '@/stages'
import { useGameStore } from '@/store/gameStore'

const TitleScreen = () => {
  const progress = useGameStore((s) => s.progress)
  const t = useText()

  const handleStart = () => goTo({ screen: 'select', world: currentWorld(progress) })

  return (
    <main className="mx-auto flex h-dvh max-w-[1920px] screen-pad">
      <section className="relative flex min-h-0 flex-1 flex-col items-center justify-center overflow-hidden rounded-[22px] border border-line bg-base-bg">
        <TitleScene
          opacity={0.4}
          className="pointer-events-none absolute -top-10 -left-16 w-64 sm:w-72"
        />
        <TitleScene
          opacity={0.6}
          className="pointer-events-none absolute -right-10 bottom-40 w-72 sm:-bottom-8 sm:w-96"
        />
        <div className="absolute top-0 right-0 z-10 panel-pad">
          <LanguageMenu />
        </div>
        <div className="relative flex flex-1 flex-col items-center justify-center gap-5 sm:flex-none">
          <Logo />
          <span className="font-mono text-xs tracking-[0.3em] text-mute">ISOMETRIC PUZZLE</span>
        </div>
        <div className="relative flex w-full flex-col items-center gap-4 panel-pad sm:mt-10 sm:w-auto sm:p-0">
          <Button variant="primary" className="w-full sm:w-52" onClick={handleStart}>
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
