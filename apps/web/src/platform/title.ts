import { type Language, chapterTextKey, stageTextKey, text, worldTextKey } from '@/i18n'
import type { Route } from '@/platform/route'
import { cycleOf, parseStageId } from '@/stages'

const NAME = 'Cubound'

// 탭 제목은 지금 화면에 보이는 이름을 그대로 따라간다. 월드가 여럿이라 이름이 있어야 탭이 갈린다
export const documentTitle = (route: Route, language: Language) => {
  // index.html의 제목과 같은 글자라 한국어에서는 켜질 때 제목이 바뀌지 않는다
  if (route.screen === 'title') return `${NAME} — ${text(language, 'tab.home')}`

  if (route.screen === 'select') {
    const key = route.chapters ? chapterTextKey(cycleOf(route.world)) : worldTextKey(route.world)
    return `${NAME} — ${text(language, key)}`
  }

  const { stage } = parseStageId(route.stageId)
  const name = text(language, stageTextKey(route.stageId))
  return `${NAME} — ${String(stage).padStart(2, '0')} ${name}`
}
