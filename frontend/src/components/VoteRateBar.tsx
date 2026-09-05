import { useEffect, useRef, useState } from 'react'

type VoteRateBarProps = {
  label: string
  voteCount: number
  voteRate: number
  /** 선택지 순서. 막대 색상을 결정한다 */
  index: number
  /** 최다 득표 여부. 강조 표시에 사용한다 */
  isLeading: boolean
  /** 결과가 확정되었는지. 마감 시 1위를 강조한다 */
  isFinal: boolean
}

const ANIMATION_DURATION = 900

/**
 * 선택지별 색상.
 *
 * 밸런스 게임은 보통 2~3개 선택지이므로 앞의 색이 실제로 쓰인다.
 * 색맹 사용자를 고려해 명도 차이가 큰 조합을 사용한다.
 */
const BAR_COLORS = [
  '#d43f3f',
  '#e8862b',
  '#2fa4c7',
  '#5b53c4',
  '#2f9e6b',
  '#c2417f',
]

function VoteRateBar({
  label,
  voteCount,
  voteRate,
  index,
  isLeading,
  isFinal,
}: VoteRateBarProps) {
  const targetRate = Math.min(100, Math.max(0, voteRate))

  const [animatedRate, setAnimatedRate] = useState(0)
  const [animatedCount, setAnimatedCount] = useState(0)

  /*
   * 현재 화면에 그려진 값.
   *
   * 기존에는 애니메이션이 '완료'될 때만 기준값을 갱신했다.
   * 투표는 900ms 보다 훨씬 자주 들어오므로 새 목표값이 도착할 때마다
   * 마지막으로 완료된 값에서 다시 출발했고, 그 결과 막대가 뒤로
   * 튀었다가 다시 늘어나는 현상이 있었다.
   * 매 프레임 실제 표시값을 기록해 항상 현재 위치에서 이어지게 한다.
   */
  const displayedRateRef = useRef(0)
  const displayedCountRef = useRef(0)

  useEffect(() => {
    const startRate = 0
    const startCount = 0
    const startTime = performance.now()

    let animationFrame = 0

    const animate = (currentTime: number) => {
      const progress = Math.min(
        (currentTime - startTime) / ANIMATION_DURATION,
        1,
      )

      /* ease-out cubic */
      const eased = 1 - Math.pow(1 - progress, 3)

      const nextRate = startRate + (targetRate - startRate) * eased
      const nextCount = startCount + (voteCount - startCount) * eased

      displayedRateRef.current = nextRate
      displayedCountRef.current = nextCount

      setAnimatedRate(nextRate)
      setAnimatedCount(nextCount)

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate)
      } else {
        /* 마지막 프레임은 목표값으로 정확히 맞춘다 */
        displayedRateRef.current = targetRate
        displayedCountRef.current = voteCount
        setAnimatedRate(targetRate)
        setAnimatedCount(voteCount)
      }
    }

    animationFrame = requestAnimationFrame(animate)

    return () => cancelAnimationFrame(animationFrame)
  }, [targetRate, voteCount])

  const color = BAR_COLORS[index % BAR_COLORS.length]

  /*
   * 막대가 너무 짧으면 숫자가 막대 안에 들어가지 않으므로
   * 바깥에 표시한다.
   */
  const isNarrow = animatedRate < 22

  return (
    <div
      className={`vote-rate-item${isLeading && isFinal ? ' is-winner' : ''}`}
    >
      <div className="vote-rate-header">
        <span className="vote-rate-label">
          {label}
          {isLeading && isFinal && (
            <span className="winner-tag" aria-label="최다 득표">
              최다 득표
            </span>
          )}
        </span>

        <span className="vote-rate-percent" style={{ color }}>
          {animatedRate.toFixed(1)}%
        </span>
      </div>

      <div
        className="vote-rate-track"
        role="progressbar"
        aria-label={`${label} 득표율`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Number(targetRate.toFixed(1))}
        aria-valuetext={`${targetRate.toFixed(1)}퍼센트, ${voteCount}표`}
      >
        <div
          className="vote-rate-fill"
          style={{
            width: `${Math.max(animatedRate, 0)}%`,
            background: color,
          }}
        >
          {!isNarrow && (
            <span className="vote-rate-count">
              {Math.round(animatedCount)}
            </span>
          )}
        </div>

        {isNarrow && (
          <span className="vote-rate-count outside" style={{ color }}>
            {Math.round(animatedCount)}
          </span>
        )}
      </div>
    </div>
  )
}

export default VoteRateBar
