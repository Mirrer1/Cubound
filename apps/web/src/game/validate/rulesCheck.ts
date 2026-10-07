import { type CheckContext, isInt, isObject } from './stageCheck'

const DIRECTIONS = ['up', 'right', 'down', 'left']

export const checkRules = ({ data, add }: CheckContext) => {
  if (data.rules !== undefined) {
    if (!isObject(data.rules)) add('rules가 객체가 아니다')
    else {
      const { moveLimit, pushLimit, climbLimit, rideLimit, dirLimit } = data.rules
      const { swampDeepen, mushroomWither, vineStop, seedGrow, wind, plug, melt, tide } = data.rules
      if (moveLimit !== undefined) {
        if (!(isInt(moveLimit) && moveLimit > 0)) add('rules.moveLimit은 양의 정수여야 한다')
        else if (isInt(data.best) && moveLimit < data.best) add('rules.moveLimit이 best보다 작다')
      }
      if (pushLimit !== undefined && !(isInt(pushLimit) && pushLimit > 0)) {
        add('rules.pushLimit은 양의 정수여야 한다')
      }
      if (climbLimit !== undefined && !(isInt(climbLimit) && climbLimit > 0)) {
        add('rules.climbLimit은 양의 정수여야 한다')
      }
      if (rideLimit !== undefined && !(isInt(rideLimit) && rideLimit > 0)) {
        add('rules.rideLimit은 양의 정수여야 한다')
      }
      if (dirLimit !== undefined) {
        const { dir, count } = isObject(dirLimit) ? dirLimit : {}
        if (typeof dir !== 'string' || !DIRECTIONS.includes(dir)) {
          add('rules.dirLimit.dir은 네 방향 중 하나여야 한다')
        }
        if (!(isInt(count) && count > 0)) add('rules.dirLimit.count는 양의 정수여야 한다')
      }
      if (swampDeepen !== undefined && typeof swampDeepen !== 'boolean') {
        add('rules.swampDeepen은 참이나 거짓이어야 한다')
      }
      if (mushroomWither !== undefined && typeof mushroomWither !== 'boolean') {
        add('rules.mushroomWither는 참이나 거짓이어야 한다')
      }
      if (vineStop !== undefined && typeof vineStop !== 'boolean') {
        add('rules.vineStop은 참이나 거짓이어야 한다')
      }
      if (seedGrow !== undefined && typeof seedGrow !== 'boolean') {
        add('rules.seedGrow는 참이나 거짓이어야 한다')
      }
      if (wind !== undefined && (typeof wind !== 'string' || !DIRECTIONS.includes(wind))) {
        add('rules.wind는 네 방향 중 하나여야 한다')
      }
      if (plug !== undefined && typeof plug !== 'boolean') {
        add('rules.plug는 참이나 거짓이어야 한다')
      }
      if (melt !== undefined && !(isInt(melt) && melt > 0)) {
        add('rules.melt는 양의 정수여야 한다')
      }
      if (tide !== undefined && typeof tide !== 'boolean') {
        add('rules.tide는 참이나 거짓이어야 한다')
      }
    }
  }
}
