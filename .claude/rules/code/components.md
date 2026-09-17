---
paths:
  - 'apps/web/src/**/*.tsx'
---

# 컴포넌트 규칙

## 기본

1. 모든 컴포넌트는 **화살표 함수 + 하단 default export**
2. 내부 순서는 변수와 state → 콜백 → useEffect → return
3. **return은 1개만.** 조건부 렌더링은 early return 대신 단일 return 안에서 삼항 연산자나 `&&`로 처리한다
4. JSX return 안에서 변수를 선언하지 않는다. return 위에서 미리 계산한다
5. 이벤트 핸들러는 return 위로 추출한다. 한 줄이면서 단순 setter이고 재사용이 없을 때만 인라인을 허용한다

```tsx
// ❌ return 여러 개
if (isCleared) return <ClearScreen />
return <Board />

// ✅ return 1개
return <>{isCleared ? <ClearScreen /> : <Board />}</>
```

`.map()` 콜백 안에서 종류별로 분기해 반환하는 것은 컴포넌트 return이 아니라 허용한다.

## 게임 화면

- 컴포넌트는 상태를 그리기만 한다. 이동 가능 여부, 상자 밀기, 클리어 판정 같은 규칙은 `game/`의 함수를 호출해서 얻는다
- 아이소메트릭 좌표 계산은 `game/iso.ts`를 쓰고 컴포넌트 안에서 공식을 다시 쓰지 않는다
- 색은 Tailwind 토큰(`fill-player`, `fill-tool`)으로 쓴다. 16진수 색을 직접 쓰지 않는다
- 연출은 `game/`이 돌려준 이벤트(`moved`, `blocked`, `cleared` 등)를 보고 Motion으로 처리한다

## useEffect

- 쓰지 않는 곳: 파생 상태 계산(변수로 계산), 이벤트 처리(핸들러에서)
- 쓰는 곳: 키보드와 터치 리스너 등록 해제, 저장소 동기화, 타이머

## 메모이제이션

- 기본은 쓰지 않는다. 성능 문제를 측정한 뒤 적용한다
- `useMemo`는 무거운 계산에만 (예: 풀이 검사기 결과)
- `useCallback`은 `memo`된 자식에 넘기거나 effect 의존성으로 쓰는 함수일 때만

## 클릭 요소 커서

Tailwind v4부터 `<button>` 기본 커서가 `pointer`가 아니라 클릭 요소엔 `cursor-pointer`를 명시한다.

- 네이티브 `<button>`, `onClick`이 달린 요소, `role="button"`에 추가
- `<a>`와 클릭 없는 표시용 요소엔 붙이지 않는다
