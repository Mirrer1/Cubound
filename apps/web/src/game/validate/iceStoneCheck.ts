import { type CheckContext, isObject } from './stageCheck'

export const checkIceStones = ({ data, entities, add, isFloor, isWaterCell }: CheckContext) => {
  if (!isObject(data.rules) || data.rules.melt === undefined) return

  const stones = entities.filter((e) => isObject(e) && e.type === 'iceStone' && isFloor(e))
  if (stones.length === 0) add('rules.melt 판에 얼음 돌이 없다')
  // 화면 위 숫자 하나로 보여 주는 남은 수
  const floating = stones.filter((e) => isWaterCell(e as { x: number; y: number }))
  if (floating.length > 1) add('rules.melt 판에 처음부터 물에 뜬 얼음 돌이 둘 이상이다')
}
