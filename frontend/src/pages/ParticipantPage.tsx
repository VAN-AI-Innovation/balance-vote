import { useCallback, useEffect, useState } from 'react'
import {
  API_BASE_URL,
  SESSION_POLL_INTERVAL,
} from '../config'
import './ParticipantPage.css'

type VoteStatus = 'WAITING' | 'OPEN' | 'CLOSED'

type SessionResponse = {
  year: number
  status: VoteStatus
  current: boolean
}

type VoteOption = {
  id: number
  sessionId: number
  label: string
}

type VoterTokenResponse = {
  voterToken: string
}

function ParticipantPage() {
  const [year, setYear] = useState<number | null>(null)
  const [status, setStatus] = useState<VoteStatus>('WAITING')
  const [options, setOptions] = useState<VoteOption[]>([])
  const [selectedOptionId, setSelectedOptionId] = useState<number | null>(null)
  const [voterToken, setVoterToken] = useState<string | null>(null)
  const [hasVoted, setHasVoted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const tokenKey = year === null ? null : `balance-vote:${year}:voter-token`

  const loadSession = useCallback(async () => {
    try {
      const currentResponse = await fetch(`${API_BASE_URL}/sessions/current`)

      if (currentResponse.status === 404) {
        setYear(null)
        setOptions([])
        setSelectedOptionId(null)
        setVoterToken(null)
        setHasVoted(false)
        return
      }

      if (!currentResponse.ok) {
        return
      }

      const currentSession: SessionResponse = await currentResponse.json()

      setYear((currentYear) =>
        currentYear === currentSession.year ? currentYear : currentSession.year,
      )
    } catch {
      // 네트워크 오류는 참가자 화면에 노출하지 않음
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadSession()
    }, 0)

    const intervalId = window.setInterval(() => {
      void loadSession()
    }, SESSION_POLL_INTERVAL)

    return () => {
      window.clearTimeout(timeoutId)
      window.clearInterval(intervalId)
    }
  }, [loadSession])

  const loadSelectedSession = useCallback(async () => {
    if (year === null || tokenKey === null) {
      return
    }

    try {
      const response = await fetch(`${API_BASE_URL}/sessions/${year}`)

      if (!response.ok) {
        return
      }

      const session: SessionResponse = await response.json()
      setStatus(session.status)

      if (session.status === 'WAITING') {
        localStorage.removeItem(tokenKey)
        setHasVoted(false)
        setSelectedOptionId(null)
        setVoterToken(null)
        setOptions([])
        return
      }

      const storedToken = localStorage.getItem(tokenKey)
      setVoterToken(storedToken)

      if (session.status === 'OPEN') {
        if (storedToken === null) {
          setHasVoted(false)
        } else {
          const statusResponse = await fetch(
            `${API_BASE_URL}/sessions/${year}/votes/status?voterToken=${encodeURIComponent(storedToken)}`,
          )

          if (!statusResponse.ok) {
            return
          }

          const voteStatus: { hasVoted: boolean } = await statusResponse.json()
          setHasVoted(voteStatus.hasVoted)
        }

        const optionsResponse = await fetch(
          `${API_BASE_URL}/sessions/${year}/options`,
        )

        if (!optionsResponse.ok) {
          return
        }

        const sessionOptions: VoteOption[] = await optionsResponse.json()
        setOptions(sessionOptions)
      } else {
        setOptions([])
        setSelectedOptionId(null)
      }
    } catch {
      // 네트워크 오류는 참가자 화면에 노출하지 않음
    }
  }, [tokenKey, year])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadSelectedSession()
    }, 0)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [loadSelectedSession])

  const issueToken = async () => {
    if (year === null || tokenKey === null) {
      throw new Error('현재 투표가 선택되지 않았습니다.')
    }

    const response = await fetch(
      `${API_BASE_URL}/sessions/${year}/votes/token`,
      { method: 'POST' },
    )

    if (!response.ok) {
      throw new Error('투표자 정보를 준비하지 못했습니다.')
    }

    const data: VoterTokenResponse = await response.json()

    localStorage.setItem(tokenKey, data.voterToken)
    setVoterToken(data.voterToken)

    return data.voterToken
  }

  const handleVote = async () => {
    if (
      year === null ||
      selectedOptionId === null ||
      hasVoted ||
      submitting ||
      status !== 'OPEN'
    ) {
      return
    }

    setSubmitting(true)

    try {
      const token = voterToken ?? (await issueToken())

      const response = await fetch(
        `${API_BASE_URL}/sessions/${year}/votes`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            optionId: selectedOptionId,
            voterToken: token,
          }),
        },
      )

      if (response.status === 409) {
        setHasVoted(true)
        return
      }

      if (!response.ok) {
        throw new Error('투표 제출에 실패했습니다.')
      }

      setHasVoted(true)
    } catch {
      // 투표 제출 오류는 참가자 화면에 노출하지 않음
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <main className="participant-page">
        <div className="participant-card">
          투표를 준비하고 있습니다.
        </div>
      </main>
    )
  }

  if (year === null) {
    return (
      <main className="participant-page">
        <section className="participant-card">
          <div className="participant-state">
            <div className="state-icon">⏳</div>
            <h1>현재 진행 중인 투표가 없습니다</h1>
            <p>새로운 투표가 시작되면 참여할 수 있습니다.</p>
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className="participant-page">
      <section className="participant-card" aria-live="polite">
        <div className="participant-header">
          <span className="participant-badge">BALANCE VOTE</span>

          <span className={`status-badge status-${status.toLowerCase()}`}>
            {status === 'WAITING'
              ? '대기 중'
              : status === 'OPEN'
                ? '투표 진행 중'
                : '투표 마감'}
          </span>
        </div>

        <p className="participant-year">{year}년</p>

        {status === 'WAITING' && (
          <div className="participant-state">
            <div className="state-icon">⏳</div>
            <h1>투표가 아직 시작되지 않았습니다</h1>
            <p>투표가 시작되면 선택지가 표시됩니다.</p>
          </div>
        )}

        {status === 'OPEN' && hasVoted && (
          <div className="participant-state">
            <div className="state-icon success">✓</div>
            <h1>투표가 완료되었습니다</h1>
            <p>소중한 의견을 제출해 주셔서 감사합니다.</p>
            <div className="locked-message">
              이미 투표를 완료하여 다시 투표할 수 없습니다.
            </div>
          </div>
        )}

        {status === 'OPEN' && !hasVoted && (
          <div className="vote-area">
            <div className="state-heading">
              <h1>원하는 선택지를 골라주세요</h1>
              <p>한 번 제출한 투표는 변경할 수 없습니다.</p>
            </div>

            <div className="option-list">
              {options.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={`option-button ${
                    selectedOptionId === option.id ? 'selected' : ''
                  }`}
                  onClick={() => setSelectedOptionId(option.id)}
                  disabled={submitting}
                  aria-pressed={selectedOptionId === option.id}
                >
                  <span className="option-radio" aria-hidden="true" />
                  <span>{option.label}</span>
                </button>
              ))}
            </div>

            {options.length === 0 && (
              <div className="empty-options">등록된 선택지가 없습니다.</div>
            )}

            <button
              type="button"
              className="vote-submit"
              onClick={handleVote}
              disabled={
                selectedOptionId === null ||
                submitting ||
                options.length === 0
              }
            >
              {submitting ? '제출 중...' : '투표 제출'}
            </button>
          </div>
        )}

        {status === 'CLOSED' && (
          <div className="participant-state">
            <div className="state-icon locked">🔒</div>
            <h1>투표가 마감되었습니다</h1>
            <p>현재는 투표에 참여할 수 없습니다.</p>
            <div className="locked-message">
              투표가 종료되어 선택 및 제출이 잠금 처리되었습니다.
            </div>
          </div>
        )}
      </section>
    </main>
  )
}

export default ParticipantPage