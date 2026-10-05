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
- 순수 함수만 테스트한다. `game/`의 규칙, 풀이 검사기, 형식 검사, 진행 기록과 `components/board/frame/`의 연출 프레임 계산, `components/board/view/`의 큐브 회전과 그림 계산, `platform/`의 입력과 저장, `routes/`의 주소와 탭 제목이다. 브라우저 저장소는 `vi.stubGlobal`로 흉내 낸다
- 테스트는 폴더 단위로 맞춘다. 계산 폴더(`game/`, `game/rules/`, `components/board/frame/`, `components/board/view/`, `platform/`, `routes/`, `store/`, `dev/`)는 모든 파일에 테스트를 두고(`dev/solveWorker.ts`처럼 함수 하나를 부르기만 하는 Worker 진입점은 예외), 화면 폴더(`components/board/`, `components/ui/`, `components/guide/`, `components/dev/`, `screens/`)와 `hooks/`에는 테스트 파일을 두지 않는다
- 예외는 `index.ts`, 타입 파일(`types.ts`), 테스트 샘플 파일(`testStages.ts`)이다. `i18n/`과 `stages/`는 테스트 하나(`i18n.test.ts`, `stages.test.ts`)가 사전과 판 데이터를 통째로 검사한다
- `describe`는 함수 이름, `it`은 한국어로 기대 동작을 한 문장으로 쓴다
- 공용 샘플 스테이지는 파일 상단 대문자 상수로 두고 케이스별 차이는 스프레드로 덮어쓴다
- 동작을 바꾸면 기존 기대값을 새 결정에 맞게 고친다. 옛 동작 테스트를 남겨두지 않는다

## 브라우저 테스트 (Playwright)

- `apps/web/e2e/`에 둔다. 개발 서버는 설정이 5199 포트로 직접 띄운다
- **스모크 테스트** (`pnpm e2e`): 화면이 뜨고 조작이 되는지만 최소 개수로 확인한다. 기능마다 E2E를 만들지 않는다
- **화면 캡처**: 테스트 이름에 태그를 붙이고 `e2e/.screenshots/`에 PNG로 저장한다. 결과 파일은 gitignore
  - `@shot` (`pnpm shot`): 타이틀, 스테이지 선택, 스테이지 1 한 판, 가이드, 화면 크기별 배치, 키보드 포커스, 보스 이동 제한. 화면을 바꾸면 이쪽을 돌린다
  - `@shot-stage` (`pnpm shot:stages`): 스테이지마다 한 판을 두며 남기는 장면. 맵이나 필드 그리기를 바꾸면 이쪽도 돌린다
- 스테이지가 늘면 `screenshots.spec.ts`의 `STAGES` 표에 풀이와 장면 이름만 더한다. 캡처 코드는 늘리지 않는다
- 게임 화면을 바꾸면 캡처하고 Claude가 이미지를 직접 열어 확인한다. 캡처 대상 상태가 없으면 스크립트에 추가한다
- 픽셀 비교 테스트는 두지 않는다
- 움직임의 느낌과 재미는 사용자가 마일스톤마다 확인한다
