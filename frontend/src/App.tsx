import './App.css'
import { Route, Routes } from 'react-router-dom'
import Header from './components/Header'
import HomePage from './pages/HomePage'
import NotepadPage from './pages/NotepadPage'

function App() {
  return (
    <>
      <Header />
      <main className="app-main">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/notepad" element={<NotepadPage />} />
        </Routes>
      </main>
    </>
  )
}

export default App
