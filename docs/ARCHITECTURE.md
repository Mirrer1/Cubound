# Cubound Architecture

## 원칙

- **로직과 화면 분리:** 게임 규칙은 React와 무관한 순수 TypeScript 함수로 만든다. 화면, 풀이 검사기, 테스트가 같은 로직을 쓴다
- **로직은 2D 칸, 화면만 아이소메트릭:** 좌표는 `(x, y)`와 칸 높이. 그릴 때만 아이소메트릭으로 변환한다
- **스테이지는 데이터:** 스테이지 1개 = JSON 1개. 코드 수정 없이 스테이지를 추가한다
- **플랫폼 의존 부분은 한 겹 감싼다:** 입력(키보드/스와이프), 저장(localStorage/Capacitor Preferences)
- **서버 없이 시작:** 정적 파일 배포만으로 동작한다

## 기술 스택

| 영역            | 선택                | 이유                                                                |
| --------------- | ------------------- | ------------------------------------------------------------------- |
| 패키지 매니저   | pnpm 워크스페이스   | 모노레포. 나중에 서버를 같은 저장소에 추가                          |
| 빌드            | Vite 8              | 가볍고 빠름. SSR이 필요 없어 Next.js 불필요                         |
| UI              | React 19            | 메뉴, 스테이지 선택, HUD                                            |
| 언어            | TypeScript (strict) | 칸, 오브젝트, 규칙을 타입으로 관리                                  |
| 게임 화면       | SVG                 | 칸 수십 개 수준이면 충분. 오브젝트가 많아지면 PixiJS 검토           |
| 애니메이션      | Motion              | 이동, 떨어짐, 클리어 연출                                           |
| 상태            | Zustand             | 게임 상태와 진행 상황                                               |
| 스타일          | Tailwind CSS v4     | UI. 색은 `apps/web/src/index.css`의 `@theme` 토큰                   |
| 테스트          | Vitest, Playwright  | 규칙과 풀이 검사기는 Vitest. 스모크 테스트와 화면 캡처는 Playwright |
| 린트            | oxlint              | Vite 기본 템플릿. 가벼움                                            |
| 포맷            | Prettier            | import 정렬, Tailwind 클래스 정렬                                   |
| 배포            | Vercel (무료)       | 정적 배포                                                           |
| 모바일 (나중에) | Capacitor           | 웹 코드를 앱으로 포장                                               |

**Node.js 22.12 이상 필요** (Vite 8 요구사항).

## 모노레포 구조

```
cubound/
├── apps/
│   ├── web/                 # 게임 (지금 개발하는 곳)
│   └── server/              # 비어 있음. 나중에 NestJS
├── packages/                # 비어 있음. 나중에 공유 코드
├── docs/
├── package.json             # 스크립트와 저장소 전체 도구(Prettier, Husky, lint-staged)만
├── pnpm-workspace.yaml      # 워크스페이스 범위 + 공유 버전 catalog
└── tsconfig.base.json       # 공통 TypeScript 설정
```

### 관리 규칙

- **의존성은 쓰는 곳에:** 각 앱과 패키지의 `package.json`에 둔다. 루트에는 Prettier처럼 저장소 전체에 쓰는 도구만 둔다
- **공유 버전은 catalog:** 두 곳 이상에서 쓰는 의존성(typescript, vitest, @types/node 등)은 `pnpm-workspace.yaml`의 `catalog`에 버전을 두고, 각 `package.json`에서 `"catalog:"`로 참조한다
- **설정은 extends:** 각 앱의 tsconfig는 `tsconfig.base.json`을 확장하고, 앱에 필요한 옵션만 덧붙인다
- **패키지 이름:** `@cubound/<이름>` (예: `@cubound/web`, `@cubound/server`)

### 서버가 생기면

