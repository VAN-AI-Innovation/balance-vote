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
  const socketRef = useRef<WebSocket | null>(null)
  const reconnectTimerRef = useRef<number | null>(null)
  const shouldReconnectRef = useRef(true)

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

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadResult()
    }, 0)

    return () => {
      window.clearTimeout(timer)
    }
  }, [loadResult])

  useEffect(() => {
    shouldReconnectRef.current = true

    if (year === null) {
      return () => {
        shouldReconnectRef.current = false
      }
    }

    const connect = () => {
      if (!shouldReconnectRef.current) {
        return
      }

      const socket = new WebSocket(WS_URL)
      socketRef.current = socket

      socket.onopen = () => {
        socket.send(
          'CONNECT\naccept-version:1.2\nheart-beat:10000,10000\n\n\u0000',
        )
      }

      socket.onmessage = (event) => {
        const message = String(event.data)
        const commandEnd = message.indexOf('\n')
        const command =
          commandEnd === -1 ? message : message.slice(0, commandEnd)

        if (command === 'CONNECTED') {
          setConnected(true)
          socket.send(
            `SUBSCRIBE\nid:result-${year}\ndestination:/topic/vote/${year}\nack:auto\n\n\u0000`,
          )
          return
        }

        if (command !== 'MESSAGE') {
          return
        }

        const bodyStart = message.indexOf('\n\n')

        if (bodyStart === -1) {
          return
        }

        let body = message.slice(bodyStart + 2)

        if (body.endsWith(String.fromCharCode(0))) {
          body = body.slice(0, -1)
        }

        try {
          const data: VoteResultResponse = JSON.parse(body)
          setResult(data)
          setError(false)
        } catch {
          // 잘못된 WebSocket 메시지는 현재 결과를 유지한다.
        }
      }

      socket.onerror = () => {
        setConnected(false)
      }

      socket.onclose = () => {
        setConnected(false)
        socketRef.current = null

        if (shouldReconnectRef.current) {
          reconnectTimerRef.current = window.setTimeout(
            connect,
            RESULT_RECONNECT_DELAY,
          )
        }
      }
    }

    connect()

    return () => {
      shouldReconnectRef.current = false

      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = null
      }

      socketRef.current?.close()
      socketRef.current = null
    }
  }, [year])

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

          <span className={`connection-badge ${connected ? 'connected' : ''}`}>
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