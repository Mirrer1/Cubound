type Face = 'top' | 'left' | 'right'

const MIX: Record<Face, string> = {
  top: 'white 14%',
  left: 'black 24%',
  right: 'black 9%',
}

// 기본색 토큰에서 큐브 면 색을 만든다
export const shade = (token: string, face: Face) =>
  `color-mix(in srgb, var(--color-${token}), ${MIX[face]})`

export const darken = (token: string, amount: number) =>
  `color-mix(in srgb, var(--color-${token}), black ${amount}%)`

// 두 색 사이를 진행도만큼 섞는다
export const blend = (a: string, b: string, t: number) =>
  `color-mix(in srgb, ${a}, ${b} ${t * 100}%)`

// 색을 그만큼 어둡게 한다
export const dim = (color: string, amount: number) =>
  `color-mix(in srgb, ${color}, black ${amount}%)`

// 한 칸씩 번갈아 아주 미세하게 어둡게 한다. 같은 종류 칸이 붙어 있어도 몇 칸인지 세인다
export const checker = (color: string, parity: boolean) =>
  parity ? `color-mix(in srgb, ${color}, black 3.4%)` : color
