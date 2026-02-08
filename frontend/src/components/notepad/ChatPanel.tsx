import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChatMessage } from '../../notepad/drawingTypes'

type Props = {
  messages: ChatMessage[]
  onSend: (text: string) => void
  busy?: boolean
}

export default function ChatPanel({ messages, onSend, busy }: Props) {
  const [draft, setDraft] = useState('')
  const listRef = useRef<HTMLDivElement | null>(null)

  const canSend = useMemo(() => draft.trim().length > 0 && !busy, [draft, busy])

  useEffect(() => {
    const el = listRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [messages.length])

  function send() {
    const t = draft.trim()
    if (!t) return
    onSend(t)
    setDraft('')
  }

  return (
    <aside className="notepad-chat" aria-label="Chat panel">
      <div className="notepad-chat__title">Chat with Mot (local stub)</div>

      <div className="notepad-chat__list" ref={listRef} role="log" aria-label="Message history">
        {messages.length === 0 ? (
          <div className="notepad-chat__empty muted">
            Try: <strong>draw a house</strong>, <strong>draw a circle</strong>, or{' '}
            <strong>write hello</strong>.
          </div>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={m.role === 'user' ? 'chat-msg chat-msg--user' : 'chat-msg chat-msg--mot'}
            >
              <div className="chat-msg__meta">{m.role === 'user' ? 'You' : 'Mot'}</div>
              <div className="chat-msg__text">{m.text}</div>
            </div>
          ))
        )}
      </div>

      <div className="notepad-chat__composer">
        <label className="np-sr" htmlFor="np-draft">
          Message to Mot
        </label>
        <textarea
          id="np-draft"
          className="notepad-chat__input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Type… (Enter to send, Shift+Enter for newline)"
          rows={3}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              if (canSend) send()
            }
          }}
        />
        <button
          type="button"
          className="np-btn np-btn--primary"
          onClick={send}
          disabled={!canSend}
          title="Send"
        >
          Send
        </button>
      </div>
    </aside>
  )
}
