# Cubound 작업 이력

> 만든 순서대로의 작업 이력. 자동으로 읽히지 않는 참고 문서라 기존 기능을 고치기 전에 해당 항목을 찾아본다. 새 항목은 맨 뒤에 쌓는다.

**기획.** 작은 큐브가 칸을 하나씩 건너 구멍을 찾아가는 아이소메트릭 퍼즐로 정했다. 규칙, 오브젝트, 스테이지 구성, 보스는 `docs/PRD.md`, 구조와 게임 모델은 `docs/ARCHITECTURE.md`, 디자인 방향은 `docs/DESIGN_BRIEF.md`에 정리했다. Bloxorz와 달리 큐브 모양을 1×1×1로 고정하고, 재미를 높이 차이와 오브젝트 조합에서 만들기로 했다. 게임 오버 대신 재시작만 두고, 보스마다 고유 제약을 주며 1월드 보스는 이동 횟수 제한으로 정했다. 능력이 있는 유료 큐브는 퍼즐과 별점을 망가뜨려서 기각했다.

**초기 세팅.** Vite 8, React 19, TypeScript strict, Tailwind v4, Zustand, Motion, Vitest로 pnpm 워크스페이스 모노레포를 만들었다. 게임은 `apps/web`, 나중의 NestJS 서버는 `apps/server`, 공유 코드는 `packages/`에 둔다. 의존성은 각 앱에 두고, 공유 버전은 `pnpm-workspace.yaml`의 `catalog`, 공통 TypeScript 설정은 `tsconfig.base.json`으로 관리한다. 운영비 0원을 위해 서버와 DB 없이 정적 배포로 시작한다. 곁가지: Node 22.11에서 Vite 8의 네이티브 모듈이 설치되지 않아 Node 24로 올렸다.

**작업 규칙.** 이전 프로젝트의 규칙을 가져와 `.claude/rules/code/`(공통, 컴포넌트, 게임 로직, 테스트)와 `/update-docs` 스킬을 만들었다. Next.js, DB, 외부 API 규칙은 이 프로젝트에 해당하지 않아 뺐고, 게임 로직 순수성 규칙을 새로 넣었다. Prettier와 import 정렬, Tailwind 클래스 정렬, `@/` 경로 별칭을 추가했다. 곁가지: git 저장소를 만들고 Husky와 lint-staged로 커밋 전 자동 검사를 붙였다. Windows의 `core.autocrlf`와 Prettier 줄바꿈이 충돌하지 않게 `.gitattributes`로 LF를 고정했다.
