import { useEffect, useState } from 'react'
import AdminPage from './pages/AdminPage'
import LandingPage from './pages/LandingPage'
import ParticipantPage from './pages/ParticipantPage'
import ResultPage from './pages/ResultPage'

type Route = '/' | '/participant' | '/admin' | '/result'

const getRoute = (): Route => {
  switch (window.location.pathname) {
    case '/admin':
      return '/admin'
    case '/result':
      return '/result'
    case '/participant':
      return '/participant'
    default:
      /*
       * 알 수 없는 경로는 안내 화면으로 보낸다.
       *
       * 이전에는 모든 경로가 참가자 화면으로 떨어져서
       * 오타가 난 QR 링크도 투표 화면처럼 보였다.
       */
      return '/'
  }
}

function App() {
  const [route, setRoute] = useState<Route>(getRoute)

  useEffect(() => {
    const handlePopState = () => setRoute(getRoute())

    window.addEventListener('popstate', handlePopState)

    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  switch (route) {
    case '/admin':
      return <AdminPage />
    case '/result':
      return <ResultPage />
    case '/participant':
      return <ParticipantPage />
    default:
      return <LandingPage />
  }
}

export default App
