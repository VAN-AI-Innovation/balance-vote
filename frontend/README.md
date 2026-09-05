# balance-vote frontend

컨퍼런스 세션용 실시간 밸런스 투표 화면 (React 19 / Vite / TypeScript).

## 화면

| 경로 | 사용자 | 설명 |
| --- | --- | --- |
| `/` | — | 화면 안내. 어떤 주소로 들어가야 하는지 알려 준다 |
| `/participant` | 관객 | 휴대폰으로 투표하는 화면. QR 코드는 이 주소로 연결한다 |
| `/result` | 무대 | 프로젝터용 실시간 득표율 화면. `F` 키로 전체화면 전환 |
| `/admin` | 진행자 | 연도별 투표 열기/닫기, 선택지·문제 관리, 결과 CSV 내려받기 |

## 로컬 실행

```bash
npm install
npm run dev
```

백엔드(`../backend`)를 `localhost:8080` 에 띄워 두면 된다.
`vite.config.ts` 의 프록시가 `/api` 와 `/ws` 를 백엔드로 넘기므로
`.env` 설정 없이 동작하고, `--port` 나 `--host` 를 바꿔도 그대로 동작한다.

## 환경 변수

| 변수 | 필요 시점 | 설명 |
| --- | --- | --- |
| `VITE_API_BASE_URL` | 배포 | 백엔드 API 주소. **`/api` 까지 포함**해야 한다 |
| `VITE_WS_URL` | 배포 | WebSocket 주소. `wss://.../ws` |

비워 두면 같은 오리진의 `/api`, `/ws` 를 사용한다. 로컬에서는 프록시가
이를 처리하지만, 배포 환경에서 백엔드가 다른 호스트에 있으면 반드시
지정해야 한다. Vercel 은 WebSocket 을 rewrite 로 프록시하지 못하기 때문에
`/ws` 를 같은 오리진으로 둘 수 없다.

## Vercel 배포

`vercel.json` 이 SPA rewrite 를 담당한다. 라우팅이 `window.location.pathname`
기반이므로 rewrite 가 없으면 `/admin` 이나 `/result` 를 직접 열거나
새로고침할 때 Vercel 404 가 표시된다.

rewrite 패턴에서 `/api` 와 `/ws` 는 제외한다. 포함하면 백엔드 주소가
설정되지 않았을 때 API 요청이 `index.html` 을 HTTP 200 으로 받아
"JSON 파싱 실패" 처럼 보여 원인을 찾기 어렵다.

프로젝트 설정:

- **Root Directory**: `frontend`
- **Framework Preset**: Vite (`vercel.json` 에 명시되어 있다)
- **Environment Variables**: `VITE_API_BASE_URL`, `VITE_WS_URL`
  (Production / Preview 양쪽에 지정)

백엔드에도 아래 설정이 필요하다.

- `CORS_ALLOWED_ORIGINS` 에 Vercel 도메인 추가.
  preview 배포까지 포함하려면 와일드카드를 사용한다.
  예: `https://van.io.kr,https://*.vercel.app`
- `ADMIN_TOKEN` 지정. 이 값이 `/admin` 화면에서 입력하는 관리자 키다.

환경 변수를 바꾼 뒤에는 **재배포해야 반영된다.** `VITE_` 변수는
빌드 시점에 번들에 포함되기 때문이다.

### 현재 배포 상태

프론트엔드는 `https://van.io.kr` 에 연결되어 있고 `main` 이 자동 배포된다.
다만 **백엔드가 배포되어 있지 않다.** 확인 결과:

- `VITE_API_BASE_URL` / `VITE_WS_URL` 이 Vercel 에 설정되어 있지 않다
  (번들에 백엔드 절대 주소가 들어 있지 않다)
- `api.van.io.kr` 등 백엔드용 호스트가 존재하지 않는다

따라서 화면은 열리지만 투표 기능은 동작하지 않는다.
행사 전에 아래가 필요하다.

1. 백엔드를 공개 주소에 배포한다 (WebSocket 을 지원하는 호스팅 필요.
   Vercel 은 WebSocket 을 프록시하지 못하므로 별도 호스팅이어야 한다)
2. 백엔드에 `ADMIN_TOKEN`, `CORS_ALLOWED_ORIGINS`, `SPRING_DATASOURCE_*` 설정
3. Vercel 에 `VITE_API_BASE_URL`, `VITE_WS_URL` 설정 후 재배포

## 구조

```
src/
├── api.ts           REST 클라이언트. 관리자 요청에 X-Admin-Token 을 붙인다
├── config.ts        환경 변수 해석, 관리자 키 저장(sessionStorage)
├── stomp.ts         앱 전체가 공유하는 STOMP 연결 1개
├── types.ts         백엔드 DTO 와 대응하는 타입
├── hooks/
│   ├── useCurrentSession.ts   현재 세션을 /topic/session 으로 실시간 추적
│   └── useLiveResult.ts       연도별 집계를 /topic/vote/{year} 로 추적
├── components/VoteRateBar.tsx 득표율 막대 (색상·애니메이션)
└── pages/           LandingPage / ParticipantPage / ResultPage / AdminPage
```

### 실시간 동작

- STOMP 연결은 앱당 하나다. 화면마다 만들면 소켓 수가 그대로 서버 부하가 된다.
- `/topic/session` 을 구독해 진행자의 연도 전환과 상태 변경을 즉시 반영한다.
  폴링(10초)은 WebSocket 이 끊긴 동안을 위한 안전망이다.
- `/topic/vote/{year}` 로 집계를 받고, `sequence` 가 이미 적용한 값보다
  작은 프레임은 버린다. 동시 투표가 몰리면 메시지 도착 순서가 어긋나
  총 득표수가 순간적으로 줄어드는 것처럼 보일 수 있다.
- 재연결되면 REST 로 최신 집계를 다시 받아 끊긴 동안의 투표를 메운다.

## 진행 순서

1. `/admin` 에서 관리자 키를 입력한다.
2. 연도를 선택해 문제 문구와 선택지(2개 이상)를 등록한다.
3. `/result` 를 프로젝터에, `/participant` QR 을 관객에게 안내한다.
4. **투표 열기** — 해당 연도가 자동으로 현재 세션이 되고
   다른 연도가 열려 있으면 마감된다.
5. **투표 마감** — 결과 화면에 최종 수치와 최다 득표가 표시된다.
6. 다음 연도로 이동해 4~5를 반복한다.
7. 진행 후 **전체 결과 CSV** 로 5개 연도 결과를 한 번에 내려받는다.