- `apps/server`: NestJS
- **`packages/game`:** 지금 `apps/web/src/game/`에 있는 순수 로직을 옮긴다. 서버에서도 같은 규칙과 풀이 검사기로 기록을 검증할 수 있다. 그래서 `game/`은 처음부터 React를 import하지 않는다
- **`packages/shared`:** 필요하면 web과 server가 주고받는 API 타입

## web 폴더 구조 (계획)

`apps/web/` 기준.

```
src/
├── game/              # 순수 로직 (React import 금지)
│   ├── types.ts       # Stage, Tile, Entity, Direction, GameState
│   ├── rules.ts       # move(state, dir) → 다음 상태
│   ├── solver.ts      # BFS: 풀이 가능 여부, 최소 이동 수
│   ├── iso.ts         # 칸 좌표 → 화면 좌표 변환
│   └── *.test.ts
├── stages/            # 스테이지 JSON
│   └── world-1/01.json ~ 10.json
├── store/             # Zustand (게임 진행, 저장 진행 상황)
├── platform/          # 플랫폼 의존 부분
│   ├── storage.ts     # 저장소 인터페이스 + localStorage 구현
│   └── input.ts       # 키보드/스와이프 → Direction
├── components/
│   ├── board/         # SVG 필드, 타일, 큐브, 오브젝트
│   └── ui/            # 버튼, HUD, 스테이지 선택
├── screens/           # Title, StageSelect, Play, Clear
├── App.tsx
└── index.css          # Tailwind + 색 토큰
```

## 게임 모델

### 좌표와 방향

- 칸 좌표 `(x, y)`, 칸마다 높이 `h` (0부터)
- 방향 `Direction = 'up' | 'right' | 'down' | 'left'`는 **맵 축 기준**
  - `up`: y-1, `right`: x+1, `down`: y+1, `left`: x-1
  - 아이소메트릭으로 그리면 ↑ 오른쪽 위, → 오른쪽 아래, ↓ 왼쪽 아래, ← 왼쪽 위가 된다

### 스테이지 JSON (초안)

```json
{
  "id": "1-3",
  "name": "First Box",
  "size": { "w": 6, "h": 5 },
  "heights": [
    [0, 0, 0, 1, 1, 1],
    [0, 0, 0, 1, 1, 1],
    [0, 0, 0, 1, 1, 1],
    [-1, -1, 0, 0, 0, 0],
    [-1, -1, 0, 0, 0, 0]
  ],
  "start": { "x": 0, "y": 0 },
  "goal": { "x": 5, "y": 1 },
  "entities": [
    { "type": "box", "x": 1, "y": 1 },
    { "type": "switch", "x": 2, "y": 2, "target": "door-a" },
    { "type": "door", "id": "door-a", "x": 4, "y": 2 },
    { "type": "ladder", "x": 3, "y": 4 }
  ],
  "rules": { "moveLimit": null },
  "guides": [{ "id": "push-box", "target": { "x": 1, "y": 1 }, "until": "pushed" }],
  "zones": [{ "x": 0, "y": 0, "w": 6, "h": 5 }]
}
```

- `heights`: 행(y) → 열(x). `-1`은 빈 칸 (바닥 없음, 상자로 메울 수 있음)
- `rules.moveLimit`: 보스 제약. 월드가 늘면 제약 종류를 여기에 추가한다
- `guides`: 가이드 말풍선. `until` 이벤트가 나오면 사라진다. 문구는 스테이지 JSON이 아니라 코드의 문구 모음에 `id`로 둔다 (웹과 모바일 문구가 달라서). 클리어한 스테이지면 띄우지 않는다
- `zones`: 카메라 구역 사각형 목록. 모든 칸은 하나 이상의 구역에 속한다. 화면 표시에만 쓰고 게임 규칙에는 영향이 없다

### 상태와 규칙

```ts
move(state: GameState, dir: Direction): GameState
```

