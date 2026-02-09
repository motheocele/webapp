'use strict'

// Mot queue consumer: Service Bus -> (Mot) -> Web PubSub group
// Auth: Managed Identity via DefaultAzureCredential (no connection strings required for Service Bus)

const { ServiceBusClient } = require('@azure/service-bus')
const { DefaultAzureCredential } = require('@azure/identity')
const { WebPubSubServiceClient } = require('@azure/web-pubsub')

// Publish to Web PubSub:
// - Prefer connection string (most reliable, avoids AAD/RBAC data-plane quirks)
// - Fallback to AAD (Managed Identity) via REST

function requiredEnv(name) {
  const v = process.env[name]
  if (!v) throw new Error(`Missing env: ${name}`)
  return v
}

function nowIso() {
  return new Date().toISOString()
}

function groupNameForSession(sessionId) {
  return `session-${sessionId}`
}

function toResponseEvent({ requestId, sessionId, replyText, commands = [], edits = [] }) {
  return {
    v: 1,
    requestId,
    sessionId,
    createdAt: nowIso(),
    replyText,
    commands,
    edits,
  }
}

function pubSubEndpoint() {
  const endpoint = process.env.WEBPUBSUB_ENDPOINT // e.g. https://mot.webpubsub.azure.com
  if (!endpoint) throw new Error('Missing env: WEBPUBSUB_ENDPOINT')
  return endpoint.replace(/\/+$/, '')
}

function getPubSubSender() {
  const hub = requiredEnv('WEBPUBSUB_HUB')

  const connStr = process.env.WEBPUBSUB_CONNECTION_STRING
  if (connStr) {
    const client = new WebPubSubServiceClient(connStr, hub)
    return {
      hub,
      sendToGroup: async (group, payload) => {
        // @azure/web-pubsub v1.2.0 uses a group client
        await client.group(group).sendToAll(payload, { contentType: 'application/json' })
      },
    }
  }

  // Fallback: AAD via REST
  return {
    hub,
    sendToGroup: async (group, payload) => {
      const endpoint = pubSubEndpoint()
      const credential = new DefaultAzureCredential()
      const token = await credential.getToken('https://webpubsub.azure.com/.default')
      if (!token?.token) throw new Error('Failed to acquire AAD token for Web PubSub')

      const url = `${endpoint}/api/hubs/${encodeURIComponent(hub)}/groups/${encodeURIComponent(group)}/:send?api-version=2021-10-01`

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(`WebPubSub sendToGroup failed: ${res.status} ${text}`)
      }
    },
  }
}

function env(name, fallback = undefined) {
  const v = process.env[name]
  return v == null || v === '' ? fallback : v
}

function clampStr(s, n) {
  s = s == null ? '' : String(s)
  return s.length > n ? s.slice(0, n) : s
}

function extractOpenResponsesText(resp) {
  // Best-effort extractor for OpenAI/OpenResponses-style payloads.
  if (!resp || typeof resp !== 'object') return ''

  // Some servers provide output_text convenience.
  if (typeof resp.output_text === 'string') return resp.output_text

  const out = resp.output
  if (!Array.isArray(out)) return ''

  let text = ''
  for (const item of out) {
    if (!item || typeof item !== 'object') continue
    const content = item.content
    if (!Array.isArray(content)) continue
    for (const c of content) {
      if (!c || typeof c !== 'object') continue
      if (c.type === 'output_text' && typeof c.text === 'string') text += c.text
    }
  }
  return text
}

function safeJsonFromModelText(text) {
  // Tries to parse strict JSON. If the model accidentally wraps it, attempt to recover.
  if (typeof text !== 'string') throw new Error('Model returned non-text')
  const trimmed = text.trim()
  try {
    return JSON.parse(trimmed)
  } catch {}

  // Recovery: take first {...} block.
  const start = trimmed.indexOf('{')
  const end = trimmed.lastIndexOf('}')
  if (start >= 0 && end > start) {
    const slice = trimmed.slice(start, end + 1)
    return JSON.parse(slice)
  }
  throw new Error('Failed to parse JSON from model output')
}

function buildMotPreamble({ sessionId, requestId, msgBody }) {
  const type = msgBody?.type
  const payload = msgBody?.payload ?? {}

  // Keep the preamble compact: we want Mot to decide, not drown in noise.
  return `You are Mot, responding to a canvas-notepad request.\n\n` +
    `Return ONLY a JSON object with this shape:\n` +
    `{ "replyText": string, "commands": array, "edits": array }\n\n` +
    `Where commands are drawing commands with kind one of: clear | line | polyline | rect | circle | text.\n` +
    `Where edits can include { "op": "replaceStroke", "strokeId": string, "replacement": commands[] }.\n\n` +
    `Context:\n` +
    `- sessionId: ${sessionId}\n` +
    `- requestId: ${requestId}\n` +
    `- type: ${type}\n` +
    `- payload: ${JSON.stringify(payload).slice(0, 4000)}\n\n` +
    `Rules:\n` +
    `- Commands MUST be valid JSON and use pixel coords consistent with payload.canvas.{width,height}.\n` +
    `- Be conservative: if unsure, replyText should ask a brief clarification.\n`
}

