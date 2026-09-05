import { useCallback, useEffect, useState } from 'react'
import {
  ApiError,
  checkHasVoted,
  fetchOptions,
  getErrorMessage,
  issueVoterToken,
  submitVote,
} from '../api'
import { useCurrentSession } from '../hooks/useCurrentSession'
import { PARTICIPANT_STATUS_LABEL } from '../types'
import type { VoteOption } from '../types'
import './ParticipantPage.css'

function ParticipantPage() {
  const { session, loading, error: sessionError } = useCurrentSession()

  const year = session?.year ?? null
  const status = session?.status ?? 'WAITING'
  const question = session?.question ?? null

  const [options, setOptions] = useState<VoteOption[]>([])
  const [selectedOptionId, setSelectedOptionId] = useState<number | null>(null)
  const [hasVoted, setHasVoted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const tokenKey = year === null ? null : `balance-vote:${year}:voter-token`

  /*
   * 선택지와 투표 여부를 불러온다.
   *
   * status 를 의존성에 포함하는 것이 핵심이다.
   * 기존에는 이 로직이 [tokenKey, year] 에만 반응했고 tokenKey 는
   * year 에서 파생된 값이었다. 그래서 이미 현재 세션인 연도가
   * WAITING -> OPEN 으로 바뀌어도 재조회가 일어나지 않아
   * 참가자는 새로고침할 때까지 투표할 수 없었다.
   */
  useEffect(() => {
    let cancelled = false

    const load = async () => {
      if (year === null || tokenKey === null) {
        setOptions([])
        return
      }

      /*
       * WAITING 은 아직 시작 전이거나 진행자가 초기화한 상태다.
       * 초기화 후에는 이전 투표 기록이 서버에서 삭제되므로
       * 저장된 토큰도 버려 다시 투표할 수 있게 한다.
       */
      if (status === 'WAITING') {
        localStorage.removeItem(tokenKey)
        setOptions([])
        setSelectedOptionId(null)
        setHasVoted(false)
        setError('')
        return
      }

      if (status === 'CLOSED') {
        setSelectedOptionId(null)
        setError('')
        return
      }

      try {
        const storedToken = localStorage.getItem(tokenKey)

        if (storedToken) {
          const { hasVoted: voted } = await checkHasVoted(year, storedToken)

          if (cancelled) {
            return
          }

          setHasVoted(voted)
        } else {
          setHasVoted(false)
        }

        const loadedOptions = await fetchOptions(year)

        if (cancelled) {
          return
        }

        setOptions(loadedOptions)
        setError('')
      } catch (err) {
        if (cancelled) {
          return
        }

        /*
         * 기존에는 catch 블록이 비어 있어 조회 실패가 화면에
         * 아무 흔적도 남기지 않았다.
         */
        setError(getErrorMessage(err))
      }
    }

    /*
     * setTimeout 으로 한 틱 미뤄 effect 본문에서 동기적으로
     * setState 가 호출되는 것을 피한다.
     */
    const timeoutId = window.setTimeout(() => void load(), 0)

    return () => {
      cancelled = true
      window.clearTimeout(timeoutId)
    }
  }, [status, tokenKey, year])

  const handleVote = useCallback(async () => {
    if (
      year === null ||
      tokenKey === null ||
      selectedOptionId === null ||
      hasVoted ||
      submitting ||
      status !== 'OPEN'
    ) {
      return
    }

    setSubmitting(true)
    setError('')

    try {
      let token = localStorage.getItem(tokenKey)

      if (!token) {
        const issued = await issueVoterToken(year)
        token = issued.voterToken
        localStorage.setItem(tokenKey, token)
      }

      await submitVote(year, selectedOptionId, token)

      setHasVoted(true)
    } catch (err) {
      /*
       * 409 는 이미 투표한 경우다. 오류가 아니라 완료 상태로 처리한다.
       */
      if (err instanceof ApiError && err.status === 409) {
        setHasVoted(true)
        return
      }

      setError(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }, [hasVoted, selectedOptionId, status, submitting, tokenKey, year])

  if (loading) {
    return (
      <main className="participant-page">
        <section className="participant-card">
          <a className="back-button" href="/" aria-label="메인 페이지로 돌아가기">
            ← 메인으로
          </a>
          <p className="participant-loading">투표를 준비하고 있습니다.</p>
        </section>
      </main>
    )
  }

  if (year === null) {
    return (
      <main className="participant-page">
        <section className="participant-card">
          <a className="back-button" href="/" aria-label="메인 페이지로 돌아가기">
            ← 메인으로
          </a>
          <div className="participant-state">
            <div className="state-icon">⏳</div>
            <h1>현재 진행 중인 투표가 없습니다</h1>
            <p>새로운 투표가 시작되면 이 화면에서 바로 참여할 수 있습니다.</p>
          </div>
          {sessionError && (
            <p className="participant-error">{sessionError}</p>
          )}
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
            {PARTICIPANT_STATUS_LABEL[status]}
          </span>
        </div>

        <p className="participant-year">{year}년</p>

        {question && <p className="participant-question">{question}</p>}

        {status === 'WAITING' && (
          <div className="participant-state">
            <div className="state-icon">⏳</div>
            <h1>투표가 아직 시작되지 않았습니다</h1>
            <p>진행자가 투표를 열면 선택지가 자동으로 표시됩니다.</p>
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

            {options.length === 0 ? (
              <div className="empty-options">
                선택지를 불러오고 있습니다.
              </div>
            ) : (
              <div className="option-list">
                {options.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className={`option-button${
                      selectedOptionId === option.id ? ' selected' : ''
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
            )}

            {error && <p className="participant-error">{error}</p>}

            <button
              type="button"
              className="vote-submit"
              onClick={() => void handleVote()}
              disabled={
                selectedOptionId === null || submitting || options.length === 0
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
            <p>결과는 무대 화면에서 확인해 주세요.</p>
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
