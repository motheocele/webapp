import './App.css'
import Header from './components/Header'

function App() {
  return (
    <>
      <Header />
      <main className="app-main">
        <h1>WebApp</h1>
        <p className="muted">
          You’re looking at the scaffolded frontend. Authentication is handled by Azure Static Web Apps.
        </p>
      </main>
    </>
  )
}

export default App