async function callMotViaOpenClaw({ sessionId, userText }) {
  const url = env('OPENCLAW_GATEWAY_URL', 'http://127.0.0.1:18789')
  const token = requiredEnv('OPENCLAW_GATEWAY_TOKEN')

  const bodyTemplate = {
    model: env('OPENCLAW_AGENT', 'openclaw:main'),
    user: `canvas:${sessionId}`,
    input: [
      {
        type: 'message',
        role: 'user',
        content: [{ type: 'input_text', text: clampStr(userText, 20000) }],
      },
    ],
    stream: env('OPENCLAW_STREAM', 'true') === 'true',
    max_output_tokens: Number(env('OPENCLAW_MAX_OUTPUT_TOKENS', '700')),
  }

  // Retry logic
  const maxAttempts = Number(env('OPENCLAW_RETRY_ATTEMPTS', '2'))
  const timeoutMs = Number(env('OPENCLAW_TIMEOUT_MS', '90000'))

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController()
    const t = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const body = bodyTemplate
      const res = await fetch(`${url.replace(/\/$/, '')}/v1/responses`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      })

      if (!res.ok) {
        // Capture response details for debugging
        const text = await res.text().catch(() => '')
        console.error('[mot-worker] OpenClaw non-OK response', { attempt, status: res.status, bodySnippet: text.slice(0, 2000) })
        // If last attempt, throw to be handled by caller
        if (attempt === maxAttempts) throw new Error(`OpenClaw /v1/responses failed: ${res.status} ${text}`)
        // otherwise retry after a short backoff
        await new Promise((r) => setTimeout(r, 500 * attempt))
        continue
      }

      if (!res.body) {
        console.error('[mot-worker] OpenClaw response missing body', { attempt })
        if (attempt === maxAttempts) throw new Error('OpenClaw /v1/responses: missing response body')
        await new Promise((r) => setTimeout(r, 500 * attempt))
        continue
      }

      // Stream reader
      const reader = res.body.getReader()
      const decoder = new TextDecoder('utf-8')

      let buf = ''
      let outText = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })

        // SSE frames are separated by blank lines.
        while (true) {
          const sep = buf.indexOf('\n\n')
          if (sep === -1) break
          const frame = buf.slice(0, sep)
          buf = buf.slice(sep + 2)

          // Only care about data: lines
          const dataLines = frame
            .split('\n')
            .filter((l) => l.startsWith('data:'))
            .map((l) => l.replace(/^data:\s?/, ''))

          for (const dl of dataLines) {
            if (!dl || dl === '[DONE]') continue
            let obj
            try {
              obj = JSON.parse(dl)
            } catch {
              // non-json data; ignore but keep reading
              continue
            }

            // Text deltas
            if (obj?.type === 'response.output_text.delta' && typeof obj.delta === 'string') {
              outText += obj.delta
            }

            // Some servers may emit content parts with text.
            if (
              obj?.type === 'response.content_part.added' &&
              obj?.part?.type === 'output_text' &&
              typeof obj?.part?.text === 'string'
            ) {
              // part.added may include empty text; ignore (deltas will follow)
            }

            // Completion signals
            if (obj?.type === 'response.output_text.done') {
              if (typeof obj.text === 'string' && obj.text.length) outText = obj.text
            }

            if (obj?.type === 'response.completed' || obj?.type === 'response.failed') {
              return outText
            }
          }
        }
      }

      return outText
    } catch (err) {
      console.error('[mot-worker] OpenClaw call error', { attempt, err: String(err) })
      if (attempt === maxAttempts) throw err
      await new Promise((r) => setTimeout(r, 500 * attempt))
    } finally {
      // ensure timer cleared
      try { clearTimeout(t) } catch {}
    }
  }

  throw new Error('OpenClaw /v1/responses: exhausted retries')
}

