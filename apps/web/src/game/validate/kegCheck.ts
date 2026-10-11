import { type CheckContext, isObject } from './stageCheck'

// 화약통과 상호작용을 정하지 않은 요소, 한 판 금지
const BANNED_ENTITIES: [string, string][] = [
  ['vine', '덩굴'],
  ['seed', '씨앗'],
]

export const checkKegs = ({ data, entities, add }: CheckContext) => {
  const kegs = entities.filter((e) => isObject(e) && e.type === 'keg')
  if (kegs.length === 0) return

  entities.forEach((entity, i) => {
    if (
      isObject(entity) &&
      entity.type === 'keg' &&
      entity.fuse !== undefined &&
      entity.fuse !== true
    ) {
      add(`entities[${i}]의 fuse는 true여야 한다`)
    }
  })

  if (data.swamp !== undefined) add('화약통 판에 늪이 있다')
  if (data.mushroom !== undefined) add('화약통 판에 버섯이 있다')
  if (data.water !== undefined) add('화약통 판에 물이 있다')
  if (isObject(data.rules) && data.rules.wind !== undefined) add('화약통 판에 바람이 있다')
  BANNED_ENTITIES.forEach(([type, name]) => {
    if (entities.some((e) => isObject(e) && e.type === type)) add(`화약통 판에 ${name}이 있다`)
  })
}
