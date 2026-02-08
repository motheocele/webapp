import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChatMessage } from '../../notepad/drawingTypes'

type Props = {
  title?: string
  modeLabel: 'realtime' | 'stub'
  statusLabel: string
  messages: ChatMessage[]
  onSend: (text: string) => void
  busy?: boolean
  debug?: {
    sessionId: string
    mode: 'realtime' | 'stub'
    status: string
    connected: boolean
    lastRequestId?: string
    pubsub?: {
      negotiate?: { status?: string; httpStatus?: number; error?: string; hub?: string; group?: string; urlHost?: string }
      ws?: {
        urlHost?: string
        readyState?: number
        onOpenAt?: string
        onCloseAt?: string
        closeCode?: number
        closeReason?: string
        error?: string
        reconnectAttempt?: number
        nextRetryMs?: number
      }
      joinGroup?: { status?: string; ackId?: number; success?: boolean; error?: unknown }
      lastServerMessageSnippet?: string
    }
  }
}

export default function ChatPanel({
  title = 'Chat with Mot',
  modeLabel,
  statusLabel,
  messages,
  onSend,
  busy,
  debug,
}: Props) {
  const [draft, setDraft] = useState('')
  const [userScrolledUp, setUserScrolledUp] = useState(false)
  const listRef = useRef<HTMLDivElement | null>(null)
  const bottomRef = useRef<HTMLDivElement | null>(null)

  const canSend = useMemo(() => draft.trim().length > 0 && !busy, [draft, busy])

  function scrollToBottom() {
    const el = bottomRef.current
    if (!el) return
    if (typeof (el as any).scrollIntoView === 'function') {
      el.scrollIntoView({ block: 'end', behavior: 'smooth' })
    }
  }

  useEffect(() => {
    const el = listRef.current
    if (!el) return
    const listEl = el

    function onScroll() {
      const distance = listEl.scrollHeight - listEl.scrollTop - listEl.clientHeight
      setUserScrolledUp(distance > 40)
    }

    listEl.addEventListener('scroll', onScroll)
    onScroll()
    return () => listEl.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (!userScrolledUp) scrollToBottom()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length])

  function send() {
    const t = draft.trim()
    if (!t) return
    onSend(t)
    setDraft('')
  }

  return (
    <aside className="chat" aria-label="Chat panel">
      <header className="chat__header">
        <div>
          <div className="chat__title">{title}</div>
          <div className="chat__subtitle">
            <span className={modeLabel === 'realtime' ? 'badge badge--ok' : 'badge badge--warn'}>
              {modeLabel === 'realtime' ? 'Realtime' : 'Stub fallback'}
            </span>
            <span className="chat__status">{statusLabel}</span>
          </div>
        </div>

        {debug && (
          <details className="chat__debug">
            <summary>Debug</summary>
            <div className="chat__debugGrid">
              <div>
                <div className="chat__debugKey">sessionId</div>
                <div className="chat__debugVal">
                  <code>{debug.sessionId}</code>
                </div>
              </div>
              <div>
                <div className="chat__debugKey">mode / status</div>
                <div className="chat__debugVal">
                  {debug.mode} / {debug.status}
                </div>
              </div>

              <div>
                <div className="chat__debugKey">negotiate</div>
                <div className="chat__debugVal">
                  {debug.pubsub?.negotiate?.status ?? '—'}
                  {typeof debug.pubsub?.negotiate?.httpStatus === 'number' ? ` (${debug.pubsub?.negotiate?.httpStatus})` : ''}
                  {debug.pubsub?.negotiate?.urlHost ? ` · ${debug.pubsub?.negotiate?.urlHost}` : ''}
                </div>
              </div>
              <div>
                <div className="chat__debugKey">group</div>
                <div className="chat__debugVal">
                  <code>{debug.pubsub?.negotiate?.group ?? '—'}</code>
                </div>
              </div>

              <div>
                <div className="chat__debugKey">ws</div>
                <div className="chat__debugVal">
                  host: <code>{debug.pubsub?.ws?.urlHost ?? '—'}</code> · readyState: <code>{String(debug.pubsub?.ws?.readyState ?? '—')}</code>
                  {debug.pubsub?.ws?.reconnectAttempt != null ? ` · retry #${debug.pubsub.ws.reconnectAttempt}` : ''}
                  {debug.pubsub?.ws?.nextRetryMs != null ? ` · next ${debug.pubsub.ws.nextRetryMs}ms` : ''}
                </div>
              </div>
              <div>
                <div className="chat__debugKey">onopen</div>
                <div className="chat__debugVal">
                  <code>{debug.pubsub?.ws?.onOpenAt ?? '—'}</code>
                </div>
              </div>
              <div>
                <div className="chat__debugKey">onclose</div>
                <div className="chat__debugVal">
                  <code>{debug.pubsub?.ws?.onCloseAt ?? '—'}</code>
                  {debug.pubsub?.ws?.closeCode != null ? ` · code ${debug.pubsub.ws.closeCode}` : ''}
                  {debug.pubsub?.ws?.closeReason ? ` · ${debug.pubsub.ws.closeReason}` : ''}
                </div>
              </div>
              <div>
                <div className="chat__debugKey">onerror</div>
                <div className="chat__debugVal">
                  {debug.pubsub?.ws?.error ? <code>{debug.pubsub.ws.error}</code> : '—'}
                </div>
              </div>

              <div>
                <div className="chat__debugKey">joinGroup</div>
                <div className="chat__debugVal">
                  {debug.pubsub?.joinGroup?.status ?? '—'}
                  {debug.pubsub?.joinGroup?.ackId != null ? ` · ackId ${debug.pubsub.joinGroup.ackId}` : ''}
                  {typeof debug.pubsub?.joinGroup?.success === 'boolean'
                    ? ` · ${debug.pubsub.joinGroup.success ? 'success' : 'failed'}`
                    : ''}
                </div>
              </div>

              <div>
                <div className="chat__debugKey">last server message</div>
                <div className="chat__debugVal">
                  <code>{debug.pubsub?.lastServerMessageSnippet ?? '—'}</code>
                </div>
              </div>

              <div>
                <div className="chat__debugKey">last requestId</div>
                <div className="chat__debugVal">
                  <code>{debug.lastRequestId ?? '—'}</code>
                </div>
              </div>
            </div>
          </details>
        )}
      </header>

      <div className="chat__list" ref={listRef} role="log" aria-label="Message history">
        {messages.length === 0 ? (
          <div className="chat__empty">
            Try: <strong>draw a house</strong>, <strong>draw a circle</strong>, or <strong>write hello</strong>.
          </div>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={m.role === 'user' ? 'msg msg--user' : 'msg msg--mot'}
              aria-busy={m.pending ? 'true' : 'false'}
            >
              <div className="msg__bubble">
                <div className="msg__meta">{m.role === 'user' ? 'You' : 'Mot'}</div>
                <div className="msg__text">{m.pending ? '…' : m.text}</div>
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {userScrolledUp && messages.length > 0 && (
        <button type="button" className="chat__jump" onClick={scrollToBottom} aria-label="Jump to latest">
          Jump to latest
        </button>
      )}

      <div className="chat__composer">
        <label className="np-sr" htmlFor="np-draft">
          Message to Mot
        </label>
        <textarea
          id="np-draft"
          className="chat__input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Message Mot… (Enter to send, Shift+Enter for newline)"
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
          aria-label="Send message"
        >
          Send
        </button>
      </div>
    </aside>
  )
}
