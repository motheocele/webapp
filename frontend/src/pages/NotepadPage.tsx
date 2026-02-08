import { useEffect, useMemo, useRef, useState } from 'react'
import CanvasBoard from '../components/notepad/CanvasBoard'
import ChatPanel from '../components/notepad/ChatPanel'
import type { ChatMessage, NotepadState, Stroke } from '../notepad/drawingTypes'
import { applyCommands, validateCommands } from '../notepad/commands'
import { negotiate, postMotRequest } from '../notepad/apiClient'
import { connectPubSub } from '../notepad/pubsubClient'
import {
  LIMITS,
  clampStrokeForSend,
  safeParseResponseEvent,
  type ReplaceStrokeEditV1,
  type RequestMessageV1,
} from '../notepad/protocol'
import { motRespond } from '../notepad/motStub'
import './NotepadPage.css'

function newId() {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function getOrCreateSessionId() {
  const key = 'mot.notepad.sessionId'
  const existing = window.localStorage.getItem(key)
  if (existing) return existing
  const sid = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`
  window.localStorage.setItem(key, sid)
  return sid
}

const initialState: NotepadState = {
  canvas: { width: 800, height: 600, dpr: 1 },
  strokes: [],
  undoneStrokes: [],
  motCommands: [],
}

type PendingSuggestion = {
  requestId: string
  edit: ReplaceStrokeEditV1
}

export default function NotepadPage() {
  const [state, setState] = useState<NotepadState>(initialState)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [connected, setConnected] = useState(false)
  const [stubMode, setStubMode] = useState(false)
  const [pending, setPending] = useState<Record<string, number>>({})
  const [suggestions, setSuggestions] = useState<PendingSuggestion[]>([])

  const sessionId = useMemo(() => (typeof window !== 'undefined' ? getOrCreateSessionId() : 'unknown'), [])

  const stateRef = useRef(state)
  useEffect(() => {
    stateRef.current = state
  }, [state])

  // Connect to Web PubSub via negotiate.
  useEffect(() => {
    let stop: (() => Promise<void>) | null = null
    let cancelled = false

    async function run() {
      try {
        const nego = await negotiate(sessionId)
        if (cancelled) return

        const conn = await connectPubSub({
          url: nego.url,
          group: nego.group,
          handlers: {
            onConnected: () => setConnected(true),
            onDisconnected: () => setConnected(false),
            onError: () => setConnected(false),
            onServerMessage: (msg) => {
              const json = typeof msg === 'string' ? safeJsonParse(msg) : msg
              const evt = safeParseResponseEvent(json)
              if (!evt) return
              if (evt.sessionId !== sessionId) return

              setPending((p) => {
                const copy = { ...p }
                delete copy[evt.requestId]
                return copy
              })

              setMessages((m) => [...m, { id: newId(), role: 'mot', text: evt.replyText }])

              setState((s) => {
                const valid = validateCommands(evt.commands.slice(0, LIMITS.maxCommands), s.canvas)
                return applyCommands(s, valid)
              })

              // apply edits
              for (const edit of evt.edits) {
                if (edit.op !== 'replaceStroke') continue
                if (edit.confidence >= 0.8) {
                  setState((s) => applyReplaceStroke(s, edit))
                } else {
                  setSuggestions((arr) => [...arr, { requestId: evt.requestId, edit }])
                }
              }
            },
          },
        })

        stop = conn.stop
        setStubMode(false)
      } catch (err) {
        // If Azure isn't configured locally, fall back to stub.
        console.warn('Realtime connect failed; using stub mode', err)
        setStubMode(true)
        setConnected(false)
      }
    }

    void run()
    return () => {
      cancelled = true
      void stop?.()
    }
  }, [sessionId])

  async function enqueue(type: RequestMessageV1['type'], payload: RequestMessageV1['payload']) {
    const req: RequestMessageV1 = {
      v: 1,
      requestId: newId(),
      sessionId,
      type,
      createdAt: new Date().toISOString(),
      payload,
    }

    setPending((p) => ({ ...p, [req.requestId]: Date.now() }))

    try {
      await postMotRequest(req)
    } catch (err) {
      setPending((p) => {
        const copy = { ...p }
        delete copy[req.requestId]
        return copy
      })
      setMessages((m) => [
        ...m,
        {
          id: newId(),
          role: 'mot',
          text: `I couldn't reach the backend (${String(err)}). Staying in stub mode for now.`,
        },
      ])
      setStubMode(true)
    }
  }

  function sendToMot(text: string) {
    const trimmed = text.trim()
    if (!trimmed) return

    const userMsg: ChatMessage = { id: newId(), role: 'user', text: trimmed }
    setMessages((m) => [...m, userMsg])

    if (stubMode) {
      const res = motRespond(trimmed, stateRef.current)
      setMessages((m) => [...m, { id: newId(), role: 'mot', text: res.replyText }])
      const valid = validateCommands(res.commands, stateRef.current.canvas)
      setState((s) => applyCommands(s, valid))
      return
    }

    void enqueue('chat_draw', {
      text: trimmed.slice(0, LIMITS.maxTextLen),
      canvas: stateRef.current.canvas,
    })
  }

  function onStrokeCommitted(stroke: Stroke) {
    if (stubMode) return

    const safe = clampStrokeForSend(stroke, stateRef.current.canvas)
    void enqueue('stroke_sharpen', {
      canvas: stateRef.current.canvas,
      stroke: safe,
    })
  }

  function applySuggestion(s: PendingSuggestion) {
    setState((st) => applyReplaceStroke(st, s.edit))
    setSuggestions((arr) => arr.filter((x) => x !== s))
  }

  const pendingCount = Object.keys(pending).length

  return (
    <div className="notepad-page">
      <div className="notepad-page__canvas">
        <CanvasBoard state={state} onChange={setState} onStrokeCommitted={onStrokeCommitted} />

        <div className="notepad-page__status" aria-label="Realtime status">
          <span>
            Session: <code>{sessionId.slice(0, 8)}…</code>
          </span>
          <span>
            Mode: <strong>{stubMode ? 'stub' : connected ? 'realtime' : 'connecting…'}</strong>
          </span>
          {pendingCount > 0 && <span>Pending: {pendingCount}</span>}
        </div>

        {suggestions.length > 0 && (
          <div className="notepad-page__suggestions" aria-label="Stroke suggestions">
            <div className="np-suggestions__title">Suggestions</div>
            {suggestions.slice(0, 3).map((s) => (
              <div key={`${s.requestId}:${s.edit.strokeId}`} className="np-suggestion">
                <div>
                  Replace stroke <code>{s.edit.strokeId.slice(0, 8)}…</code> (confidence{' '}
                  {Math.round(s.edit.confidence * 100)}%)
                </div>
                <button type="button" className="np-btn np-btn--primary" onClick={() => applySuggestion(s)}>
                  Apply
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="notepad-page__chat">
        <ChatPanel messages={messages} onSend={sendToMot} />
      </div>
    </div>
  )
}

function safeJsonParse(s: string): unknown {
  try {
    return JSON.parse(s)
  } catch {
    return null
  }
}

function applyReplaceStroke(state: NotepadState, edit: ReplaceStrokeEditV1): NotepadState {
  // remove the rough stroke
  const strokes = state.strokes.filter((s) => s.id !== edit.strokeId)
  const replacement = validateCommands(edit.replacement, state.canvas)
  // apply as Mot commands (keeps user undo stack untouched)
  return applyCommands({ ...state, strokes }, replacement)
}
