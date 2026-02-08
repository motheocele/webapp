export type JoinStatus = 'idle' | 'sent' | 'ack' | 'error'

export type WsDebug = {
  urlHost?: string
  readyState: number
  onOpenAt?: string
  onCloseAt?: string
  closeCode?: number
  closeReason?: string
  error?: string
  reconnectAttempt: number
  nextRetryMs?: number
}

export type NegotiateDebug = {
  status: 'pending' | 'ok' | 'error'
  httpStatus?: number
  error?: string
  hub?: string
  group?: string
  urlHost?: string
}

export type JoinDebug = {
  status: JoinStatus
  ackId?: number
  success?: boolean
  error?: unknown
  lastAckRaw?: unknown
}

export type PubSubWsDebug = {
  negotiate: NegotiateDebug
  ws: WsDebug
  joinGroup: JoinDebug
  lastServerMessageSnippet?: string
}

export type PubSubWsHandlers = {
  onConnected?: () => void
  onDisconnected?: () => void
  onError?: (err: unknown) => void
  onServerMessage?: (data: unknown) => void
  onDebug?: (debug: PubSubWsDebug) => void
}

function nowIso() {
  return new Date().toISOString()
}

function wsState(ws: WebSocket | null | undefined): number {
  return ws?.readyState ?? 3
}

function safeSnippet(v: unknown, max = 240): string {
  try {
    const s = typeof v === 'string' ? v : JSON.stringify(v)
    return s.length > max ? s.slice(0, max) + '…' : s
  } catch {
    return String(v)
  }
}

function parseUrlHost(url: string): string {
  try {
    const u = new URL(url)
    return u.host
  } catch {
    return 'invalid-url'
  }
}

export type PubSubWsConnection = {
  stop: () => Promise<void>
}

export function connectPubSubWs(params: {
  url: string
  group: string
  hub?: string
  handlers?: PubSubWsHandlers
}): PubSubWsConnection {
  let ws: WebSocket | null = null
  let stopped = false
  let reconnectAttempt = 0
  let timer: number | null = null

  const debug: PubSubWsDebug = {
    negotiate: {
      status: 'ok',
      hub: params.hub,
      group: params.group,
      urlHost: parseUrlHost(params.url),
    },
    ws: {
      readyState: 3,
      reconnectAttempt: 0,
      urlHost: parseUrlHost(params.url),
    },
    joinGroup: {
      status: 'idle',
    },
  }

  let joinAckId = 1

  function emitDebug() {
    debug.ws.readyState = wsState(ws)
    debug.ws.reconnectAttempt = reconnectAttempt
    params.handlers?.onDebug?.({ ...debug, ws: { ...debug.ws }, negotiate: { ...debug.negotiate }, joinGroup: { ...debug.joinGroup } })
  }

  function scheduleReconnect() {
    if (stopped) return
    reconnectAttempt += 1
    const ms = Math.min(10_000, [1000, 2000, 5000, 10_000][Math.min(reconnectAttempt - 1, 3)])
    debug.ws.nextRetryMs = ms
    emitDebug()
    if (timer) window.clearTimeout(timer)
    timer = window.setTimeout(() => {
      timer = null
      void start()
    }, ms)
  }

  function handleClose(ev: CloseEvent) {
    debug.ws.onCloseAt = nowIso()
    debug.ws.closeCode = ev.code
    debug.ws.closeReason = ev.reason
    emitDebug()
    params.handlers?.onDisconnected?.()
    scheduleReconnect()
  }

  function handleError(ev: Event) {
    debug.ws.error = (ev as any)?.message ? String((ev as any).message) : 'ws error'
    emitDebug()
    params.handlers?.onError?.(ev)
    // Browser will usually also fire close; we rely on close for reconnect.
  }

  function handleMessage(ev: MessageEvent) {
    const raw = ev.data
    let msg: any = raw
    try {
      if (typeof raw === 'string') msg = JSON.parse(raw)
    } catch {
      // ignore
    }

    debug.lastServerMessageSnippet = safeSnippet(msg)

    // Web PubSub JSON protocol messages include:
    // - ack: { type: 'ack', ackId, success, error? }
    // - message: { type: 'message', dataType: 'json'|'text', data }
    if (msg && typeof msg === 'object' && msg.type === 'ack' && msg.ackId === joinAckId) {
      debug.joinGroup.status = msg.success ? 'ack' : 'error'
      debug.joinGroup.success = Boolean(msg.success)
      debug.joinGroup.lastAckRaw = msg
      if (!msg.success) debug.joinGroup.error = msg.error
      emitDebug()
      return
    }

    if (msg && typeof msg === 'object' && msg.type === 'message') {
      emitDebug()
      params.handlers?.onServerMessage?.(msg.data ?? msg)
      return
    }

    // Fallback: deliver whatever we got.
    emitDebug()
    params.handlers?.onServerMessage?.(msg)
  }

  async function start() {
    if (stopped) return

    // Reset per-connection state
    debug.ws.error = undefined
    debug.ws.closeCode = undefined
    debug.ws.closeReason = undefined
    debug.ws.nextRetryMs = undefined
    debug.ws.onOpenAt = undefined
    debug.ws.onCloseAt = undefined
    debug.joinGroup = { status: 'idle' }

    emitDebug()

    try {
      // Explicitly request the JSON subprotocol.
      ws = new WebSocket(params.url, 'json.webpubsub.azure.v1')

      ws.onopen = () => {
        debug.ws.onOpenAt = nowIso()
        emitDebug()
        params.handlers?.onConnected?.()

        // Join the session group.
        debug.joinGroup = { status: 'sent', ackId: joinAckId }
        emitDebug()
        try {
          ws?.send(JSON.stringify({ type: 'joinGroup', group: params.group, ackId: joinAckId }))
        } catch (err) {
          debug.joinGroup = { status: 'error', ackId: joinAckId, error: String(err) }
          emitDebug()
        }
      }
      ws.onclose = handleClose
      ws.onerror = handleError
      ws.onmessage = handleMessage

      emitDebug()
    } catch (err) {
      params.handlers?.onError?.(err)
      debug.ws.error = String(err)
      emitDebug()
      scheduleReconnect()
    }
  }

  // kick off immediately
  void start()

  return {
    stop: async () => {
      stopped = true
      if (timer) window.clearTimeout(timer)
      timer = null
      try {
        ws?.close()
      } catch {
        // ignore
      }
      ws = null
      emitDebug()
    },
  }
}
