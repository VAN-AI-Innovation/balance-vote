# balance-vote backend

컨퍼런스 세션용 실시간 밸런스 게임 투표 API (Spring Boot 4 / Java 21 / PostgreSQL).

## 로컬 실행

```bash
docker compose up -d          # PostgreSQL 17
./gradlew bootRun
```

`admin.token` 이 비어 있으면 관리자 인증이 비활성화되므로 로컬에서는 별도 설정이 필요 없다.

## 환경 변수

운영 배포 시 아래 값을 주입한다. 모두 기본값이 있어 로컬 실행에는 필요 없다.

| 변수 | 기본값 | 설명 |
| --- | --- | --- |
| `SPRING_DATASOURCE_URL` | `jdbc:postgresql://localhost:5432/balance_vote` | DB 접속 URL |
| `SPRING_DATASOURCE_USERNAME` | `postgres` | DB 사용자 |
| `SPRING_DATASOURCE_PASSWORD` | `postgres` | DB 비밀번호 |
| `DB_POOL_SIZE` | `30` | HikariCP 최대 커넥션 수 |
| `PORT` | `8080` | 서버 포트 |
| `ADMIN_TOKEN` | (없음) | **운영에서 반드시 지정.** 관리자 API 보호용 공유 키. 비어 있으면 인증이 꺼진다 |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:5173,http://localhost:4173` | 허용 오리진(쉼표 구분). 와일드카드 가능: `https://*.vercel.app` |
| `WS_ALLOWED_ORIGINS` | `*` | WebSocket 허용 오리진 |
| `VOTE_SESSION_YEARS` | `2030,2035,2040,2045,2050` | 진행할 연도. 재시작 시 없는 연도만 생성된다 |
| `JPA_SHOW_SQL` | `false` | SQL 로그 |

## 관리자 인증

`ADMIN_TOKEN` 이 설정되면 아래 요청에 `X-Admin-Token` 헤더가 필요하다.

- `/api/sessions/**` 의 모든 `POST` / `PUT` / `PATCH` / `DELETE`
- `/api/sessions/**/export**` (투표자 토큰이 포함되므로 조회도 보호한다)

참가자 경로(`/api/sessions/{year}/votes/**`)와 조회 API 는 공개다.

## API

### 참가자

| 메서드 | 경로 | 설명 |
| --- | --- | --- |
| `POST` | `/api/sessions/{year}/votes/token` | 투표자 토큰 발급 (세션이 OPEN 일 때만) |
| `POST` | `/api/sessions/{year}/votes` | 투표. 본문 `{ optionId, voterToken }`. 중복은 409 |
| `GET` | `/api/sessions/{year}/votes/status?voterToken=` | 투표 여부 확인 |
| `GET` | `/api/sessions/{year}/votes/result` | 현재 집계 (재연결 시 스냅샷 용도) |
| `GET` | `/api/sessions` / `/api/sessions/current` / `/api/sessions/{year}` | 세션 조회 |

### 관리자

| 메서드 | 경로 | 설명 |
| --- | --- | --- |
| `POST` | `/api/sessions/{year}/open` | 오픈. 자동으로 현재 세션이 되고 다른 OPEN 세션은 마감된다 |
| `POST` | `/api/sessions/{year}/close` | 마감 |
| `POST` | `/api/sessions/{year}/reopen` | 재오픈 (득표 유지). `open` 과 동일하게 동작 |
| `POST` | `/api/sessions/{year}/reset` | 초기화. 투표 기록을 삭제하고 WAITING 으로 되돌린다 |
| `PUT` | `/api/sessions/{year}/current` | 현재 세션 지정 |
| `PUT` | `/api/sessions/{year}/question` | 문제 문구 저장. 본문 `{ question }` |
| `GET`/`POST`/`PUT`/`DELETE` | `/api/sessions/{year}/options[/{optionId}]` | 선택지 CRUD (WAITING 상태에서만 변경 가능) |
| `GET` | `/api/sessions/export` | 전체 연도 집계 CSV |
| `GET` | `/api/sessions/{year}/export` | 해당 연도 집계 CSV |
| `GET` | `/api/sessions/{year}/export/records` | 해당 연도 개별 투표 기록 CSV |

`open` / `close` 는 멱등하다. 이미 원하는 상태면 그대로 200 을 반환하므로
진행 중 응답을 놓친 진행자가 다시 눌러도 실패하지 않는다.

### 상태 전이

```
WAITING --open--> OPEN --close--> CLOSED
   ^                |                |
   |                |                |
   +----- reset ----+---- reopen ----+
```

선택지 변경은 `WAITING` 에서만 허용한다. 진행/마감 후 선택지를 바꾸면
이미 집계된 득표의 의미가 달라지기 때문이다.

## WebSocket

STOMP 엔드포인트: `/ws` (SockJS 미사용, raw WebSocket)

| 토픽 | 발행 시점 | 페이로드 |
| --- | --- | --- |
| `/topic/vote/{year}` | 투표 / 오픈 / 마감 / 초기화 | `VoteResultResponse` (연도, 문제, 상태, 총투표수, 순번, 선택지별 득표수·득표율) |
| `/topic/session/{year}` | 해당 연도 상태 변경 | `VoteSessionResponse` |
| `/topic/session` | 모든 세션 상태 변경 | `VoteSessionResponse` — 진행자의 연도 전환을 따라가기 위해 사용 |

브로드캐스트는 **트랜잭션 커밋 이후**에 발행된다. 커밋 전에 발행하면
롤백된 집계가 화면에 남거나 동시 투표 결과가 누락될 수 있다.

`VoteResultResponse.sequence` 는 단조 증가하는 순번이다. 동시 투표 시
메시지 도착 순서가 뒤바뀔 수 있으므로 클라이언트는 이미 적용한 순번보다
작은 프레임을 버려야 한다.

## 마이그레이션

Flyway (`src/main/resources/db/migration`). `ddl-auto=validate` 이므로
엔티티와 스키마가 어긋나면 기동 시점에 실패한다.

- `V1__init.sql` — 초기 스키마
- `V2__add_session_metadata_and_tally_index.sql` — `question` / `opened_at` / `closed_at` 추가,
  선택지 FK 에 `ON DELETE CASCADE` 적용, 집계용 복합 인덱스 추가

## 부하 테스트

```bash
k6 run tests/ws-test.js
```
