import { type Language, stageTextKey, text } from '@/i18n'
import type { Route } from '@/platform/route'
import { parseStageId } from '@/stages'

const NAME = 'Cubound'

// 탭 제목은 화면을 따라가고 스테이지는 번호와 이름을 함께 보여준다
export const documentTitle = (route: Route, language: Language) => {
  if (route.screen === 'select') return `${NAME} — ${text(language, 'tab.stages')}`
  if (route.screen === 'title') return NAME

  const { stage } = parseStageId(route.stageId)
  const name = text(language, stageTextKey(route.stageId))
  return `${NAME} — ${String(stage).padStart(2, '0')} ${name}`
}
