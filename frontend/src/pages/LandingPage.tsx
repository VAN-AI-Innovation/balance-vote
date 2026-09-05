import './LandingPage.css'

/**
 * 화면 안내 페이지.
 *
 * 세 화면은 각각 다른 사람이 다른 기기에서 연다.
 * 어떤 URL 로 들어가야 하는지 알려 주는 진입점이 필요하다.
 */

const SCREENS = [
  {
    path: '/participant',
    title: '참가자 화면',
    description:
      '관객이 휴대폰으로 접속해 투표하는 화면입니다. QR 코드는 이 주소로 연결하세요.',
    tone: 'primary' as const,
  },
  {
    path: '/result',
    title: '결과 화면',
    description:
      '무대 프로젝터에 띄우는 실시간 득표율 화면입니다. F 키로 전체화면을 전환할 수 있습니다.',
    tone: 'default' as const,
  },
  {
    path: '/admin',
    title: '관리자 화면',
    description:
      '진행자가 연도별 투표를 열고 닫는 화면입니다. 관리자 키가 필요합니다.',
    tone: 'default' as const,
  },
]

function LandingPage() {
  return (
    <main className="landing-page">
      <section className="landing-inner">
        <p className="landing-badge">BALANCE VOTE</p>

        <h1 className="landing-title">실시간 밸런스 투표</h1>

        <p className="landing-description">
          컨퍼런스 세션에서 2030년부터 2050년까지 5개 연도의 밸런스 게임
          투표를 진행합니다. 사용할 화면을 선택해 주세요.
        </p>

        <div className="landing-links">
          {SCREENS.map((screen) => (
            <a
              key={screen.path}
              className={`landing-card landing-card-${screen.tone}`}
              href={screen.path}
            >
              <span className="landing-card-title">{screen.title}</span>
              <span className="landing-card-path">{screen.path}</span>
              <span className="landing-card-description">
                {screen.description}
              </span>
            </a>
          ))}
        </div>
      </section>
    </main>
  )
}

export default LandingPage
