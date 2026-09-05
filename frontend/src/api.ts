import { API_BASE_URL, getAdminToken } from './config'
import type {
  VoteOption,
  VoteResult,
  VoteSession,
  VoteStatusCheck,
  VoterToken,
} from './types'

/**
 * API 오류. 상태 코드를 함께 담아 호출부가 409/401 등을 분기할 수 있게 한다.
 */
export class ApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'

type RequestOptions = RequestInit & {
  /** 관리자 API 는 X-Admin-Token 헤더가 필요하다 */
  admin?: boolean
}

/**
 * 공통 요청 함수.
 *
 * 1. 204 및 body 가 빈 200 응답 처리
 * 2. JSON 이 아닌 응답에서도 JSON.parse 오류가 나지 않게 처리
 * 3. 서버의 한국어 오류 메시지를 최대한 그대로 전달
 */
export async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { admin, headers, ...init } = options

  const finalHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((headers as Record<string, string>) ?? {}),
  }

  if (admin) {
    const token = getAdminToken()

    if (token) {
      finalHeaders['X-Admin-Token'] = token
    }
  }

  let response: Response

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      headers: finalHeaders,
      ...init,
    })
  } catch {
    /*
     * fetch 자체가 실패하는 경우는 네트워크 단절이나 CORS 차단이다.
     * 상태 코드가 없으므로 0 으로 표시한다.
     */
    throw new ApiError(
      '서버에 연결할 수 없습니다. 네트워크 상태를 확인해 주세요.',
      0,
    )
  }

  /*
   * 백엔드 주소가 설정되지 않으면 요청이 프론트엔드 자신에게 가고
   * 정적 호스팅이 index.html 을 200 으로 돌려준다.
   * 그대로 두면 JSON 파싱만 조용히 실패해 원인을 찾기 어려우므로
   * 설정 문제임을 명시한다.
   */
  const contentType = response.headers.get('Content-Type') ?? ''

  if (contentType.includes('text/html')) {
    throw new ApiError(
      'API 서버에 연결되지 않았습니다. ' +
        'VITE_API_BASE_URL 환경 변수가 백엔드 주소로 설정되어 있는지 확인해 주세요.',
      response.status,
    )
  }

  /*
   * body 를 먼저 text 로 읽는다.
   *
   * response.json() 을 바로 호출하면 body 가 빈 200/204 응답에서
   * "Unexpected end of JSON input" 오류가 발생한다.
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
        message = text.trim()
      }
    }

    throw new ApiError(message, response.status)
  }

  if (!text.trim()) {
    return undefined as T
  }

  try {
    return JSON.parse(text) as T
  } catch {
    return undefined as T
  }
}

/* ------------------------------------------------------------------ */
/* 조회 (공개)                                                         */
/* ------------------------------------------------------------------ */

export const fetchSessions = () => request<VoteSession[]>('/sessions')

export const fetchSession = (year: number) =>
  request<VoteSession>(`/sessions/${year}`)

/**
 * 현재 진행 중으로 지정된 세션.
 *
 * 지정된 세션이 없으면 404 이므로 null 로 변환한다.
 */
export const fetchCurrentSession = async (): Promise<VoteSession | null> => {
  try {
    return await request<VoteSession>('/sessions/current')
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null
    }

    throw error
  }
}

export const fetchOptions = (year: number) =>
  request<VoteOption[]>(`/sessions/${year}/options`)

export const fetchResult = (year: number) =>
  request<VoteResult>(`/sessions/${year}/votes/result`)

/* ------------------------------------------------------------------ */
/* 참가자                                                              */
/* ------------------------------------------------------------------ */

export const issueVoterToken = (year: number) =>
  request<VoterToken>(`/sessions/${year}/votes/token`, { method: 'POST' })

export const submitVote = (
  year: number,
  optionId: number,
  voterToken: string,
) =>
  request<VoteResult>(`/sessions/${year}/votes`, {
    method: 'POST',
    body: JSON.stringify({ optionId, voterToken }),
  })

export const checkHasVoted = (year: number, voterToken: string) =>
  request<VoteStatusCheck>(
    `/sessions/${year}/votes/status?voterToken=${encodeURIComponent(voterToken)}`,
  )

/* ------------------------------------------------------------------ */
/* 관리자                                                              */
/* ------------------------------------------------------------------ */

export type SessionAction = 'open' | 'close' | 'reopen' | 'reset'

export const runSessionAction = (year: number, action: SessionAction) =>
  request<VoteSession>(`/sessions/${year}/${action}`, {
    method: 'POST',
    admin: true,
  })

export const selectCurrentSession = (year: number) =>
  request<VoteSession>(`/sessions/${year}/current`, {
    method: 'PUT',
    admin: true,
  })

export const updateQuestion = (year: number, question: string) =>
  request<VoteSession>(`/sessions/${year}/question`, {
    method: 'PUT',
    admin: true,
    body: JSON.stringify({ question }),
  })

export const createOption = (year: number, label: string) =>
  request<VoteOption>(`/sessions/${year}/options`, {
    method: 'POST',
    admin: true,
    body: JSON.stringify({ label }),
  })

export const updateOption = (year: number, optionId: number, label: string) =>
  request<VoteOption>(`/sessions/${year}/options/${optionId}`, {
    method: 'PUT',
    admin: true,
    body: JSON.stringify({ label }),
  })

export const deleteOption = (year: number, optionId: number) =>
  request<void>(`/sessions/${year}/options/${optionId}`, {
    method: 'DELETE',
    admin: true,
  })

/**
 * 관리자 키가 유효한지 확인한다.
 *
 * 부수효과가 없는 관리자 요청이 필요하므로 CSV 출력을 사용한다.
 * (출력은 GET 이지만 인증이 걸려 있다)
 */
export const verifyAdminToken = async (): Promise<void> => {
  await request<unknown>('/sessions/export', { admin: true })
}

/**
 * CSV 를 내려받는다.
 *
 * 인증 헤더가 필요하므로 <a href> 로는 처리할 수 없고
 * fetch 로 받아 Blob 으로 저장해야 한다.
 */
export async function downloadCsv(path: string, fallbackName: string) {
  const token = getAdminToken()

  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: token ? { 'X-Admin-Token': token } : {},
  })

  if (!response.ok) {
    const text = await response.text()
    let message = `내려받기에 실패했습니다. (${response.status})`

    try {
      const body = JSON.parse(text)

      if (typeof body?.message === 'string') {
        message = body.message
      }
    } catch {
      /* 형식이 아니면 기본 메시지를 사용한다 */
    }

    throw new ApiError(message, response.status)
  }

  const disposition = response.headers.get('Content-Disposition')
  const match = disposition?.match(/filename="([^"]+)"/)
  const fileName = match?.[1] ?? fallbackName

  const blob = await response.blob()
  const url = URL.createObjectURL(blob)

  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()

  URL.revokeObjectURL(url)
}
