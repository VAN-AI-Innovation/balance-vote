import { Client } from '@stomp/stompjs'
import { useCallback, useEffect, useRef, useState } from 'react'
import VoteRateBar from '../components/VoteRateBar'
import {
  API_BASE_URL,
  RESULT_RECONNECT_DELAY,
  SESSION_POLL_INTERVAL,
  WS_URL,
} from '../config'
import './ResultPage.css'

type VoteOptionResult = {
  optionId: number
  label: string
  voteCount: number
  voteRate: number
}

type VoteResultResponse = {
  year: number
  totalVotes: number
  options: VoteOptionResult[]
}

type CurrentSessionResponse = {
  year: number
  status: 'WAITING' | 'OPEN' | 'CLOSED'
  current: boolean
}

function ResultPage() {
  const [year, setYear] = useState<number | null>(null)
  const [result, setResult] = useState<VoteResultResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [connected, setConnected] = useState(false)

  const clientRef = useRef<Client | null>(null)

  const loadCurrentSession = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/sessions/current`)

      if (response.status === 404) {
        setYear(null)
        setResult(null)
        setError(false)
        return
      }

      if (!response.ok) {
        throw new Error('현재 투표를 불러오지 못했습니다.')
      }

      const session: CurrentSessionResponse = await response.json()

      setYear((currentYear) =>
        currentYear === session.year ? currentYear : session.year,
      )

      setError(false)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  /*
   * 현재 투표 세션 조회
   */
  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadCurrentSession()
    }, 0)

    const intervalId = window.setInterval(() => {
      void loadCurrentSession()
    }, SESSION_POLL_INTERVAL)

    return () => {
      window.clearTimeout(timeoutId)
      window.clearInterval(intervalId)
    }
  }, [loadCurrentSession])

  /*
   * 현재 투표 결과 조회
   *
   * WebSocket 연결 전 최초 결과 조회와
   * WebSocket 재연결 후 데이터 재동기화에 사용합니다.
   */
  const loadResult = useCallback(async () => {
    if (year === null) {
      return
    }

    try {
      const response = await fetch(
        `${API_BASE_URL}/sessions/${year}/votes/result`,
      )

      if (!response.ok) {
        throw new Error('결과를 불러오지 못했습니다.')
      }

      const data: VoteResultResponse = await response.json()

      setResult(data)
      setError(false)
    } catch {
      setError(true)
    }
  }, [year])

  /*
   * 투표 결과 최초 조회
   */
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadResult()
    }, 0)

    return () => {
      window.clearTimeout(timer)
    }
  }, [loadResult])

  /*
   * STOMP WebSocket 연결
   *
   * year가 변경되면 기존 연결을 종료하고
   * 새로운 투표 topic에 연결합니다.
   */
  useEffect(() => {
    if (year === null) {
      return
    }

    const client = new Client({
      brokerURL: WS_URL,

      /*
       * 연결이 끊기면 자동으로 재연결합니다.
       */
      reconnectDelay: RESULT_RECONNECT_DELAY,

      /*
       * WebSocket 연결 timeout
       */
      connectionTimeout: 5000,

      /*
       * 연결 상태 확인을 위한 heartbeat
       */
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,

      /*
       * 결과 화면에서는 STOMP debug 로그를 출력하지 않습니다.
       */
      debug: () => {},
    })

    /*
     * 최초 연결 및 자동 재연결 성공 시 실행됩니다.
     */
    client.onConnect = () => {
      setConnected(true)

      /*
       * 재연결될 때마다 topic을 다시 구독합니다.
       */
      client.subscribe(`/topic/vote/${year}`, (message) => {
        try {
          const data: VoteResultResponse = JSON.parse(message.body)

          setResult(data)
          setError(false)
        } catch {
          /*
           * 잘못된 WebSocket 메시지가 들어와도
           * 기존 결과는 유지합니다.
           */
        }
      })

      /*
       * 중요:
       *
       * WebSocket 연결이 끊긴 동안 발생한 투표 결과는
       * 해당 연결에서 전달되지 않을 수 있습니다.
       *
       * 따라서 연결이 복구될 때 REST API를 다시 호출하여
       * 최신 결과와 화면의 상태를 동기화합니다.
       */
      void loadResult()
    }

    /*
     * WebSocket 연결 종료
     *
     * 자동 재연결이 진행되는 동안
     * 화면에는 연결 중 상태를 표시합니다.
     */
    client.onWebSocketClose = () => {
      setConnected(false)
    }

    /*
     * WebSocket 오류
     */
    client.onWebSocketError = () => {
      setConnected(false)
    }

    /*
     * STOMP protocol 오류
     */
    client.onStompError = () => {
      setConnected(false)
    }

    clientRef.current = client

    /*
     * STOMP 연결 시작
     */
    client.activate()

    return () => {
      clientRef.current = null

      /*
       * 컴포넌트가 제거되거나 year가 변경되면
       * 해당 STOMP client의 자동 재연결을 종료합니다.
       */
      void client.deactivate()
    }
  }, [loadResult, year])

  if (loading) {
    return (
      <main className="result-page">
        <section className="result-card">
          투표 결과를 불러오는 중입니다.
        </section>
      </main>
    )
  }

  if (year === null) {
    return (
      <main className="result-page">
        <section className="result-card">
          <span className="result-badge">BALANCE VOTE</span>

          <h1>투표 결과</h1>

          <p>현재 선택된 투표가 없습니다.</p>

          <p>새로운 투표가 선택되면 결과를 확인할 수 있습니다.</p>
        </section>
      </main>
    )
  }

  if (error && result === null) {
    return (
      <main className="result-page">
        <section className="result-card">
          <h1>투표 결과</h1>

          <p>투표 결과를 불러오지 못했습니다.</p>

          <button type="button" onClick={() => void loadResult()}>
            다시 불러오기
          </button>
        </section>
      </main>
    )
  }

  if (result === null) {
    return (
      <main className="result-page">
        <section className="result-card">
          투표 결과를 불러오는 중입니다.
        </section>
      </main>
    )
  }

  return (
    <main className="result-page">
      <section className="result-card" aria-live="polite">
        <div className="result-header">
          <div>
            <span className="result-badge">BALANCE VOTE</span>

            <h1>{result.year}년 투표 결과</h1>
          </div>

          <span
            className={`connection-badge ${
              connected ? 'connected' : ''
            }`}
          >
            {connected ? '실시간 연결됨' : '연결 중'}
          </span>
        </div>

        <div className="total-votes">
          총 <strong>{result.totalVotes}</strong>표
        </div>

        <div className="vote-rate-list">
          {result.options.map((option) => (
            <VoteRateBar
              key={option.optionId}
              label={option.label}
              voteCount={option.voteCount}
              voteRate={option.voteRate}
            />
          ))}
        </div>
      </section>
    </main>
  )
}

export default ResultPage