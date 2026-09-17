type Face = 'top' | 'left' | 'right'

const MIX: Record<Face, string> = {
  top: 'white 14%',
  left: 'black 26%',
  right: 'black 10%',
}

// 기본색 토큰에서 큐브 면 색을 만든다
export const shade = (token: string, face: Face) =>
  `color-mix(in srgb, var(--color-${token}), ${MIX[face]})`

export const darken = (token: string, amount: number) =>
  `color-mix(in srgb, var(--color-${token}), black ${amount}%)`