async function motHandleRequest(msgBody) {
  const text = msgBody?.payload?.text
  const requestId = msgBody?.requestId
  const sessionId = msgBody?.sessionId

  const preamble = buildMotPreamble({ sessionId, requestId, msgBody })
  const userText = `${preamble}\nUser says: ${text ? String(text) : '[no text]'}\n`

  // Verbose logging when enabled
  const verbose = env('MOT_WORKER_VERBOSE', 'false') === 'true'
  if (verbose) {
    console.log('[mot-worker] verbose: calling Mot with userText snippet:', userText.slice(0, 800))
  }

  const modelText = await callMotViaOpenClaw({ sessionId, userText })

  if (verbose) {
    console.log('[mot-worker] verbose: raw modelText:', String(modelText))
  }

  let parsed
  try {
    parsed = safeJsonFromModelText(modelText)
  } catch (err) {
    // Surface full modelText for debugging when parsing fails
    console.error('[mot-worker] model returned invalid JSON', {
      requestId,
      sessionId,
      err: String(err),
      modelText: String(modelText),
    })
    throw err
  }

  const replyText = typeof parsed.replyText === 'string' ? parsed.replyText : 'OK.'
  const commands = Array.isArray(parsed.commands) ? parsed.commands : []
  const edits = Array.isArray(parsed.edits) ? parsed.edits : []

  if (verbose) {
    console.log('[mot-worker] verbose: parsed result', {
      requestId,
      sessionId,
      replyTextLen: replyText?.length ?? 0,
      commands: { count: commands.length, kinds: commands.map(c => c.kind).slice(0,10) },
      edits: { count: edits.length },
    })
  }

  return { replyText, commands, edits }
}

async function main() {
  const sbNamespace = requiredEnv('SERVICEBUS_NAMESPACE') // e.g. mot-dev-sbus-01.servicebus.windows.net
  const queueName = requiredEnv('SERVICEBUS_QUEUE_NAME') // e.g. mot-requests

  const credential = new DefaultAzureCredential()
  const sb = new ServiceBusClient(sbNamespace, credential)
  const receiver = sb.createReceiver(queueName, {
    // lockRenewal = keep message locked while we work
    maxAutoLockRenewalDurationInMs: 5 * 60 * 1000,
  })

  const pubsub = getPubSubSender()
  const hub = pubsub.hub

  const maxConcurrentCalls = Number(process.env.MAX_CONCURRENT_CALLS ?? '4')
  const prefetchCount = Number(process.env.PREFETCH_COUNT ?? '20')
  receiver.prefetchCount = prefetchCount

  console.log(`[mot-worker] starting. queue=${queueName} sb=${sbNamespace} hub=${hub}`)

  const sub = receiver.subscribe(
    {
      processMessage: async (m) => {
        const body = m.body

        const requestId = body?.requestId
        const sessionId = body?.sessionId
        if (!requestId || !sessionId) {
          console.warn('[mot-worker] invalid message (missing requestId/sessionId), dead-lettering')
          await receiver.deadLetterMessage(m, {
            deadLetterReason: 'InvalidMessage',
            deadLetterErrorDescription: 'Missing requestId/sessionId',
          })
          return
        }

        try {
          const group = groupNameForSession(sessionId)

          // Verbose: log full incoming message body when enabled
          if (env('MOT_WORKER_VERBOSE', 'false') === 'true') {
            try {
              console.log('[mot-worker] verbose: incoming message body', JSON.stringify(body))
            } catch (e) {
              console.log('[mot-worker] verbose: incoming message body (stringified failed)', String(body))
            }
          }

          // 1) do Mot work
          const res = await motHandleRequest(body)

          // 2) publish to PubSub group
          const evt = toResponseEvent({ requestId, sessionId, ...res })

          if (env('MOT_WORKER_VERBOSE', 'false') === 'true') {
            try {
              console.log('[mot-worker] verbose: outgoing event', JSON.stringify(evt))
            } catch (e) {
              console.log('[mot-worker] verbose: outgoing event (stringify failed)', String(evt))
            }
          }

          await pubsub.sendToGroup(group, evt)

          // 3) complete message
          await receiver.completeMessage(m)
          console.log('[mot-worker] processed', { requestId, sessionId })
        } catch (err) {
          console.error('[mot-worker] processing failed', {
            requestId,
            sessionId,
            err: String(err),
          })
          // Important: avoid burning delivery attempts forever; dead-letter on repeated failures.
          const dc = m.deliveryCount ?? 0
          if (dc >= 5) {
            await receiver.deadLetterMessage(m, {
              deadLetterReason: 'ProcessingFailed',
              deadLetterErrorDescription: String(err).slice(0, 1000),
            })
            return
          }
          await receiver.abandonMessage(m)
        }
      },
      processError: async (args) => {
        console.error('[mot-worker] receiver error', {
          entityPath: args.entityPath,
          error: args.error?.message,
          errorName: args.error?.name,
        })
      },
    },
    { maxConcurrentCalls },
  )

  async function shutdown() {
    console.log('[mot-worker] shutting down...')
    try {
      await sub.close()
    } catch {}
    try {
      await receiver.close()
    } catch {}
    try {
      await sb.close()
    } catch {}
    process.exit(0)
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

main().catch((err) => {
  console.error('[mot-worker] fatal', String(err))
  process.exit(1)
})
