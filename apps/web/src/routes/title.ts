import { type Language, chapterTextKey, stageTextKey, text, worldTextKey } from '@/i18n'
import type { Route } from '@/routes/route'
import { cycleOf, parseStageId } from '@/stages'

const NAME = 'Cubound'

// 지금 화면에 보이는 이름을 따라가는 탭 제목, 월드가 여럿이라 이름으로 갈리는 탭
export const documentTitle = (route: Route, language: Language) => {
  // index.html의 제목과 같은 글자, 한국어에서는 켜질 때 그대로인 제목
  if (route.screen === 'title') return `${NAME} — ${text(language, 'tab.home')}`

  if (route.screen === 'select') {
    const key = route.chapters ? chapterTextKey(cycleOf(route.world)) : worldTextKey(route.world)
    return `${NAME} — ${text(language, key)}`
  }

  const { stage } = parseStageId(route.stageId)
  const name = text(language, stageTextKey(route.stageId))
  return `${NAME} — ${String(stage).padStart(2, '0')} ${name}`
}
