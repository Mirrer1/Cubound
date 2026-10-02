type Face = 'top' | 'left' | 'right'

const MIX: Record<Face, string> = {
  top: 'white 14%',
  left: 'black 24%',
  right: 'black 9%',
}

// 기본색 토큰에서 만든 큐브 면 색
export const shade = (token: string, face: Face) =>
  `color-mix(in srgb, var(--color-${token}), ${MIX[face]})`

export const darken = (token: string, amount: number) =>
  `color-mix(in srgb, var(--color-${token}), black ${amount}%)`

export const blend = (a: string, b: string, t: number) =>
  `color-mix(in srgb, ${a}, ${b} ${t * 100}%)`

export const dim = (color: string, amount: number) =>
  `color-mix(in srgb, ${color}, black ${amount}%)`

// 한 칸씩 번갈아 아주 미세하게 어두운 색, 같은 종류 칸이 붙어 있어도 세이는 칸 수
export const checker = (color: string, parity: boolean) =>
  parity ? `color-mix(in srgb, ${color}, black 3.4%)` : color
