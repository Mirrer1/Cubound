# 디자인 시안

Claude Design으로 받은 프로토타입이다. **모양과 색과 치수를 참고하는 용도**이고 코드는 가져오지 않는다.

`.dc.html`은 브라우저로 바로 열면 된다. `support.js`와 `cubound-iso.js`는 시안들이 함께 쓰는 파일이라 지우면 안 된다.

## 무엇이 어디에 있나

| 파일 | 내용 | 쓴 곳 |
| --- | --- | --- |
| `Cubound Gameplay.dc.html` | 타이틀, 스테이지 선택, 게임, 클리어 화면과 오브젝트 상태별 스타일 | 1~3월드 |
| `Cubound Terrain System.dc.html` | 칸과 높이와 명암 규칙 | 전체 |
| `Cubound Tram.dc.html` | 움직이는 발판. 구덩이와 레일과 멈춤 블록 | 4월드 |
| `Cubound Layout Studies.dc.html` | 목록 화면과 폰 헤더 배치 안들 | 목록·헤더 |
| `Cubound Cycle Select.dc.html` | 사이클 고르는 화면 | **아직 안 씀.** 2사이클 끝나고 |
| `Cubound Cycle 2 Forest.dc.html` | 2사이클 세계 색 (숲) | **썼다.** 셋 중 C안("조금 더")으로 갔다 |
| `Cubound Swamp.dc.html` | 늪 | **썼다.** 6월드 |
| `Cubound Mushroom.dc.html` | 버섯 | **아직 안 씀.** 7월드 |
| `Cubound Vine.dc.html` | 덩굴 | **아직 안 씀.** 8월드 |
| `Cubound Seed.dc.html` | 씨앗 | **아직 안 씀.** 9월드 |
| `Cubound Water.dc.html` | 물 | **안 쓴다.** 아래 참고 |

## 규칙

- **시안은 쓸 때가 돼서 받는다.** 미리 받아 두면 그 사이에 팔레트와 요소가 달라져서 못 쓴다
- **물 시안이 그 예다.** 4사이클(151~200)용으로 미리 받아 뒀는데 그때가 한참 남아 쓸 수 없게 됐다. **4사이클을 시작할 때 다시 받는다.** 방향을 적어 둔 기록으로만 남긴다
- 프로토타입의 **이동 로직은 PRD와 다르다.** 참고하지 않는다
- 전달용 브리프는 `docs/DESIGN_BRIEF.md`에 있다
