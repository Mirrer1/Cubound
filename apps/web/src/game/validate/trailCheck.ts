import { type CheckContext, isObject } from './stageCheck'

// 꼬리 불과 같은 판에 둘 수 없는 불 보스 규칙
const OTHER_FIRE_RULES = ['chase', 'burnBox', 'forge']

export const checkTrail = ({ data, add }: CheckContext) => {
  const rules = isObject(data.rules) ? data.rules : {}
  if (rules.trail !== true) return

  const fire = Array.isArray(data.fire) ? (data.fire as unknown[]) : []
  if (fire.some((row) => typeof row === 'string' && row.includes('@'))) {
    add('rules.trail 판에 화로가 있다')
  }
  OTHER_FIRE_RULES.filter((name) => rules[name] !== undefined).forEach((name) =>
    add(`rules.${name}는 rules.trail과 함께 쓸 수 없다`),
  )
}
