import { useState } from 'react'

type QuestionFormProps = {
  /** 서버에 저장된 현재 문구 */
  question: string | null
  year: number
  disabled: boolean
  onSave: (question: string) => void
}

/**
 * 문제 문구 편집 폼.
 *
 * 별도 컴포넌트로 분리한 이유:
 * 연도를 바꿀 때 입력값을 서버 값으로 되돌려야 하는데, 이를 effect 로
 * 처리하면 렌더 직후 setState 가 다시 발생해 연쇄 렌더가 생긴다.
 * 호출하는 쪽에서 key={year} 를 주면 React 가 컴포넌트를 새로 만들어
 * 내부 상태가 자연스럽게 초기화된다.
 */
function QuestionForm({
  question,
  year,
  disabled,
  onSave,
}: QuestionFormProps) {
  const [draft, setDraft] = useState(question ?? '')

  const isUnchanged = draft.trim() === (question ?? '').trim()

  return (
    <div className="question-form">
      <textarea
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        placeholder={`${year}년에 제시할 밸런스 게임 문제를 입력하세요.`}
        maxLength={500}
        rows={2}
        disabled={disabled}
        aria-label="문제 문구"
      />

      <div className="question-form-footer">
        <span className="question-counter">{draft.length} / 500</span>

        <button
          type="button"
          className="primary-button"
          onClick={() => onSave(draft.trim())}
          disabled={disabled || isUnchanged}
        >
          저장
        </button>
      </div>
    </div>
  )
}

export default QuestionForm
