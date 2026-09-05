import { useCallback, useEffect, useMemo, useState } from 'react'
import VoteRateBar from '../components/VoteRateBar'
import { useCurrentSession } from '../hooks/useCurrentSession'
import { useLiveResult } from '../hooks/useLiveResult'
import { PARTICIPANT_STATUS_LABEL } from '../types'
import './ResultPage.css'

/**
 * 프로젝터에 띄우는 결과 화면.
 *
 * 관객석에서 읽어야 하므로 모든 수치는 화면 너비에 비례해 커진다.
 */
function ResultPage() {
  const {
    session,
    loading: sessionLoading,
    error: sessionError,
    connected,
  } = useCurrentSession()

  const year = session?.year ?? null

  const {
    result,
    loading: resultLoading,
    error: resultError,
    refresh,
  } = useLiveResult(year)

  const [isFullscreen, setIsFullscreen] = useState(false)

  /*
   * 세션 상태는 /topic/session 이 가장 빠르고,
   * 결과 프레임에도 상태가 실려 온다. 둘 중 최신인 쪽을 쓴다.
   * 결과 프레임이 없으면 세션 정보로 대체한다.
   */
  const status = result?.status ?? session?.status ?? 'WAITING'
  const question = result?.question ?? session?.question ?? null

  const maxVoteCount = useMemo(
    () =>
      result?.options.reduce(
        (max, option) => Math.max(max, option.voteCount),
        0,
      ) ?? 0,
    [result],
  )

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      void document.exitFullscreen()
      return
    }

    void document.documentElement.requestFullscreen().catch(() => {
      /* 브라우저가 거부하면 무시한다 */
    })
  }, [])

  useEffect(() => {
    const handleChange = () =>
      setIsFullscreen(document.fullscreenElement !== null)

    document.addEventListener('fullscreenchange', handleChange)

    return () => document.removeEventListener('fullscreenchange', handleChange)
  }, [])

  /* F 키로 전체화면을 전환한다. 진행 중 마우스를 찾지 않아도 되게 한다 */
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'f' || event.key === 'F') {
        toggleFullscreen()
      }
    }

    window.addEventListener('keydown', handleKey)

    return () => window.removeEventListener('keydown', handleKey)
  }, [toggleFullscreen])

  const connectionPill = (
    <span className={`connection-badge${connected ? ' connected' : ''}`}>
      <span className="connection-dot" />
      {connected ? '실시간 연결됨' : '연결 중'}
    </span>
  )

  if (sessionLoading) {
    return (
      <main className="result-page">
        <section className="result-stage">
          <p className="result-placeholder">투표 결과를 불러오는 중입니다.</p>
        </section>
      </main>
    )
  }

  if (year === null) {
    return (
      <main className="result-page">
        <section className="result-stage">
          <span className="result-badge">BALANCE VOTE</span>
          <h1 className="result-title">투표 대기 중</h1>
          <p className="result-placeholder">
            진행자가 투표를 시작하면 결과가 표시됩니다.
          </p>
          {sessionError && <p className="result-error">{sessionError}</p>}
        </section>
      </main>
    )
  }

  return (
    <main className={`result-page${isFullscreen ? ' is-fullscreen' : ''}`}>
      <section className="result-stage" aria-live="polite">
        <header className="result-header">
          <div className="result-heading">
            <span className="result-badge">BALANCE VOTE</span>

            <h1 className="result-title">
              <span className="result-year">{year}</span>년
            </h1>
          </div>

          <div className="result-header-meta">
            <span className={`status-pill status-${status.toLowerCase()}`}>
              {PARTICIPANT_STATUS_LABEL[status]}
            </span>

            {connectionPill}

            <button
              type="button"
              className="fullscreen-button"
              onClick={toggleFullscreen}
              title="전체화면 (F)"
            >
              {isFullscreen ? '전체화면 종료' : '전체화면'}
            </button>
          </div>
        </header>

        {question && <p className="result-question">{question}</p>}

        <div className="result-total">
          <span className="result-total-label">총 투표</span>
          <strong className="result-total-value">
            {result?.totalVotes ?? 0}
          </strong>
          <span className="result-total-unit">표</span>
        </div>

        {resultLoading && result === null && (
          <p className="result-placeholder">집계를 불러오는 중입니다.</p>
        )}

        {result !== null && result.options.length === 0 && (
          <p className="result-placeholder">등록된 선택지가 없습니다.</p>
        )}

        {result !== null && result.options.length > 0 && (
          <div className="vote-rate-list">
            {result.options.map((option, index) => (
              <VoteRateBar
                key={option.optionId}
                index={index}
                label={option.label}
                voteCount={option.voteCount}
                voteRate={option.voteRate}
                isLeading={
                  maxVoteCount > 0 && option.voteCount === maxVoteCount
                }
                isFinal={status === 'CLOSED'}
              />
            ))}
          </div>
        )}

        {resultError && result === null && (
          <div className="result-error-panel">
            <p>{resultError}</p>
            <button type="button" onClick={refresh}>
              다시 불러오기
            </button>
          </div>
        )}
      </section>
    </main>
  )
}

export default ResultPage
