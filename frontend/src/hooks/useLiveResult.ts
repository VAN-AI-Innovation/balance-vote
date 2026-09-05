import { useCallback, useEffect, useState } from 'react'
import { fetchResult, getErrorMessage } from '../api'
import { onConnectionChange, subscribeTopic } from '../stomp'
import type { VoteResult } from '../types'

/**
 * 연도와 함께 보관하는 집계 스냅샷.
 *
 * 연도가 바뀔 때 effect 에서 상태를 초기화하지 않고,
 * 저장된 연도와 현재 연도를 비교해 렌더 시점에 판단한다.
 * 초기화 effect 는 불필요한 연쇄 렌더를 만든다.
 */
type Snapshot = {
  year: number
  result: VoteResult
  /** 마지막으로 적용한 브로드캐스트 순번 */
  sequence: number
}

type ErrorState = {
  year: number | null
  message: string
}

/**
 * 특정 연도의 집계를 실시간으로 따라간다.
 *
 * 순번(sequence) 기반으로 오래된 프레임을 버린다.
 * 동시 투표가 몰리면 커밋 순서와 메시지 도착 순서가 어긋나
 * 총 득표수가 순간적으로 줄어드는 것처럼 보일 수 있다.
 */
export function useLiveResult(year: number | null) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [errorState, setErrorState] = useState<ErrorState | null>(null)
  const [connected, setConnected] = useState(false)

  /* 다른 연도의 잔여 값은 보여주지 않는다 */
  const result =
    snapshot !== null && snapshot.year === year ? snapshot.result : null

  const error =
    errorState !== null && errorState.year === year ? errorState.message : ''

  const loading = year !== null && result === null && error === ''

  /**
   * 순번이 더 크거나 같을 때만 반영한다.
   *
   * REST 스냅샷은 마지막 발행 순번과 같은 값을 갖기 때문에
   * '같음'도 허용해야 재연결 직후의 동기화가 반영된다.
   */
  const applyResult = useCallback((next: VoteResult) => {
    setSnapshot((previous) => {
      const sequence = typeof next.sequence === 'number' ? next.sequence : 0

      if (
        previous !== null &&
        previous.year === next.year &&
        sequence < previous.sequence
      ) {
        return previous
      }

      return { year: next.year, result: next, sequence }
    })

    setErrorState(null)
  }, [])

  const refresh = useCallback(async () => {
    if (year === null) {
      return
    }

    try {
      applyResult(await fetchResult(year))
    } catch (err) {
      setErrorState({ year, message: getErrorMessage(err) })
    }
  }, [applyResult, year])

  /* 최초 조회. setTimeout 으로 effect 본문의 동기 setState 를 피한다 */
  useEffect(() => {
    if (year === null) {
      return
    }

    const timeoutId = window.setTimeout(() => void refresh(), 0)

    return () => window.clearTimeout(timeoutId)
  }, [refresh, year])

  useEffect(() => {
    if (year === null) {
      return
    }

    return subscribeTopic(`/topic/vote/${year}`, (body) => {
      try {
        applyResult(JSON.parse(body) as VoteResult)
      } catch {
        /*
         * 잘못된 프레임이 와도 기존 결과는 유지한다.
         */
      }
    })
  }, [applyResult, year])

  /* 재연결 시 끊긴 동안의 투표를 REST 로 메운다 */
  useEffect(() => {
    return onConnectionChange((isConnected) => {
      setConnected(isConnected)

      if (isConnected && year !== null) {
        void refresh()
      }
    })
  }, [refresh, year])

  return {
    result,
    loading,
    error,
    connected,
    refresh: () => void refresh(),
  }
}
