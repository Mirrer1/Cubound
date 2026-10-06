import type { Stage } from '../types'
import { checkCracks } from './crackCheck'
import { checkEntities } from './entityCheck'
import { checkGuides } from './guideCheck'
import { checkIce } from './iceCheck'
import { checkIceStones } from './iceStoneCheck'
import { checkMushroom } from './mushroomCheck'
import { checkRules } from './rulesCheck'
import { checkSluices } from './sluiceCheck'
import { checkBest, checkStartGoal, isObject, stageContext } from './stageCheck'
import { checkSwamp } from './swampCheck'
import { checkTethers } from './tetherCheck'
import { checkTrams } from './tramCheck'
import { checkVines } from './vineCheck'
import { checkWater } from './waterCheck'
import { checkWhirlpools } from './whirlpoolCheck'
import { checkZones } from './zoneCheck'

export { STAGE_VERSION } from './stageCheck'

export type ValidateResult = { ok: true; stage: Stage } | { ok: false; errors: string[] }

// 공식 스테이지와 유저가 공유한 맵의 같은 검사 기준
export const validateStage = (data: unknown): ValidateResult => {
  if (!isObject(data)) return { ok: false, errors: ['스테이지가 객체가 아니다'] }

  const errors: string[] = []
  const add = (message: string) => errors.push(message)

  const ctx = stageContext(data, add)
  if (!ctx) return { ok: false, errors }

  checkIce(ctx)
  checkCracks(ctx)
  checkSwamp(ctx)
  checkMushroom(ctx)
  checkWater(ctx)
  checkStartGoal(ctx)
  checkTrams(ctx)
  checkVines(ctx)
  checkEntities(ctx)
  checkTethers(ctx)
  checkWhirlpools(ctx)
  checkIceStones(ctx)
  checkSluices(ctx)
  checkBest(ctx)
  checkRules(ctx)
  checkGuides(ctx)
  checkZones(ctx)

  return errors.length > 0 ? { ok: false, errors } : { ok: true, stage: data as unknown as Stage }
}
