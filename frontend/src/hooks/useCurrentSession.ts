import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchCurrentSession, getErrorMessage } from '../api'
import { SESSION_POLL_INTERVAL } from '../config'
import { onConnectionChange, subscribeTopic } from '../stomp'
import type { VoteSession } from '../types'

type State = {
  session: VoteSession | null
  loading: boolean
  error: string
  connected: boolean
}

/**
 * 현재 진행 중인 세션을 실시간으로 따라간다.
 *
 * 이 훅이 해결하는 문제:
 *
 * 기존 참가자 화면은 `/sessions/current` 를 2초마다 폴링했지만
 * 응답에서 year 만 상태에 반영했다. 이미 current 인 연도가
 * WAITING -> OPEN 으로 바뀌어도 year 값이 그대로여서 아무 것도
 * 다시 조회되지 않았고, 참가자는 새로고침해야 투표할 수 있었다.
 *
 * 이제 백엔드가 상태 변경을 /topic/session 으로 발행하므로
 * 연도 전환과 상태 변경을 모두 즉시 반영한다.
 * 폴링은 WebSocket 이 끊긴 동안을 대비한 안전망으로만 남긴다.
 */
export function useCurrentSession(): State & { refresh: () => void } {
  const [session, setSession] = useState<VoteSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [connected, setConnected] = useState(false)

  /*
   * 폴링 응답과 WebSocket 프레임이 경합할 때 최신 값을 잃지 않도록
   * 현재 표시 중인 연도를 ref 로 함께 들고 있는다.
   */
  const currentYearRef = useRef<number | null>(null)

  const refresh = useCallback(async () => {
    try {
      const next = await fetchCurrentSession()

      setSession(next)
      currentYearRef.current = next?.year ?? null
      setError('')
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [])

  /*
   * 최초 조회 + 백업 폴링.
   *
   * setTimeout 으로 한 틱 미뤄 effect 본문에서 동기적으로
   * setState 가 호출되는 것을 피한다.
   */
  useEffect(() => {
    const timeoutId = window.setTimeout(() => void refresh(), 0)

    const intervalId = window.setInterval(
      () => void refresh(),
      SESSION_POLL_INTERVAL,
    )

    return () => {
      window.clearTimeout(timeoutId)
      window.clearInterval(intervalId)
    }
  }, [refresh])

  /* 세션 상태 변경 브로드캐스트 */
  useEffect(() => {
    return subscribeTopic('/topic/session', (body) => {
      let incoming: VoteSession

      try {
        incoming = JSON.parse(body) as VoteSession
      } catch {
        return
      }

      setSession((previous) => {
        /*
         * 다른 연도가 현재 세션이 되었다면 그 연도로 전환한다.
         */
        if (incoming.current) {
          currentYearRef.current = incoming.year
          return incoming
        }

        /*
         * 현재 보고 있는 연도의 상태 변경이면 그대로 갱신한다.
         */
        if (previous && previous.year === incoming.year) {
          return incoming
        }

        return previous
      })

      setError('')
      setLoading(false)
    })
  }, [])

  /*
   * 재연결 시 REST 로 다시 동기화한다.
   * 끊겨 있던 동안의 상태 변경은 이 연결로 전달되지 않는다.
   */
  useEffect(() => {
    return onConnectionChange((isConnected) => {
      setConnected(isConnected)

      if (isConnected) {
        void refresh()
      }
    })
  }, [refresh])

  return { session, loading, error, connected, refresh: () => void refresh() }
}
