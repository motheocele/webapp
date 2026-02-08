import { useEffect, useMemo, useRef, useState } from 'react'
import CanvasBoard from '../components/notepad/CanvasBoard'
import ChatPanel from '../components/notepad/ChatPanel'
import type { ChatMessage, NotepadState, Stroke } from '../notepad/drawingTypes'
import { createBestEffortTransport, applyMotReply, getOrCreateSessionId, type MotTransport } from '../notepad/motTransport'
import './NotepadPage.css'

const initialState: NotepadState = {
  canvas: { width: 800, height: 600, dpr: 1 },
  strokes: [],
  undoneStrokes: [],
  motCommands: [],
}

function newMsgId() {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export default function NotepadPage() {
  const [state, setState] = useState<NotepadState>(initialState)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [transport, setTransport] = useState<MotTransport | null>(null)
  const [modeLabel, setModeLabel] = useState<'realtime' | 'stub'>('realtime')
  const [statusLabel, setStatusLabel] = useState('Connecting…')

  const sessionId = useMemo(() => (typeof window !== 'undefined' ? getOrCreateSessionId() : 'unknown'), [])

  const stateRef = useRef(state)
  useEffect(() => {
    stateRef.current = state
  }, [state])

  useEffect(() => {
    let disposed = false
    let t: MotTransport | null = null
    let unsub: (() => void) | null = null

    async function init() {
      setStatusLabel('Connecting…')
      t = await createBestEffortTransport(sessionId)
      if (disposed) return

      setTransport(t)
      setModeLabel(t.getModeLabel() as 'realtime' | 'stub')
      setStatusLabel(statusFromTransport(t))

      unsub = t.onReply((reply) => {
        // Replace the pending Mot bubble for this request.
        // Extra debug: detect if we received a reply before the pending bubble existed.
        setMessages((prev) => {
          const hasPending = prev.some((m) => m.role === 'mot' && m.pending && m.requestId === reply.requestId)
          if (!hasPending) {
            // eslint-disable-next-line no-console
            console.warn('[mot] reply has no matching pending bubble', {
              requestId: reply.requestId,
              sessionId,
              replyTextPreview: reply.replyText?.slice?.(0, 120),
              pendingCount: prev.filter((m) => m.role === 'mot' && m.pending).length,
            })
          }
          return prev.map((m) =>
            m.role === 'mot' && m.pending && m.requestId === reply.requestId
              ? { ...m, pending: false, text: reply.replyText }
              : m,
          )
        })

        setState((s) => applyMotReply(s, reply))
      })

      // Poll lightweight status label (ws events are internal to transport)
      const interval = window.setInterval(() => {
        if (!t) return
        setStatusLabel(statusFromTransport(t))
      }, 1000)

      return () => window.clearInterval(interval)
    }

    let cleanupInterval: (() => void) | undefined
    void init().then((c) => {
      cleanupInterval = c as unknown as (() => void) | undefined
    })

    return () => {
      disposed = true
      unsub?.()
      cleanupInterval?.()
      void t?.dispose()
    }
  }, [sessionId])

  async function sendChat(text: string) {
    const t = transport
    if (!t) return

    const createdAt = Date.now()
    setMessages((m) => [...m, { id: newMsgId(), role: 'user', text, createdAt }])

    // Create a pending assistant bubble tied to the requestId *before* sending.
    // This avoids a race where the WS reply arrives before we render the pending bubble.
    const requestId = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`
    const pendingId = newMsgId()

    setMessages((m) => [
      ...m,
      {
        id: pendingId,
        role: 'mot',
        text: '',
        pending: true,
        requestId,
        createdAt: Date.now(),
      },
    ])

    try {
      await t.sendChat(text, stateRef.current, requestId)
    } catch (err) {
      // If realtime send fails, show a visible error.
      setMessages((m) =>
        m.map((msg) =>
          msg.id === pendingId
            ? { ...msg, pending: false, text: `I couldn't send that (${String(err)}).` }
            : msg,
        ),
      )
    }
  }

  function onStrokeCommitted(stroke: Stroke) {
    const t = transport
    if (!t) return
    void t.sendStrokeSharpen(stroke, stateRef.current).catch(() => {
      // ignore for now
    })
  }

  return (
    <div className="notepad-page">
      <div className="notepad-page__canvas">
        <CanvasBoard
          state={state}
          onChange={setState}
          onCanvasMetaChange={(meta) => setState((s) => ({ ...s, canvas: meta }))}
          onStrokeCommitted={onStrokeCommitted}
        />
      </div>
      <div className="notepad-page__chat">
        <ChatPanel
          modeLabel={modeLabel}
          statusLabel={statusLabel}
          messages={messages}
          onSend={sendChat}
          busy={false}
          debug={transport?.getDebug()}
        />
      </div>
    </div>
  )
}

function statusFromTransport(t: MotTransport) {
  const s = t.getStatus()
  if (s === 'stub') return 'Realtime unavailable (stub)'
  if (s === 'connected') return 'Connected'
  if (s === 'disconnected') return 'Disconnected (retrying…)'
  return 'Connecting…'
}
