import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { API_BASE_URL } from '../config'
import './AdminPage.css'

type SessionStatus = 'WAITING' | 'OPEN' | 'CLOSED'

interface VoteSession {
  year: number
  status: SessionStatus
  current: boolean
}

interface VoteOption {
  id: number
  sessionId: number
  label: string
}

const statusLabel: Record<SessionStatus, string> = {
  WAITING: '대기',
  OPEN: '진행 중',
  CLOSED: '마감',
}

const statusClass: Record<SessionStatus, string> = {
  WAITING: 'waiting',
  OPEN: 'open',
  CLOSED: 'closed',
}

/**
 * 공통 API 요청 함수
 *
 * 수정 사항
 * 1. 204 No Content 처리
 * 2. Content-Length가 0이거나 응답 body가 비어 있는 경우 처리
 * 3. JSON 응답이 아닌 경우에도 JSON.parse 오류가 발생하지 않도록 처리
 * 4. 서버의 실제 오류 메시지가 있으면 최대한 그대로 전달
 */
async function request<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers ?? {}),
    },
    ...options,
  })

  /*
   * 응답 body를 먼저 text로 읽습니다.
   *
   * 기존에는 response.json()을 바로 호출했기 때문에
   * 200/204 응답인데 body가 비어 있으면
   *
   * Failed to execute 'json' on 'Response':
   * Unexpected end of JSON input
   *
   * 오류가 발생했습니다.
   */
  const text = await response.text()

  if (!response.ok) {
    let message = `요청에 실패했습니다. (${response.status})`

    if (text.trim()) {
      try {
        const body = JSON.parse(text)

        if (typeof body?.message === 'string') {
          message = body.message
        } else if (typeof body?.error === 'string') {
          message = body.error
        }
      } catch {
        /*
         * JSON이 아닌 응답이면 text 자체를 오류 메시지로 사용합니다.
         */
        if (text.trim()) {
          message = text.trim()
        }
      }
    }

    throw new Error(message)
  }

  /*
   * 204 또는 body가 없는 200 응답
   */
  if (!text.trim()) {
    return undefined as T
  }

  /*
   * JSON 응답
   */
  try {
    return JSON.parse(text) as T
  } catch {
    /*
     * 성공 응답인데 JSON이 아닌 경우
     * 호출부에서 응답 데이터를 사용하지 않는 API를 고려합니다.
     */
    return undefined as T
  }
}

