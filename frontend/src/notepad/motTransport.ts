import type { DrawingCommand, NotepadState, Stroke } from './drawingTypes'
import { applyCommands, validateCommands } from './commands'
import { postMotRequest, negotiate } from './apiClient'
import { connectPubSub } from './pubsubClient'
import {
  LIMITS,
  clampStrokeForSend,
  safeParseResponseEvent,
  type RequestMessageV1,
  type ResponseEventV1,
} from './protocol'
import { motRespond } from './motStub'

export type MotReply = {
  requestId: string
  replyText: string
  commands: DrawingCommand[]
  edits: ResponseEventV1['edits']
}

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'stub'

export interface MotTransport {
  init(): Promise<void>
  sendChat(text: string, state: NotepadState): Promise<string> // requestId
  sendStrokeSharpen(stroke: Stroke, state: NotepadState): Promise<string>
  onReply(cb: (reply: MotReply) => void): () => void
  getModeLabel(): string
  getStatus(): ConnectionStatus
  getDebug(): { sessionId: string; connected: boolean; lastRequestId?: string }
  dispose(): Promise<void>
}

function nowIso() {
  return new Date().toISOString()
}

function newId() {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function getOrCreateSessionId(storage = window.localStorage) {
  const key = 'mot.notepad.sessionId'
  const existing = storage.getItem(key)
  if (existing) return existing
  const sid = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`
  storage.setItem(key, sid)
  return sid
}

type ReplyHandler = (reply: MotReply) => void

export class MotStubTransport implements MotTransport {
  private handlers = new Set<ReplyHandler>()
  private lastRequestId: string | undefined
  private sessionId: string

  constructor(sessionId: string) {
    this.sessionId = sessionId
  }

  async init() {
    // no-op
  }

  async sendChat(text: string, state: NotepadState): Promise<string> {
    const requestId = newId()
    this.lastRequestId = requestId

    const res = motRespond(text, state)
    // Convert stub response to a v1-like reply.
    const commands = validateCommands(res.commands.slice(0, LIMITS.maxCommands), state.canvas)
    const reply: MotReply = { requestId, replyText: res.replyText, commands, edits: [] }

    queueMicrotask(() => {
      for (const h of this.handlers) h(reply)
    })

    return requestId
  }

  async sendStrokeSharpen(_stroke: Stroke, _state: NotepadState): Promise<string> {
    // MVP: no sharpening in stub mode (yet)
    const requestId = newId()
    this.lastRequestId = requestId
    const reply: MotReply = { requestId, replyText: '', commands: [], edits: [] }
    queueMicrotask(() => {
      for (const h of this.handlers) h(reply)
    })
    return requestId
  }

  onReply(cb: (reply: MotReply) => void) {
    this.handlers.add(cb)
    return () => this.handlers.delete(cb)
  }

  getModeLabel() {
    return 'stub'
  }

  getStatus(): ConnectionStatus {
    return 'stub'
  }

  getDebug() {
    return { sessionId: this.sessionId, connected: false, lastRequestId: this.lastRequestId }
  }

  async dispose() {
    // no-op
  }
}

export class MotRealtimeTransport implements MotTransport {
  private handlers = new Set<ReplyHandler>()
  private stop: (() => Promise<void>) | null = null
  private connected = false
  private lastRequestId: string | undefined
  private status: ConnectionStatus = 'connecting'
  private sessionId: string

  constructor(sessionId: string) {
    this.sessionId = sessionId
  }

  async init() {
    this.status = 'connecting'

    const nego = await negotiate(this.sessionId)

    const conn = await connectPubSub({
      url: nego.url,
      group: nego.group,
      handlers: {
        onConnected: () => {
          this.connected = true
          this.status = 'connected'
        },
        onDisconnected: () => {
          this.connected = false
          this.status = 'disconnected'
        },
        onError: () => {
          this.connected = false
          this.status = 'disconnected'
        },
        onServerMessage: (msg) => {
          const json = typeof msg === 'string' ? safeJsonParse(msg) : msg
          const evt = safeParseResponseEvent(json)
          if (!evt) return
          if (evt.sessionId !== this.sessionId) return

          const reply: MotReply = {
            requestId: evt.requestId,
            replyText: evt.replyText,
            commands: evt.commands,
            edits: evt.edits,
          }
          for (const h of this.handlers) h(reply)
        },
      },
    })

    this.stop = conn.stop
    // If the WS connects slowly, the status will update via events.
    // Consider it ready once negotiate + start completes.
    if (!this.connected) this.status = 'connected'
  }

  async sendChat(text: string, state: NotepadState): Promise<string> {
    const requestId = newId()
    this.lastRequestId = requestId

    const req: RequestMessageV1 = {
      v: 1,
      requestId,
      sessionId: this.sessionId,
      type: 'chat_draw',
      createdAt: nowIso(),
      payload: {
        text: text.slice(0, LIMITS.maxTextLen),
        canvas: state.canvas,
      },
    }

    await postMotRequest(req)
    return requestId
  }

  async sendStrokeSharpen(stroke: Stroke, state: NotepadState): Promise<string> {
    const requestId = newId()
    this.lastRequestId = requestId

    const safeStroke = clampStrokeForSend(stroke, state.canvas)

    const req: RequestMessageV1 = {
      v: 1,
      requestId,
      sessionId: this.sessionId,
      type: 'stroke_sharpen',
      createdAt: nowIso(),
      payload: {
        canvas: state.canvas,
        stroke: safeStroke,
      },
    }

    await postMotRequest(req)
    return requestId
  }

  onReply(cb: (reply: MotReply) => void) {
    this.handlers.add(cb)
    return () => this.handlers.delete(cb)
  }

  getModeLabel() {
    return 'realtime'
  }

  getStatus(): ConnectionStatus {
    return this.status
  }

  getDebug() {
    return { sessionId: this.sessionId, connected: this.connected, lastRequestId: this.lastRequestId }
  }

  async dispose() {
    await this.stop?.()
  }
}

export async function createBestEffortTransport(sessionId: string): Promise<MotTransport> {
  // Rule: default to realtime, only fall back to stub if negotiate/connect fails.
  const rt = new MotRealtimeTransport(sessionId)
  try {
    await rt.init()
    return rt
  } catch {
    const stub = new MotStubTransport(sessionId)
    await stub.init()
    return stub
  }
}

export function applyMotReply(state: NotepadState, reply: MotReply): NotepadState {
  // Apply commands to mot layer.
  const valid = validateCommands(reply.commands.slice(0, LIMITS.maxCommands), state.canvas)
  let next = applyCommands(state, valid)

  // Apply edits (replaceStroke -> convert replacement into Mot commands and remove rough stroke)
  for (const e of reply.edits) {
    if (e.op !== 'replaceStroke') continue
    // remove the rough stroke
    next = { ...next, strokes: next.strokes.filter((s) => s.id !== e.strokeId) }
    const repl = validateCommands(e.replacement.slice(0, LIMITS.maxCommands), next.canvas)
    next = applyCommands(next, repl)
  }

  return next
}

function safeJsonParse(s: string): unknown {
  try {
    return JSON.parse(s)
  } catch {
    return null
  }
}
