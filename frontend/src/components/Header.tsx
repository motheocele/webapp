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
