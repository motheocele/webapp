import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'

const LOGIN_URL = '/.auth/login/aad'
const LOGOUT_URL = '/.auth/logout'

export default function Header() {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const location = useLocation()

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (!open) return
      const el = menuRef.current
      if (el && !el.contains(e.target as Node)) {
        setOpen(false)
      }
    }

    function onDocKeyDown(e: KeyboardEvent) {
      if (!open) return
      if (e.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', onDocMouseDown)
    document.addEventListener('keydown', onDocKeyDown)
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown)
      document.removeEventListener('keydown', onDocKeyDown)
    }
  }, [open])

  return (
    <header className="app-header" aria-label="App header">
      <div className="app-header__inner">
        <div className="app-header__brand">
          <Link to="/" className="app-header__brandLink" aria-label="Go to home">
            WebApp
          </Link>
        </div>

        <nav className="app-header__nav" aria-label="Primary">
          <Link
            to="/notepad"
            className={
              location.pathname.startsWith('/notepad')
                ? 'app-header__navLink is-active'
                : 'app-header__navLink'
            }
          >
            Canvas Notepad
          </Link>
        </nav>

        <div className="app-header__spacer" />

        <div style={{display:'flex', gap:8, alignItems:'center'}}>
          <label style={{fontSize:12, opacity:0.85, marginRight:6}}>Zoom</label>
          <button type="button" className="np-btn" onClick={() => {
            const cur = Number(getComputedStyle(document.documentElement).getPropertyValue('--canvas-zoom') || 1)
            const next = Math.max(0.25, +(cur - 0.1).toFixed(2))
            document.documentElement.style.setProperty('--canvas-zoom', String(next))
          }}>-</button>
          <button type="button" className="np-btn" onClick={() => {
            const cur = Number(getComputedStyle(document.documentElement).getPropertyValue('--canvas-zoom') || 1)
            const next = Math.min(4, +(cur + 0.1).toFixed(2))
            document.documentElement.style.setProperty('--canvas-zoom', String(next))
          }}>+</button>
        </div>

        <div className="app-header__menu" ref={menuRef}>
          <button
            type="button"
            className="hamburger"
            aria-label="Open menu"
            aria-haspopup="menu"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            <span className="hamburger__bar" />
            <span className="hamburger__bar" />
            <span className="hamburger__bar" />
          </button>

          {open && (
            <div className="menu" role="menu" aria-label="Account menu">
              <a className="menu__item" role="menuitem" href={LOGIN_URL}>
                Login (Entra ID)
              </a>
              <a className="menu__item" role="menuitem" href={LOGOUT_URL}>
                Logout
              </a>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
