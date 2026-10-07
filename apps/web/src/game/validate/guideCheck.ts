import { type CheckContext, isInt, isObject } from './stageCheck'

const GUIDE_TARGETS = [
  'restart',
  'moves',
  'pushes',
  'climbs',
  'rides',
  'dir',
  'wind',
  'melt',
  'lock',
  'tide',
]
const MAX_GUIDES = 3

export const checkGuides = ({ data, grid, add }: CheckContext) => {
  if (data.guides !== undefined) {
    const guides = Array.isArray(data.guides) ? data.guides : []
    if (guides.length === 0 || guides.length > MAX_GUIDES) add('guides는 1~3단계여야 한다')

    guides.forEach((guide, i) => {
      if (!isObject(guide) || typeof guide.id !== 'string' || guide.id === '') {
        add(`guides[${i}]의 id가 비어 있다`)
      }
      const target = isObject(guide) ? guide.target : undefined
      if (isObject(target)) {
        const inside =
          isInt(target.x) && isInt(target.y) && grid[target.y]?.[target.x] !== undefined
        if (!inside) add(`guides[${i}]의 target이 맵 밖이다`)
      } else if (!GUIDE_TARGETS.includes(target as string)) {
        add(`guides[${i}]의 target을 알 수 없다`)
      }
    })
  }
}
