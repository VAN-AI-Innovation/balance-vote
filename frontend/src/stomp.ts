import { Client } from '@stomp/stompjs'
import type { StompSubscription } from '@stomp/stompjs'
import { RESULT_RECONNECT_DELAY, WS_URL } from './config'

/**
 * STOMP 연결을 앱 전체에서 하나만 사용한다.
 *
 * 화면마다 Client 를 만들면 관리자 화면처럼 결과와 세션 상태를
 * 함께 구독하는 경우 소켓이 여러 개 열린다. 관객 수백 명이 접속하는
 * 상황에서 클라이언트당 소켓 수는 그대로 서버 부하가 되므로
 * 연결을 공유하고 구독만 나눈다.
 */

type MessageListener = (body: string) => void
type ConnectionListener = (connected: boolean) => void

let client: Client | null = null
let connected = false

/** 목적지별 리스너 목록 */
const listeners = new Map<string, Set<MessageListener>>()

/** 목적지별 실제 STOMP 구독 핸들 */
const activeSubscriptions = new Map<string, StompSubscription>()

const connectionListeners = new Set<ConnectionListener>()

const notifyConnection = (next: boolean) => {
  connected = next
  connectionListeners.forEach((listener) => listener(next))
}

const subscribeOnBroker = (destination: string) => {
  if (!client?.connected || activeSubscriptions.has(destination)) {
    return
  }

  const subscription = client.subscribe(destination, (message) => {
    listeners.get(destination)?.forEach((listener) => {
      try {
        listener(message.body)
      } catch {
        /*
         * 한 리스너의 오류가 다른 구독을 막지 않도록 격리한다.
         */
      }
    })
  })

  activeSubscriptions.set(destination, subscription)
}

const ensureClient = (): Client => {
  if (client) {
    return client
  }

  client = new Client({
    brokerURL: WS_URL,

    /* 끊기면 자동 재연결한다 */
    reconnectDelay: RESULT_RECONNECT_DELAY,
    connectionTimeout: 5_000,

    /* 서버도 10초로 설정되어 있다 */
    heartbeatIncoming: 10_000,
    heartbeatOutgoing: 10_000,

    debug: () => {},
  })

  client.onConnect = () => {
    /*
     * 재연결마다 모든 목적지를 다시 구독한다.
     * 이전 구독 핸들은 끊어진 연결에 속하므로 버린다.
     */
    activeSubscriptions.clear()
    listeners.forEach((_set, destination) => subscribeOnBroker(destination))

    notifyConnection(true)
  }

  client.onWebSocketClose = () => {
    activeSubscriptions.clear()
    notifyConnection(false)
  }

  client.onWebSocketError = () => notifyConnection(false)
  client.onStompError = () => notifyConnection(false)

  client.activate()

  return client
}

/**
 * 토픽을 구독한다. 반환된 함수를 호출하면 해지된다.
 */
export const subscribeTopic = (
  destination: string,
  listener: MessageListener,
): (() => void) => {
  const existing = listeners.get(destination)

  if (existing) {
    existing.add(listener)
  } else {
    listeners.set(destination, new Set([listener]))
  }

  ensureClient()
  subscribeOnBroker(destination)

  return () => {
    const set = listeners.get(destination)

    if (!set) {
      return
    }

    set.delete(listener)

    if (set.size > 0) {
      return
    }

    listeners.delete(destination)

    activeSubscriptions.get(destination)?.unsubscribe()
    activeSubscriptions.delete(destination)
  }
}

/**
 * 연결 상태 변화를 구독한다.
 *
 * 재연결 시점에 REST 로 최신 상태를 다시 받아오는 데 사용한다.
 * WebSocket 이 끊긴 동안 발생한 투표는 그 연결로 전달되지 않는다.
 */
export const onConnectionChange = (
  listener: ConnectionListener,
): (() => void) => {
  connectionListeners.add(listener)

  /* 현재 상태를 즉시 알려 초기 렌더가 어긋나지 않게 한다 */
  listener(connected)

  ensureClient()

  return () => {
    connectionListeners.delete(listener)
  }
}
