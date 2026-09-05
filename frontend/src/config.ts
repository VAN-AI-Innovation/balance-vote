const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL

export const API_BASE_URL =
  configuredApiBaseUrl ??
  (window.location.port === '5173'
    ? `${window.location.protocol}//${window.location.hostname}:8080/api`
    : '/api')

const configuredWsUrl = import.meta.env.VITE_WS_URL

export const WS_URL =
  configuredWsUrl ??
  (window.location.port === '5173'
    ? `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.hostname}:8080/ws`
    : `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws`)

export const SESSION_POLL_INTERVAL = 2000
export const RESULT_RECONNECT_DELAY = 3000