- 불변 상태를 받아 새 상태를 돌려주는 순수 함수
- 이동이 불가능하면 같은 상태를 돌려주고, 화면은 흔들림 연출만 한다
- 결과에 연출용 이벤트(`moved`, `pushed`, `fell`, `blocked`, `cleared` 등)를 함께 담는다
- 사다리 줍기와 놓기도 이동 1회로 센다

### 풀이 검사기

- `solve(stage)`: 상태 공간 BFS로 최소 이동 수를 구한다
- 용도
  - 스테이지가 풀리는지 테스트로 검증
  - 별 기준 자동 계산. 월드의 별 기준(이동 수, 밟은 칸 수, 도구 사용 횟수 등)을 비용으로 두고 최솟값을 구한다. 이동 수가 아닌 기준은 비용이 다른 이동이 섞여 BFS 대신 가중치 탐색(0-1 BFS나 Dijkstra)을 쓴다
  - 보스 이동 제한 계산
  - 나중에 힌트 기능

## 렌더링

- 아이소메트릭 변환: `screenX = (x - y) × tileW/2`, `screenY = (x + y) × tileH/2 - h × layerH`
- 칸 하나 = 윗면, 왼쪽 면, 오른쪽 면 3개의 다각형. 명암으로 입체감
- **그리는 순서:** `x + y`가 작은 것부터, 같으면 높이가 낮은 것부터 (뒤에서 앞으로)
- **가림 처리:** 앞쪽의 높은 칸이 큐브나 오브젝트를 가리면 그 칸만 반투명하게 그린다. 큐브는 항상 보여야 한다
- 화면 크기에 맞춰 SVG `viewBox`로 스케일
- **카메라 (구역 방식):** 스테이지는 `zones`로 나뉜 넓은 필드다. 큐브가 들어선 구역 전체가 화면에 맞게 보이도록 카메라가 부드럽게 이동하고 확대 배율을 맞춘다. 칸 크기는 구역 기준으로 정해져서 필드가 넓어져도 칸이 작아지지 않는다. 모바일 세로 화면에서 구역이 너무 넓으면 구역 안에서 큐브를 따라간다

## 애니메이션

- **로직은 즉시, 연출은 뒤따라감:** `move()`는 결과 상태와 이벤트를 바로 돌려주고, 화면이 이전 상태에서 새 상태로 보간한다. 풀이 검사기와 테스트는 연출과 무관하다
- **큐브 구르기:** 큐브 8개 꼭짓점을 3D 좌표로 두고, 이동 방향의 아래 모서리를 축으로 0°→90° 회전한 뒤 매 프레임 아이소메트릭으로 투영해 SVG 다각형을 다시 그린다. 면 명암은 면이 향하는 방향으로 정한다. 2D SVG로도 실제로 구르는 모습이 나온다
- **막힘:** 같은 축으로 조금만 기울었다가 되돌아온다
- **그 밖의 연출:** 상자 이동, 낙하, 스위치와 문, 사다리, 클리어는 Motion으로 위치와 투명도를 보간한다
- **입력 버퍼:** 연출 중 입력은 무시하지 않고 1개까지 기억했다가 연출이 끝나면 실행한다. 빠르게 눌러도 끊기지 않게 하기 위함
- **속도:** 한 칸 이동 약 150~200ms. 클리어 때 구멍으로 가라앉는 연출은 이동보다 확실히 느리게 약 600~800ms로 하고, 이어서 축하 연출을 보여준다. 모두 실제 플레이로 조정한다

## 디자인 기준값

기준 파일은 `docs/design/Cubound Gameplay.dc.html` (Claude Design에서 내보낸 프로토타입). 모양, 색, 여백은 이 파일을 참고해 옮기고, 게임 로직은 참고하지 않는다. 브라우저로 열어 볼 수 있다.

### 색 토큰

`apps/web/src/index.css`의 `@theme`에 정의. Tailwind 클래스로 쓴다 (예: `bg-player`).

