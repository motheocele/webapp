import type { DrawingCommand, NotepadState, Stroke } from './drawingTypes'
import { applyCommands, validateCommands } from './commands'
import { postMotRequest, negotiate } from './apiClient'
import { connectPubSubWs, type PubSubWsDebug } from './pubsubWs'
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
  getDebug(): {
    sessionId: string
    mode: 'realtime' | 'stub'
    status: ConnectionStatus
    connected: boolean
    lastRequestId?: string
    pubsub?: PubSubWsDebug
  }
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
    return {
      sessionId: this.sessionId,
      mode: 'stub' as const,
      status: 'stub' as const,
      connected: false,
      lastRequestId: this.lastRequestId,
    }
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

  private pubsubDebug: PubSubWsDebug | undefined

  constructor(sessionId: string) {
    this.sessionId = sessionId
  }

  async init() {
    // Important: if negotiate succeeds, we stay in realtime mode even if WS is still connecting.
    this.status = 'connecting'

    const nego = await negotiate(this.sessionId)

    this.pubsubDebug = {
      negotiate: {
        status: 'ok',
        httpStatus: 200,
        hub: nego.hub,
        group: nego.group,
        urlHost: safeUrlHost(nego.url),
      },
      ws: {
        readyState: 3,
        reconnectAttempt: 0,
        urlHost: safeUrlHost(nego.url),
      },
      joinGroup: {
        status: 'idle',
      },
    }

    const conn = connectPubSubWs({
      url: nego.url,
      group: nego.group,
      hub: nego.hub,
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
        onDebug: (d) => {
          this.pubsubDebug = d
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
    return {
      sessionId: this.sessionId,
      mode: 'realtime' as const,
      status: this.status,
      connected: this.connected,
      lastRequestId: this.lastRequestId,
      pubsub: this.pubsubDebug,
    }
  }

  async dispose() {
    await this.stop?.()
  }
}

export async function createBestEffortTransport(sessionId: string): Promise<MotTransport> {
  // Rule:
  // - If negotiate succeeds (HTTP 200), we MUST remain in realtime mode (even if WS is still connecting).
  // - Only fall back to stub if negotiate endpoint is missing / disabled (404/501) or repeatedly fails.
  try {
    const rt = new MotRealtimeTransport(sessionId)
    await rt.init()
    return rt
  } catch (err) {
    const msg = String(err)
    const isMissing = msg.includes('negotiate failed: 404') || msg.includes('negotiate failed: 501')
    if (isMissing) {
      const stub = new MotStubTransport(sessionId)
      await stub.init()
      return stub
    }
    // Otherwise, keep realtime mode and surface connection errors in the debug panel.
    const rt = new MotRealtimeTransport(sessionId)
    await rt.init().catch(() => {
      // swallow
    })
    return rt
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

function safeUrlHost(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return 'invalid-url'
  }
}
