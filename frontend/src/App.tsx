import { useEffect, useState } from 'react'
import AdminPage from './pages/AdminPage'
import ParticipantPage from './pages/ParticipantPage'
import ResultPage from './pages/ResultPage'
import './App.css'

type Route = '/participant' | '/admin' | '/result'

const getRoute = (): Route => {
  switch (window.location.pathname) {
    case '/admin':
      return '/admin'
    case '/result':
      return '/result'
    case '/participant':
    default:
      return '/participant'
  }
}

function App() {
  const [route, setRoute] = useState<Route>(getRoute)

  useEffect(() => {
    const handlePopState = () => setRoute(getRoute())
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const navigate = (nextRoute: Route) => {
    window.history.pushState({}, '', nextRoute)
    setRoute(nextRoute)
  }

  return (
    <>
      <nav>
        <button type="button" onClick={() => navigate('/participant')}>
          참가자
        </button>
        <button type="button" onClick={() => navigate('/admin')}>
          관리자
        </button>
        <button type="button" onClick={() => navigate('/result')}>
          결과
        </button>
      </nav>

      {route === '/participant' && <ParticipantPage />}
      {route === '/admin' && <AdminPage />}
      {route === '/result' && <ResultPage />}
    </>
  )
}

export default App
