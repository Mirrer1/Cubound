import { type CheckContext, type Data, isObject, key } from './stageCheck'

export const checkWhirlpools = ({ entities, add, isFloor, isWaterCell }: CheckContext) => {
  const whirlpools = entities.filter(
    (e): e is Data & { x: number; y: number } =>
      isObject(e) && e.type === 'whirlpool' && isFloor(e) && isWaterCell(e),
  )
  // 상자와 무관하게 소용돌이에서 네 방향으로 이어진 물 칸
  const pulledCells = whirlpools.map((whirlpool) =>
    [
      [0, -1],
      [1, 0],
      [0, 1],
      [-1, 0],
    ].flatMap(([dx, dy]) => {
      const line: string[] = []
      for (
        let p = { x: whirlpool.x + dx, y: whirlpool.y + dy };
        isFloor(p) && isWaterCell(p);
        p = { x: p.x + dx, y: p.y + dy }
      ) {
        line.push(key(p))
      }
      return line
    }),
  )
  const whirlpoolKeys = new Set(whirlpools.map(key))
  const crossed = pulledCells.some(
    (cells, i) =>
      cells.some((cell) => whirlpoolKeys.has(cell)) ||
      pulledCells.slice(i + 1).some((other) => other.some((cell) => cells.includes(cell))),
  )
  if (crossed) add('소용돌이 둘의 끄는 줄이 겹친다')
  const hasPost = entities.some((e) => isObject(e) && e.type === 'post')
  if (whirlpools.length > 0 && hasPost) add('소용돌이와 말뚝을 한 판에 같이 둘 수 없다')
}
