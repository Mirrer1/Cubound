import Button from '@/components/ui/Button'
import LanguageMenu from '@/components/ui/LanguageMenu'
import Logo from '@/components/ui/Logo'
import TitleScene from '@/components/ui/TitleScene'
import { isWorldUnlocked } from '@/game/progress'
import { useText } from '@/hooks/useText'
import { localWorldStorage } from '@/platform/storage'
import { goTo, setShowingAll } from '@/routes/route'
import { WORLDS, currentWorld, worldUnlockStageId } from '@/stages'
import { useGameStore } from '@/store/gameStore'

const TitleScreen = () => {
  const progress = useGameStore((s) => s.progress)
  const t = useText()

  // 목록에서 보던 자리, 시작과 스테이지 선택이 따로 기억하는 자리
  const lastWorld = (all: boolean, fallback: number) => {
    const saved = localWorldStorage.load(all)
    if (saved === undefined || !WORLDS.includes(saved)) return fallback
    // 순서대로 푸는 시작은 기억한 월드라도 잠겼으면 제외
    return all || isWorldUnlocked(progress, worldUnlockStageId(saved)) ? saved : fallback
  }

  // 앞서 모든 스테이지를 열어 뒀어도 시작으로 들어오면 다시 순서대로 푸는 진행
  const handleStart = () => {
    setShowingAll(false)
    goTo({ screen: 'select', world: lastWorld(false, currentWorld(progress)) })
  }
  // 순서와 상관없이 아무 판이나 골라 보는 목록
  const handleSelect = () => {
    setShowingAll(true)
    goTo({ screen: 'select', world: lastWorld(true, WORLDS[0]) })
  }

  return (
    <main className="mx-auto flex h-dvh max-w-[1920px] screen-pad">
      <section className="relative flex min-h-0 flex-1 flex-col items-center justify-center overflow-hidden rounded-[1.375rem] border border-line bg-base-bg">
        <TitleScene
          opacity={0.4}
          className="pointer-events-none absolute -top-10 -left-16 w-64 min-[1024px]:max-[1700px]:-top-[3.3vw]! min-[1024px]:max-[1700px]:-left-[4.96vw]! min-[1024px]:max-[1700px]:w-[31.4vw]! min-[1700px]:-top-16! min-[1700px]:-left-24! min-[1700px]:w-[38rem]! sm:w-72"
        />
        <TitleScene
          opacity={0.6}
          className="pointer-events-none absolute -right-10 bottom-40 w-72 min-[1024px]:max-[1700px]:-right-[4.13vw]! min-[1024px]:max-[1700px]:-bottom-[3.3vw]! min-[1024px]:max-[1700px]:w-[38vw]! min-[1700px]:-right-20! min-[1700px]:-bottom-16! min-[1700px]:w-[46rem]! sm:-bottom-8 sm:w-96"
        />
        <div className="absolute top-0 right-0 z-10 panel-pad">
          <LanguageMenu />
        </div>
        <div className="relative flex flex-1 flex-col items-center justify-center gap-5 sm:flex-none">
          <Logo />
          <span className="font-mono text-xs tracking-[0.3em] text-mute">FIND YOUR WAY HOME</span>
        </div>
        <div className="relative flex w-full flex-col items-center gap-2.5 panel-pad sm:mt-10 sm:w-auto sm:p-0">
          <Button variant="primary" className="w-full sm:w-52" onClick={handleStart}>
            {t('title.start')}
          </Button>
          <Button
            variant="text"
            className="h-14! w-full rounded-2xl! sm:w-52"
            onClick={handleSelect}
          >
            {t('title.stages')}
          </Button>
          <span className="font-mono text-label tracking-[0.25em] text-mute sm:hidden">
            SWIPE TO MOVE
          </span>
        </div>
      </section>
    </main>
  )
}

export default TitleScreen