function AdminPage() {
  const [sessions, setSessions] = useState<VoteSession[]>([])
  const [selectedYear, setSelectedYear] = useState<number | null>(null)

  const [options, setOptions] = useState<VoteOption[]>([])
  const [newOption, setNewOption] = useState('')

  const [editingId, setEditingId] = useState<number | null>(null)
  const [editingLabel, setEditingLabel] = useState('')

  const [loading, setLoading] = useState(true)
  const [optionsLoading, setOptionsLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  const [error, setError] = useState('')

  const selectedSession = useMemo(
    () =>
      sessions.find(
        (session) => session.year === selectedYear,
      ) ?? null,
    [sessions, selectedYear],
  )

  /*
   * 최초 세션 조회
   */
  useEffect(() => {
    let cancelled = false

    async function fetchSessions() {
      try {
        const data = await request<VoteSession[]>('/sessions')

        if (cancelled) {
          return
        }

        setSessions(data)

        /*
         * 현재 세션을 우선 선택합니다.
         *
         * 현재 세션이 없으면 마지막 세션을 선택합니다.
         */
        const currentSession =
          data.find((session) => session.current) ??
          data.at(-1) ??
          null

        setSelectedYear(currentSession?.year ?? null)
        setError('')
      } catch (err) {
        if (cancelled) {
          return
        }

        setError(getErrorMessage(err))
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void fetchSessions()

    return () => {
      cancelled = true
    }
  }, [])

  /*
   * 선택된 세션의 선택지 조회
   */
  useEffect(() => {
    if (selectedYear === null) {
      return
    }

    let cancelled = false

    async function fetchOptions() {
      try {
        const data = await request<VoteOption[]>(
          `/sessions/${selectedYear}/options`,
        )

        if (cancelled) {
          return
        }

        /*
         * 서버가 내려준 순서를 그대로 사용합니다.
         *
         * 프론트에서 sort()하지 않습니다.
         */
        setOptions(data)
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

    /*
     * setState-in-effect 오류를 피하기 위해
     * effect 본문에서는 state를 직접 변경하지 않고
     * 비동기 작업 내부에서 변경합니다.
     */
    void fetchOptions()

    return () => {
      cancelled = true
    }
  }, [selectedYear])

  /*
   * 현재 선택된 세션 Open / Close
   */
  async function handleStatusToggle() {
    if (!selectedSession || actionLoading) {
      return
    }

    const { year, status } = selectedSession

    /*
     * 이미 마감된 세션은 다시 오픈하지 않습니다.
     */
    if (status === 'CLOSED') {
      setError(
        '마감된 세션은 다시 오픈할 수 없습니다. 필요하면 초기화 후 오픈해 주세요.',
      )
      return
    }

    const nextStatus: SessionStatus =
      status === 'OPEN' ? 'CLOSED' : 'OPEN'

    const action =
      nextStatus === 'OPEN' ? 'open' : 'close'

    setActionLoading(true)
    setError('')

    try {
      const updated = await request<VoteSession>(
        `/sessions/${year}/${action}`,
        {
          method: 'POST',
        },
      )

      /*
       * 백엔드가 정상적으로 세션 객체를 반환하면
       * 서버 값을 그대로 사용합니다.
       *
       * 응답 body가 비어 있는 경우에도
       * request()가 JSON 파싱 오류를 발생시키지 않습니다.
       */
      if (updated) {
        setSessions((current) =>
          current.map((session) =>
            session.year === year
              ? {
                  ...session,
                  ...updated,
                }
              : session,
          ),
        )
      } else {
        /*
         * 성공 응답인데 body가 없는 경우
         * 서버가 요청한 상태로 처리했다고 보고
         * 현재 세션 상태만 로컬에서 갱신합니다.
         */
        setSessions((current) =>
          current.map((session) =>
            session.year === year
              ? {
                  ...session,
                  status: nextStatus,
                }
              : session,
          ),
        )
      }
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setActionLoading(false)
    }
  }

  /*
   * 현재 세션 지정
   */
  async function handleSelectCurrent(year: number) {
    if (actionLoading) {
      return
    }

    setActionLoading(true)
    setError('')

    try {
      const updated = await request<VoteSession>(
        `/sessions/${year}/current`,
        {
          method: 'PUT',
        },
      )

      /*
       * 서버가 변경된 세션 객체를 반환하는 경우
       */
      if (updated) {
        setSessions((current) =>
          current.map((session) => ({
            ...session,
            current: session.year === updated.year,
          })),
        )

        setSelectedYear(updated.year)
      } else {
        /*
         * 서버가 204 또는 빈 body를 반환하는 경우
         *
         * 전체 세션을 다시 받아오지 않고
         * 현재 목록에서 current만 정확히 변경합니다.
         */
        setSessions((current) =>
          current.map((session) => ({
            ...session,
            current: session.year === year,
          })),
        )

        setSelectedYear(year)
      }
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setActionLoading(false)
    }
  }

  /*
   * 선택지 추가
   */
  async function handleAddOption(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    if (selectedYear === null || !newOption.trim()) {
      return
    }

    setActionLoading(true)
    setError('')

    try {
      const created = await request<VoteOption>(
        `/sessions/${selectedYear}/options`,
        {
          method: 'POST',
          body: JSON.stringify({
            label: newOption.trim(),
          }),
        },
      )

      /*
       * 새 선택지는 마지막에 추가합니다.
       */
      if (created) {
        setOptions((current) => [
          ...current,
          created,
        ])
      } else {
        /*
         * 생성 API가 body를 반환하지 않는 경우
         * 서버 목록을 다시 조회합니다.
         */
        const refreshed = await request<VoteOption[]>(
          `/sessions/${selectedYear}/options`,
        )

        setOptions(refreshed)
      }

      setNewOption('')
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setActionLoading(false)
    }
  }

  /*
   * 선택지 수정 시작
   */
  function startEditing(option: VoteOption) {
    setEditingId(option.id)
    setEditingLabel(option.label)
  }

  /*
   * 선택지 수정 취소
   */
  function cancelEditing() {
    setEditingId(null)
    setEditingLabel('')
  }

  /*
   * 선택지 수정 저장
   */
  async function handleUpdateOption(optionId: number) {
    if (
      selectedYear === null ||
      !editingLabel.trim() ||
      actionLoading
    ) {
      return
    }

    setActionLoading(true)
    setError('')

    try {
      const updated = await request<VoteOption>(
        `/sessions/${selectedYear}/options/${optionId}`,
        {
          method: 'PUT',
          body: JSON.stringify({
            label: editingLabel.trim(),
          }),
        },
      )

      if (updated) {
        /*
         * 중요:
         *
         * [...current, updated]처럼 다시 추가하지 않습니다.
         *
         * 기존 배열에서 id가 같은 요소만 교체하기 때문에
         * 수정한 옵션의 기존 index가 그대로 유지됩니다.
         *
         * 예:
         *
         * [A, B, C]
         * B 수정
         * -> [A, B수정, C]
         *
         * 절대로
         * [A, C, B수정]
         * 처럼 이동하지 않습니다.
         */
        setOptions((current) =>
          current.map((option) =>
            option.id === optionId
              ? {
                  ...option,
                  ...updated,
                }
              : option,
          ),
        )
      } else {
        /*
         * 수정 API가 body를 반환하지 않는 경우
         *
         * 서버 목록을 다시 조회합니다.
         * 단, 서버가 정렬 순서를 보장해야 합니다.
         */
        const refreshed = await request<VoteOption[]>(
          `/sessions/${selectedYear}/options`,
        )

        setOptions(refreshed)
      }

      cancelEditing()
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setActionLoading(false)
    }
  }

  /*
   * 선택지 삭제
   */
  async function handleDeleteOption(optionId: number) {
    if (
      selectedYear === null ||
      actionLoading
    ) {
      return
    }

    const target = options.find(
      (option) => option.id === optionId,
    )

    if (!target) {
      return
    }

    if (
      !window.confirm(
        `"${target.label}" 선택지를 삭제하시겠습니까?`,
      )
    ) {
      return
    }

    setActionLoading(true)
    setError('')

    try {
      await request<void>(
        `/sessions/${selectedYear}/options/${optionId}`,
        {
          method: 'DELETE',
        },
      )

      /*
       * 삭제된 요소만 제거합니다.
       * 나머지 옵션의 순서는 유지됩니다.
       */
      setOptions((current) =>
        current.filter(
          (option) => option.id !== optionId,
        ),
      )
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return (
      <main className="admin-page">
        <div className="admin-loading">
          관리자 데이터를 불러오는 중입니다.
        </div>
      </main>
    )
  }

  return (
    <main className="admin-page">
      <header className="admin-header">
        <div>
          <p className="admin-eyebrow">
            ADMIN CONTROL PANEL
          </p>

          <h1>관리자 컨트롤 패널</h1>

          <p className="admin-description">
            연도별 투표 세션을 열고 닫거나 선택지를 관리할 수
            있습니다.
          </p>
        </div>

        {selectedSession && (
          <div
            className={`session-status-badge ${
              statusClass[selectedSession.status]
            }`}
          >
            <span className="status-dot" />
            {statusLabel[selectedSession.status]}
          </div>
        )}
      </header>

      {error && (
        <div className="admin-error">
          {error}
        </div>
      )}

      <section className="admin-section">
        <div className="section-heading">
          <div>
            <p className="section-kicker">
              SESSIONS
            </p>

            <h2>연도별 세션</h2>
          </div>

          <span className="section-count">
            {sessions.length}개
          </span>
        </div>

        {sessions.length === 0 ? (
          <div className="empty-panel">
            등록된 투표 세션이 없습니다.
          </div>
        ) : (
          <div className="session-list">
            {sessions.map((session) => (
              <button
                className={`session-card ${
                  selectedYear === session.year
                    ? 'selected'
                    : ''
                }`}
                key={session.year}
                type="button"
                onClick={() =>
                  setSelectedYear(session.year)
                }
              >
                <span className="session-year">
                  {session.year}
                </span>

                <span
                  className={`session-status ${
                    statusClass[session.status]
                  }`}
                >
                  {statusLabel[session.status]}
                </span>

                {session.current && (
                  <span className="current-label">
                    현재 세션
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </section>

      {selectedSession && (
        <>
          <section className="control-card">
            <div>
              <p className="section-kicker">
                SESSION CONTROL
              </p>

              <h2>
                {selectedSession.year}년 세션
              </h2>

              <p className="control-description">
                현재 상태는{' '}
                <strong>
                  {statusLabel[selectedSession.status]}
                </strong>
                입니다.
              </p>
            </div>

            <div className="control-actions">
              <button
                className={`toggle-button ${
                  selectedSession.status === 'OPEN'
                    ? 'is-open'
                    : ''
                }`}
                type="button"
                onClick={() =>
                  void handleStatusToggle()
                }
                disabled={
                  actionLoading ||
                  selectedSession.status === 'CLOSED'
                }
                aria-pressed={
                  selectedSession.status === 'OPEN'
                }
              >
                <span className="toggle-track">
                  <span className="toggle-thumb" />
                </span>

                {selectedSession.status === 'OPEN'
                  ? 'Open'
                  : 'Close'}
              </button>

              {!selectedSession.current && (
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() =>
                    void handleSelectCurrent(
                      selectedSession.year,
                    )
                  }
                  disabled={actionLoading}
                >
                  현재 세션으로 지정
                </button>
              )}
            </div>
          </section>

          <section className="admin-section option-section">
            <div className="section-heading">
              <div>
                <p className="section-kicker">
                  OPTIONS
                </p>

                <h2>선택지 관리</h2>
              </div>

              <span className="section-count">
                {options.length}개
              </span>
            </div>

            <form
              className="option-form"
              onSubmit={(event) =>
                void handleAddOption(event)
              }
            >
              <input
                value={newOption}
                onChange={(event) =>
                  setNewOption(
                    event.target.value,
                  )
                }
                placeholder="새 선택지 입력"
                maxLength={255}
                disabled={actionLoading}
                aria-label="새 선택지"
              />

              <button
                type="submit"
                className="primary-button"
                disabled={
                  actionLoading ||
                  !newOption.trim()
                }
              >
                추가
              </button>
            </form>

            <div className="option-list">
              {optionsLoading ? (
                <div className="empty-panel">
                  선택지를 불러오는 중입니다.
                </div>
              ) : options.length === 0 ? (
                <div className="empty-panel">
                  등록된 선택지가 없습니다.
                </div>
              ) : (
                options.map((option, index) => (
                  <div
                    className="option-row"
                    key={option.id}
                  >
                    <span className="option-number">
                      {index + 1}
                    </span>

                    {editingId === option.id ? (
                      <input
                        className="option-edit-input"
                        value={editingLabel}
                        onChange={(event) =>
                          setEditingLabel(
                            event.target.value,
                          )
                        }
                        maxLength={255}
                        autoFocus
                        disabled={actionLoading}
                        onKeyDown={(event) => {
                          if (
                            event.key === 'Enter'
                          ) {
                            event.preventDefault()

                            void handleUpdateOption(
                              option.id,
                            )
                          }

                          if (
                            event.key === 'Escape'
                          ) {
                            cancelEditing()
                          }
                        }}
                      />
                    ) : (
                      <span className="option-label">
                        {option.label}
                      </span>
                    )}

                    <div className="option-actions">
                      {editingId === option.id ? (
                        <>
                          <button
                            className="text-button save"
                            type="button"
                            onClick={() =>
                              void handleUpdateOption(
                                option.id,
                              )
                            }
                            disabled={
                              actionLoading ||
                              !editingLabel.trim()
                            }
                          >
                            저장
                          </button>

                          <button
                            className="text-button"
                            type="button"
                            onClick={
                              cancelEditing
                            }
                            disabled={
                              actionLoading
                            }
                          >
                            취소
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            className="text-button"
                            type="button"
                            onClick={() =>
                              startEditing(option)
                            }
                            disabled={
                              actionLoading
                            }
                          >
                            수정
                          </button>

                          <button
                            className="text-button danger"
                            type="button"
                            onClick={() =>
                              void handleDeleteOption(
                                option.id,
                              )
                            }
                            disabled={
                              actionLoading
                            }
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

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : '알 수 없는 오류가 발생했습니다.'
}

export default AdminPage