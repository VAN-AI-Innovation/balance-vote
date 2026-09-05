/**
 * 빈 문자열도 '설정하지 않음'으로 취급한다.
 *
 * .env.example 이 `VITE_API_BASE_URL=` 형태로 빈 값을 제공하므로
 * ?? 연산자를 쓰면 빈 문자열이 그대로 통과해
 * 모든 요청이 /api 없이 전송되어 조용히 404가 된다.
 */
const readEnv = (value: string | undefined): string | null => {
  const trimmed = value?.trim()

  return trimmed ? trimmed.replace(/\/+$/, '') : null
}

const isSecure = window.location.protocol === 'https:'
const wsProtocol = isSecure ? 'wss' : 'ws'

/**
 * 개발 환경에서는 vite dev 서버의 프록시를 사용한다.
 *
 * 이전에는 포트가 5173인지로 개발 환경을 판단했기 때문에
 * `vite --port 3000`, `--host`(LAN IP), `vite preview`(4173) 에서
 * 백엔드가 없는 오리진의 /api 로 요청이 나갔다.
 * import.meta.env.DEV 는 빌드 시점에 확정되므로 포트와 무관하다.
 */
const configuredApiBaseUrl = readEnv(import.meta.env.VITE_API_BASE_URL)
const configuredWsUrl = readEnv(import.meta.env.VITE_WS_URL)

/*
 * 기본값은 같은 오리진의 /api 이다.
 *
 * 개발 환경에서는 vite.config.ts 의 프록시가 이를 localhost:8080 으로 넘긴다.
 * 배포 환경에서는 백엔드가 다른 호스트에 있으므로
 * VITE_API_BASE_URL / VITE_WS_URL 을 반드시 지정해야 한다.
 * (Vercel 은 WebSocket 을 rewrite 로 프록시하지 못하므로 절대 URL 이 필요하다)
 */
export const API_BASE_URL = configuredApiBaseUrl ?? '/api'

export const WS_URL =
  configuredWsUrl ?? `${wsProtocol}://${window.location.host}/ws`

if (!import.meta.env.DEV && (!configuredApiBaseUrl || !configuredWsUrl)) {
  console.warn(
    '[balance-vote] VITE_API_BASE_URL 또는 VITE_WS_URL 이 설정되지 않았습니다. ' +
      '백엔드가 다른 호스트에 있으면 배포 환경에서 API/WebSocket 연결이 실패합니다.',
  )
}

/**
 * WebSocket 이 끊긴 동안을 대비한 백업 폴링 주기.
 *
 * 실시간 갱신은 WebSocket 이 담당하므로 짧을 필요가 없다.
 * 연결이 살아 있으면 이 폴링은 사실상 안전망이다.
 */
export const SESSION_POLL_INTERVAL = 10_000

export const RESULT_RECONNECT_DELAY = 3_000

/**
 * 관리자 키는 sessionStorage 에 보관한다.
 *
 * localStorage 를 쓰면 행사장 공용 노트북에 키가 남는다.
 * 탭을 닫으면 사라지는 편이 안전하다.
 */
const ADMIN_TOKEN_KEY = 'balance-vote:admin-token'

export const getAdminToken = (): string | null => {
  try {
    return sessionStorage.getItem(ADMIN_TOKEN_KEY)
  } catch {
    return null
  }
}

export const setAdminToken = (token: string): void => {
  try {
    sessionStorage.setItem(ADMIN_TOKEN_KEY, token)
  } catch {
    /* 프라이빗 모드 등에서 저장이 막혀도 동작은 계속한다 */
  }
}

export const clearAdminToken = (): void => {
  try {
    sessionStorage.removeItem(ADMIN_TOKEN_KEY)
  } catch {
    /* 무시 */
  }
}
