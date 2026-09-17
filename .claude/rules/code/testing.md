---
paths:
  - 'apps/web/src/**/*.test.ts'
  - 'apps/web/vite.config.ts'
  - 'apps/web/e2e/**'
  - 'apps/web/playwright.config.ts'
---

# 테스트 규칙

## 단위 테스트 (Vitest)

- `vite.config.ts`의 `test.include`가 `src/**/*.test.ts`만 수집한다
- 테스트 파일은 대상 파일 옆에 `대상.test.ts`로 둔다
- 순수 함수만 테스트한다. 주로 `game/`의 규칙, 풀이 검사기, 좌표 변환이다
- `describe`는 함수 이름, `it`은 한국어로 기대 동작을 한 문장으로 쓴다
- 공용 샘플 스테이지는 파일 상단 대문자 상수로 두고 케이스별 차이는 스프레드로 덮어쓴다
- 동작을 바꾸면 기존 기대값을 새 결정에 맞게 고친다. 옛 동작 테스트를 남겨두지 않는다

## 브라우저 테스트 (Playwright)

- `apps/web/e2e/`에 둔다. 개발 서버는 설정이 5199 포트로 직접 띄운다
- **스모크 테스트** (`pnpm e2e`): 화면이 뜨고 조작이 되는지만 최소 개수로 확인한다. 기능마다 E2E를 만들지 않는다
- **화면 캡처** (`pnpm shot`): 테스트 이름에 `@shot`을 붙이고 `e2e/.screenshots/`에 PNG로 저장한다. 결과 파일은 gitignore
- 게임 화면을 바꾸면 `pnpm shot`으로 캡처하고 Claude가 이미지를 직접 열어 확인한다. 캡처 대상 상태가 없으면 스크립트에 추가한다
- 픽셀 비교 테스트는 두지 않는다
- 움직임의 느낌과 재미는 사용자가 마일스톤마다 확인한다
