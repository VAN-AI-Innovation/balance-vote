import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import {
  ApiError,
  createOption,
  deleteOption,
  downloadCsv,
  fetchOptions,
  fetchSessions,
  getErrorMessage,
  runSessionAction,
  selectCurrentSession,
  updateOption,
  updateQuestion,
  verifyAdminToken,
} from '../api'
import {
  clearAdminToken,
  getAdminToken,
  setAdminToken,
} from '../config'
import QuestionForm from '../components/QuestionForm'
import { useLiveResult } from '../hooks/useLiveResult'
import { subscribeTopic } from '../stomp'
import { STATUS_LABEL } from '../types'
import type { VoteOption, VoteSession, VoteStatus } from '../types'
import './AdminPage.css'

const statusClass: Record<VoteStatus, string> = {
  WAITING: 'waiting',
  OPEN: 'open',
  CLOSED: 'closed',
}

type AuthState = 'checking' | 'required' | 'authorized'

function AdminPage() {
  const [authState, setAuthState] = useState<AuthState>('checking')
  const [tokenInput, setTokenInput] = useState('')
  const [authError, setAuthError] = useState('')

  const [sessions, setSessions] = useState<VoteSession[]>([])
  const [selectedYear, setSelectedYear] = useState<number | null>(null)

  const [options, setOptions] = useState<VoteOption[]>([])
  const [optionsLoading, setOptionsLoading] = useState(false)
  const [newOption, setNewOption] = useState('')

  const [editingId, setEditingId] = useState<number | null>(null)
  const [editingLabel, setEditingLabel] = useState('')

  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const selectedSession = useMemo(
    () => sessions.find((session) => session.year === selectedYear) ?? null,
    [sessions, selectedYear],
  )

  /* 선택한 세션의 실시간 집계. 진행자가 참여 현황을 즉시 확인한다 */
  const { result, connected } = useLiveResult(
    authState === 'authorized' ? selectedYear : null,
  )

  /* ---------------------------------------------------------------- */
  /* 인증                                                             */
  /* ---------------------------------------------------------------- */

  /*
   * 백엔드에 ADMIN_TOKEN 이 설정되지 않았으면 인증이 비활성화되어
   * 키 없이도 요청이 통과한다. 따라서 저장된 키로 한 번 확인해 보고
   * 401 일 때만 입력 화면을 띄운다.
   */
  useEffect(() => {
    let cancelled = false

    const check = async () => {
      try {
        await verifyAdminToken()

        if (!cancelled) {
          setAuthState('authorized')
        }
      } catch (err) {
        if (cancelled) {
          return
        }

        if (err instanceof ApiError && err.status === 401) {
          setAuthState('required')
          return
        }

        /*
         * 401 이 아닌 오류(네트워크 등)는 인증 문제가 아니므로
         * 화면을 열고 일반 오류로 표시한다.
         */
        setAuthState('authorized')
        setError(getErrorMessage(err))
      }
    }

    void check()

    return () => {
      cancelled = true
    }
  }, [])

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!tokenInput.trim()) {
      return
    }

    setAuthError('')
    setAdminToken(tokenInput.trim())

    try {
      await verifyAdminToken()

      setAuthState('authorized')
      setTokenInput('')
    } catch (err) {
      clearAdminToken()
      setAuthError(
        err instanceof ApiError && err.status === 401
          ? '관리자 키가 올바르지 않습니다.'
          : getErrorMessage(err),
      )
    }
  }

  const handleLogout = () => {
    clearAdminToken()
    setAuthState('required')
    setSessions([])
    setOptions([])
    setSelectedYear(null)
  }

  /* ---------------------------------------------------------------- */
  /* 데이터 로딩                                                       */
  /* ---------------------------------------------------------------- */

  const loadSessions = useCallback(async (preserveSelection = true) => {
    try {
      const data = await fetchSessions()

      setSessions(data)
      setSelectedYear((previous) => {
        if (preserveSelection && previous !== null) {
          return previous
        }

        /* 현재 세션을 우선 선택하고, 없으면 첫 연도를 선택한다 */
        return (data.find((session) => session.current) ?? data.at(0))?.year ?? null
      })
      setError('')
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (authState !== 'authorized') {
      return
    }

    const timeoutId = window.setTimeout(() => void loadSessions(false), 0)

    return () => window.clearTimeout(timeoutId)
  }, [authState, loadSessions])

  /*
   * 세션 상태 변경을 실시간으로 반영한다.
   *
   * 기존 관리자 화면은 목록을 최초 1회만 조회해서, 다른 기기에서
   * 상태를 바꾸거나 오픈으로 인해 다른 연도가 자동 마감되어도
   * 화면이 갱신되지 않았다.
   */
  useEffect(() => {
    if (authState !== 'authorized') {
      return
    }

    return subscribeTopic('/topic/session', (body) => {
      let incoming: VoteSession

      try {
        incoming = JSON.parse(body) as VoteSession
      } catch {
        return
      }

      setSessions((current) =>
        current.map((session) => {
          if (session.year === incoming.year) {
            return incoming
          }

          /*
           * 새로 current 가 된 세션이 있으면 다른 세션의 current 는 해제한다.
           */
          return incoming.current && session.current
            ? { ...session, current: false }
            : session
        }),
      )
    })
  }, [authState])

  /* 선택된 세션의 선택지 조회 */
  useEffect(() => {
    let cancelled = false

    const load = async () => {
      if (authState !== 'authorized' || selectedYear === null) {
        setOptions([])
        return
      }

      setOptionsLoading(true)

      try {
        const data = await fetchOptions(selectedYear)

        if (cancelled) {
          return
        }

        /* 서버가 내려준 순서(id 오름차순)를 그대로 사용한다 */
        setOptions(data)

        /* 연도를 바꾸면 이전 연도의 편집 상태는 버린다 */
        setEditingId(null)
        setEditingLabel('')
        setError('')
      } catch (err) {
        if (cancelled) {
          return
        }

        setOptions([])
        setError(getErrorMessage(err))
      } finally {
        if (!cancelled) {
          setOptionsLoading(false)
        }
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [authState, selectedYear])

  /* ---------------------------------------------------------------- */
  /* 동작                                                             */
  /* ---------------------------------------------------------------- */

  const applySession = (updated: VoteSession) => {
    setSessions((current) =>
      current.map((session) =>
        session.year === updated.year
          ? updated
          : updated.current && session.current
            ? { ...session, current: false }
            : session,
      ),
    )
  }

  const runAction = async (
    action: () => Promise<void>,
    successMessage?: string,
  ) => {
    if (actionLoading) {
      return
    }

    setActionLoading(true)
    setError('')
    setNotice('')

    try {
      await action()

      if (successMessage) {
        setNotice(successMessage)
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        clearAdminToken()
        setAuthState('required')
        setAuthError('관리자 키가 만료되었습니다. 다시 입력해 주세요.')
        return
      }

      setError(getErrorMessage(err))
    } finally {
      setActionLoading(false)
    }
  }

  const handleOpen = () => {
    if (!selectedSession) {
      return
    }

    void runAction(async () => {
      applySession(await runSessionAction(selectedSession.year, 'open'))
      /* 다른 연도가 자동 마감되므로 목록 전체를 다시 맞춘다 */
      await loadSessions()
    }, `${selectedSession.year}년 투표를 열었습니다.`)
  }

  const handleClose = () => {
    if (!selectedSession) {
      return
    }

    void runAction(async () => {
      applySession(await runSessionAction(selectedSession.year, 'close'))
    }, `${selectedSession.year}년 투표를 마감했습니다.`)
  }

  const handleReset = () => {
    if (!selectedSession) {
      return
    }

    if (
      !window.confirm(
        `${selectedSession.year}년 세션을 초기화하시겠습니까?\n\n` +
          '기존 투표 기록이 모두 삭제되고 대기 상태로 돌아갑니다.',
      )
    ) {
      return
    }

    void runAction(async () => {
      applySession(await runSessionAction(selectedSession.year, 'reset'))
    }, `${selectedSession.year}년 세션을 초기화했습니다.`)
  }

  const handleSelectCurrent = () => {
    if (!selectedSession) {
      return
    }

    void runAction(async () => {
      applySession(await selectCurrentSession(selectedSession.year))
      await loadSessions()
    }, `${selectedSession.year}년을 현재 세션으로 지정했습니다.`)
  }

  const handleSaveQuestion = (question: string) => {
    if (!selectedSession) {
      return
    }

    void runAction(async () => {
      applySession(await updateQuestion(selectedSession.year, question))
    }, '문제 문구를 저장했습니다.')
  }

  const handleAddOption = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (selectedYear === null || !newOption.trim()) {
      return
    }

    void runAction(async () => {
      const created = await createOption(selectedYear, newOption.trim())

      /* 새 선택지는 항상 마지막에 추가된다 */
      setOptions((current) => [...current, created])
      setNewOption('')
      await loadSessions()
    })
  }

  const handleUpdateOption = (optionId: number) => {
    if (selectedYear === null || !editingLabel.trim()) {
      return
    }

    void runAction(async () => {
      const updated = await updateOption(
        selectedYear,
        optionId,
        editingLabel.trim(),
      )

      /*
       * id 가 같은 요소만 교체한다.
       * 배열에 다시 추가하면 선택지 순서가 바뀐다.
       */
      setOptions((current) =>
        current.map((option) => (option.id === optionId ? updated : option)),
      )

      setEditingId(null)
      setEditingLabel('')
    })
  }

  const handleDeleteOption = (optionId: number) => {
    if (selectedYear === null) {
      return
    }

    const target = options.find((option) => option.id === optionId)

    if (!target || !window.confirm(`"${target.label}" 선택지를 삭제하시겠습니까?`)) {
      return
    }

    void runAction(async () => {
      await deleteOption(selectedYear, optionId)

      setOptions((current) =>
        current.filter((option) => option.id !== optionId),
      )
      await loadSessions()
    })
  }

  const handleDownload = (path: string, fileName: string) => {
    void runAction(async () => {
      await downloadCsv(path, fileName)
    }, '결과 파일을 내려받았습니다.')
  }

  /* ---------------------------------------------------------------- */
  /* 렌더링                                                           */
  /* ---------------------------------------------------------------- */

  if (authState === 'checking') {
    return (
      <main className="admin-page">
        <div className="admin-loading">관리자 화면을 준비하는 중입니다.</div>
      </main>
    )
  }

  if (authState === 'required') {
    return (
      <main className="admin-page admin-page-centered">
        <form className="admin-login" onSubmit={(event) => void handleLogin(event)}>
          <p className="admin-eyebrow">ADMIN</p>
          <h1>관리자 키 입력</h1>
          <p className="admin-login-description">
            투표를 열고 닫는 화면입니다. 진행자에게 전달된 관리자 키를
            입력해 주세요.
          </p>

          <input
            type="password"
            value={tokenInput}
            onChange={(event) => setTokenInput(event.target.value)}
            placeholder="관리자 키"
            autoComplete="current-password"
            autoFocus
            aria-label="관리자 키"
          />

          {authError && <p className="admin-error">{authError}</p>}

          <button
            type="submit"
            className="primary-button"
            disabled={!tokenInput.trim()}
          >
            확인
          </button>
        </form>
      </main>
    )
  }

  if (loading) {
    return (
      <main className="admin-page">
        <div className="admin-loading">관리자 데이터를 불러오는 중입니다.</div>
      </main>
    )
  }

  const canEditOptions = selectedSession?.status === 'WAITING'

  return (
    <main className="admin-page">
      <header className="admin-header">
        <div>
          <p className="admin-eyebrow">ADMIN CONTROL PANEL</p>
          <h1>관리자 컨트롤 패널</h1>
          <p className="admin-description">
            연도별 투표를 개별적으로 열고 닫으며, 선택지와 결과를 관리합니다.
          </p>
        </div>

        <div className="admin-header-actions">
          <span className={`connection-badge${connected ? ' connected' : ''}`}>
            <span className="connection-dot" />
            {connected ? '실시간 연결됨' : '연결 중'}
          </span>

          <a className="link-button" href="/result" target="_blank" rel="noreferrer">
            결과 화면 열기
          </a>

          <a
            className="link-button"
            href="/participant"
            target="_blank"
            rel="noreferrer"
          >
            참가자 화면 열기
          </a>

          <button
            type="button"
            className="link-button"
            onClick={() => void loadSessions()}
            disabled={actionLoading}
          >
            새로 고침
          </button>

          {getAdminToken() && (
            <button type="button" className="link-button" onClick={handleLogout}>
              키 지우기
            </button>
          )}
        </div>
      </header>

      {error && <div className="admin-error">{error}</div>}
      {notice && <div className="admin-notice">{notice}</div>}

      <section className="admin-section">
        <div className="section-heading">
          <div>
            <p className="section-kicker">SESSIONS</p>
            <h2>연도별 세션</h2>
          </div>

          <div className="section-heading-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={() =>
                handleDownload('/sessions/export', 'balance-vote-all-summary.csv')
              }
              disabled={actionLoading}
            >
              전체 결과 CSV
            </button>
          </div>
        </div>

        {sessions.length === 0 ? (
          <div className="empty-panel">등록된 투표 세션이 없습니다.</div>
        ) : (
          <div className="session-list">
            {sessions.map((session) => (
              <button
                className={`session-card${
                  selectedYear === session.year ? ' selected' : ''
                }`}
                key={session.year}
                type="button"
                onClick={() => setSelectedYear(session.year)}
              >
                <span className="session-year">{session.year}</span>

                <span className={`session-status ${statusClass[session.status]}`}>
                  {STATUS_LABEL[session.status]}
                </span>

                <span className="session-meta">
                  선택지 {session.optionCount} · {session.totalVotes}표
                </span>

                {session.current && (
                  <span className="current-label">현재 세션</span>
                )}
              </button>
            ))}
          </div>
        )}
      </section>

      {selectedSession && (
        <>
          <section className="control-card">
            <div className="control-info">
              <p className="section-kicker">SESSION CONTROL</p>
              <h2>{selectedSession.year}년 세션</h2>

              <p className="control-description">
                현재 상태는{' '}
                <strong>{STATUS_LABEL[selectedSession.status]}</strong>
                입니다.
                {selectedSession.current
                  ? ' 관객 화면에 이 연도가 표시됩니다.'
                  : ' 관객 화면에는 표시되지 않습니다.'}
              </p>
            </div>

            <div className="control-actions">
              {selectedSession.status === 'OPEN' ? (
                <button
                  type="button"
                  className="primary-button danger-button"
                  onClick={handleClose}
                  disabled={actionLoading}
                >
                  투표 마감
                </button>
              ) : (
                <button
                  type="button"
                  className="primary-button"
                  onClick={handleOpen}
                  disabled={actionLoading}
                >
                  {selectedSession.status === 'CLOSED'
                    ? '투표 재오픈'
                    : '투표 열기'}
                </button>
              )}

              {selectedSession.status !== 'WAITING' && (
                <button
                  type="button"
                  className="secondary-button danger-button"
                  onClick={handleReset}
                  disabled={actionLoading}
                >
                  초기화
                </button>
              )}

              {!selectedSession.current && (
                <button
                  type="button"
                  className="secondary-button"
                  onClick={handleSelectCurrent}
                  disabled={actionLoading}
                >
                  현재 세션으로 지정
                </button>
              )}

              <button
                type="button"
                className="secondary-button"
                onClick={() =>
                  handleDownload(
                    `/sessions/${selectedSession.year}/export`,
                    `balance-vote-${selectedSession.year}-summary.csv`,
                  )
                }
                disabled={actionLoading}
              >
                결과 CSV
              </button>

              <button
                type="button"
                className="secondary-button"
                onClick={() =>
                  handleDownload(
                    `/sessions/${selectedSession.year}/export/records`,
                    `balance-vote-${selectedSession.year}-records.csv`,
                  )
                }
                disabled={actionLoading}
              >
                투표 기록 CSV
              </button>
            </div>
          </section>

          <section className="admin-section">
            <div className="section-heading">
              <div>
                <p className="section-kicker">QUESTION</p>
                <h2>문제 문구</h2>
              </div>
            </div>

            {/*
              key 로 연도를 주어 세션을 바꿀 때 입력값이 서버 값으로
              초기화되게 한다. effect 로 동기화하면 연쇄 렌더가 발생한다.
            */}
            <QuestionForm
              key={`${selectedSession.year}:${selectedSession.question ?? ''}`}
              year={selectedSession.year}
              question={selectedSession.question}
              disabled={actionLoading}
              onSave={handleSaveQuestion}
            />
          </section>

          <section className="admin-section">
            <div className="section-heading">
              <div>
                <p className="section-kicker">LIVE RESULT</p>
                <h2>실시간 집계</h2>
              </div>

              <span className="section-count">
                {result?.totalVotes ?? 0}표
              </span>
            </div>

            {result === null || result.options.length === 0 ? (
              <div className="empty-panel">아직 집계할 투표가 없습니다.</div>
            ) : (
              <div className="tally-list">
                {result.options.map((option) => (
                  <div className="tally-row" key={option.optionId}>
                    <span className="tally-label">{option.label}</span>

                    <span className="tally-bar">
                      <span
                        className="tally-fill"
                        style={{ width: `${option.voteRate}%` }}
                      />
                    </span>

                    <span className="tally-value">
                      {option.voteCount}표 · {option.voteRate}%
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="admin-section option-section">
            <div className="section-heading">
              <div>
                <p className="section-kicker">OPTIONS</p>
                <h2>선택지 관리</h2>
              </div>

              <span className="section-count">{options.length}개</span>
            </div>

            {!canEditOptions && (
              <div className="info-panel">
                진행 중이거나 마감된 세션의 선택지는 변경할 수 없습니다.
                수정이 필요하면 세션을 초기화해 주세요.
              </div>
            )}

            <form
              className="option-form"
              onSubmit={(event) => void handleAddOption(event)}
            >
              <input
                value={newOption}
                onChange={(event) => setNewOption(event.target.value)}
                placeholder="새 선택지 입력"
                maxLength={255}
                disabled={actionLoading || !canEditOptions}
                aria-label="새 선택지"
              />

              <button
                type="submit"
                className="primary-button"
                disabled={actionLoading || !newOption.trim() || !canEditOptions}
              >
                추가
              </button>
            </form>

            <div className="option-list">
              {optionsLoading ? (
                <div className="empty-panel">선택지를 불러오는 중입니다.</div>
              ) : options.length === 0 ? (
                <div className="empty-panel">
                  등록된 선택지가 없습니다. 투표를 열려면 2개 이상 필요합니다.
                </div>
              ) : (
                options.map((option, index) => (
                  <div className="option-row" key={option.id}>
                    <span className="option-number">{index + 1}</span>

                    {editingId === option.id ? (
                      <input
                        className="option-edit-input"
                        value={editingLabel}
                        onChange={(event) => setEditingLabel(event.target.value)}
                        maxLength={255}
                        autoFocus
                        disabled={actionLoading}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault()
                            handleUpdateOption(option.id)
                          }

                          if (event.key === 'Escape') {
                            setEditingId(null)
                            setEditingLabel('')
                          }
                        }}
                      />
                    ) : (
                      <span className="option-label">{option.label}</span>
                    )}

                    <div className="option-actions">
                      {editingId === option.id ? (
                        <>
                          <button
                            className="text-button save"
                            type="button"
                            onClick={() => handleUpdateOption(option.id)}
                            disabled={actionLoading || !editingLabel.trim()}
                          >
                            저장
                          </button>

                          <button
                            className="text-button"
                            type="button"
                            onClick={() => {
                              setEditingId(null)
                              setEditingLabel('')
                            }}
                            disabled={actionLoading}
                          >
                            취소
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            className="text-button"
                            type="button"
                            onClick={() => {
                              setEditingId(option.id)
                              setEditingLabel(option.label)
                            }}
                            disabled={actionLoading || !canEditOptions}
                          >
                            수정
                          </button>

                          <button
                            className="text-button danger"
                            type="button"
                            onClick={() => handleDeleteOption(option.id)}
                            disabled={actionLoading || !canEditOptions}
                          >
                            삭제
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </>
      )}
    </main>
  )
}

export default AdminPage
