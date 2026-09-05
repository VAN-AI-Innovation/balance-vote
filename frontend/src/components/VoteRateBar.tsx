import { useEffect, useRef, useState } from 'react'

type VoteRateBarProps = {
  label: string
  voteCount: number
  voteRate: number
}

const ANIMATION_DURATION = 1100

function VoteRateBar({ label, voteCount, voteRate }: VoteRateBarProps) {
  const targetRate = Math.min(100, Math.max(0, voteRate))
  const [animatedRate, setAnimatedRate] = useState(0)
  const previousRateRef = useRef(0)

  useEffect(() => {
    const startRate = previousRateRef.current
    const startTime = performance.now()
    let animationFrame = 0

    const animate = (currentTime: number) => {
      const progress = Math.min(
        (currentTime - startTime) / ANIMATION_DURATION,
        1,
      )
      const easedProgress = 1 - Math.pow(1 - progress, 3)
      const nextRate = startRate + (targetRate - startRate) * easedProgress

      setAnimatedRate(nextRate)

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate)
      } else {
        previousRateRef.current = targetRate
      }
    }

    animationFrame = requestAnimationFrame(animate)

    return () => {
      cancelAnimationFrame(animationFrame)
    }
  }, [targetRate])

  return (
    <div className="vote-rate-item">
      <div className="vote-rate-header">
        <span className="vote-rate-label">{label}</span>
        <span className="vote-rate-value">
          {animatedRate.toFixed(1)}% · {voteCount}표
        </span>
      </div>

      <div
        className="vote-rate-track"
        role="progressbar"
        aria-label={`${label} 득표율`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={animatedRate}
      >
        <div
          className="vote-rate-fill"
          style={{ width: `${animatedRate}%` }}
        />
      </div>
    </div>
  )
}

export default VoteRateBar
