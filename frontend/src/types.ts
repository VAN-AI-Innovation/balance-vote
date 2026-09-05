/**
 * 백엔드 DTO 와 1:1로 대응하는 타입.
 *
 * 이전에는 세 화면이 각각 같은 타입을 다시 선언해
 * 백엔드 응답이 바뀔 때 세 곳을 손으로 맞춰야 했다.
 */

export type VoteStatus = 'WAITING' | 'OPEN' | 'CLOSED'

/** GET /api/sessions, /api/sessions/current, /api/sessions/{year} */
export type VoteSession = {
  year: number
  question: string | null
  status: VoteStatus
  current: boolean
  optionCount: number
  totalVotes: number
  openedAt: string | null
  closedAt: string | null
}

/** GET /api/sessions/{year}/options */
export type VoteOption = {
  id: number
  sessionId: number
  label: string
}

export type VoteOptionResult = {
  optionId: number
  label: string
  voteCount: number
  /** 서버에서 계산된 득표율. 소수점 1자리 */
  voteRate: number
}

/** GET /api/sessions/{year}/votes/result 및 /topic/vote/{year} */
export type VoteResult = {
  year: number
  question: string | null
  status: VoteStatus
  totalVotes: number
  /**
   * 단조 증가하는 브로드캐스트 순번.
   *
   * 동시 투표 시 메시지 도착 순서가 뒤바뀔 수 있으므로
   * 이미 적용한 순번보다 작은 프레임은 버린다.
   */
  sequence: number
  options: VoteOptionResult[]
}

export type VoterToken = {
  voterToken: string
}

export type VoteStatusCheck = {
  hasVoted: boolean
}

export const STATUS_LABEL: Record<VoteStatus, string> = {
  WAITING: '대기',
  OPEN: '진행 중',
  CLOSED: '마감',
}

export const PARTICIPANT_STATUS_LABEL: Record<VoteStatus, string> = {
  WAITING: '대기 중',
  OPEN: '투표 진행 중',
  CLOSED: '투표 마감',
}
