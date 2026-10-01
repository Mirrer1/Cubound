export const easeIn = (t: number) => t * t

export const easeOut = (t: number) => 1 - (1 - t) ** 2

// 천천히 시작해 천천히 멈춘다. 씨앗이 솟는 곡선과 같다
export const smooth = (t: number) => t * t * (3 - 2 * t)

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

// 연달아 이동할 때 앞뒤 이동과 이어지는 쪽은 멈추지 않고 굴러간다
export interface Chain {
  in: boolean // 앞 이동에서 바로 이어짐
  out: boolean // 다음 입력이 기다림
}

export const NO_CHAIN: Chain = { in: false, out: false }

// 0에서 멈춰 있다가 0.5에서 속도 1로 이어지는 앞쪽 절반 곡선
const startHalf = (t: number) => -4 * t ** 3 + 4 * t ** 2

// 앞쪽 절반은 앞 이동과의 이어짐만, 뒤쪽 절반은 다음 입력만 보고 정해 도중에 입력이 와도 튀지 않는다
export const moveEase = (t: number, chain: Chain) =>
  t < 0.5 ? (chain.in ? t : startHalf(t)) : chain.out ? t : 1 - startHalf(1 - t)