| 토큰          | 값        | 용도                        |
| ------------- | --------- | --------------------------- |
| `page-bg`     | `#E9E7E2` | 화면 가장 바깥 배경         |
| `base-bg`     | `#F2F1EE` | 카드와 게임 영역 배경       |
| `line`        | `#DCD9D3` | 카드 테두리                 |
| `line-strong` | `#CFCCC6` | 버튼 테두리                 |
| `ink`         | `#3A3936` | 글자, 진한 버튼             |
| `mute`        | `#8A8781` | 작은 라벨, 보조 글자        |
| `floor-top`   | `#E3E1DC` | 바닥 윗면                   |
| `floor-left`  | `#B5B2AB` | 바닥 왼쪽 면 (어두움)       |
| `floor-right` | `#CBC8C2` | 바닥 오른쪽 면              |
| `player`      | `#8FB3C9` | 플레이어 큐브 기본색        |
| `tool`        | `#E3CD8E` | 상자, 스위치, 사다리 기본색 |
| `goal`        | `#4A4845` | 목표 구멍                   |

- **큐브 면 명암:** 기본색에서 윗면은 흰색 14% 섞기, 왼쪽 면은 검정 26% 섞기, 오른쪽 면은 검정 10% 섞기. 플레이어와 도구 모두 같은 공식이라 스킨 색만 바꾸면 명암이 따라온다
- **칸 경계:** 선 대신 체크무늬로 번갈아 윗면을 검정 2.8% 섞어 아주 미세하게 어둡게 한다
- 큐브 색은 스킨으로 바꿀 수 있게 컴포넌트에 직접 넣지 않고 스킨 데이터로 받는다

### 글꼴

| 용도                  | 글꼴                                |
| --------------------- | ----------------------------------- |
| 제목, 숫자, 버튼      | Jost (300, 400, 500)                |
| 작은 영어 대문자 라벨 | IBM Plex Mono (400, 500), 자간 넓게 |

한글은 Jost에 없어서 시스템 글꼴로 대체된다. 한글 글꼴은 구현하며 정한다.

### 아이소메트릭 치수 (기본 배율)

| 값                 | 크기           | 뜻                   |
| ------------------ | -------------- | -------------------- |
| 칸 폭 `TW`         | 104            | 마름모 가로          |
| 칸 높이 `TH`       | 52             | 마름모 세로 (2:1)    |
| 한 층 `HU`         | 30             | 높이 1당 올라가는 양 |
| 바닥 두께 `LIP`    | 16             | 높이 0 칸의 옆면     |
| 플레이어와 상자 폭 | 칸 폭의 60/104 | 칸보다 작은 정육면체 |

화면과 구역 크기에 맞춰 전체 배율을 곱해 쓴다. 넓은 맵 예시는 칸 폭 약 60이다.

### 모서리 둥글기

카드 22, 스테이지 카드 16~18, 버튼 13, 진한 큰 버튼 16

## 저장

```ts
interface Storage {
  load(): Progress
  save(progress: Progress): void
}
```

- `Progress`: 해금된 스테이지, 스테이지별 최고 별점
- 웹: localStorage
- 앱: Capacitor Preferences (iOS WebView의 localStorage는 지워질 수 있음)
- 나중에 서버 저장이 생기면 같은 인터페이스로 구현을 추가한다

## 배포

- **웹:** Vercel. Root Directory를 `apps/web`로 설정, `pnpm build` → `apps/web/dist/`
- **앱 (나중에):** Capacitor
  - 안드로이드는 Windows에서 빌드 가능
  - iOS는 Mac 또는 클라우드 빌드(Codemagic 등) 필요
  - 등록비: Google Play 25달러(1회), Apple 연 99달러

## 서버 (나중에)

지금은 `apps/server` 폴더만 있음. 랭킹, 이어하기, 스테이지 공유, 결제 검증이 필요해지면 **NestJS + 무료 DB**(Supabase, Neon 등)를 추가한다. 앱 결제는 RevenueCat도 검토한다.
