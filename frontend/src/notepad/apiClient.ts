import type { RequestMessageV1 } from './protocol'

export type NegotiateResponse = {
  url: string
  hub: string
  group: string
}

export class NegotiateError extends Error {
  status?: number
  url?: string
  redirected?: boolean
  contentType?: string | null

  constructor(message: string, opts?: { status?: number; url?: string; redirected?: boolean; contentType?: string | null }) {
    super(message)
    this.name = 'NegotiateError'
    this.status = opts?.status
    this.url = opts?.url
    this.redirected = opts?.redirected
    this.contentType = opts?.contentType
  }
}

export async function negotiate(sessionId: string): Promise<NegotiateResponse> {
  const res = await fetch(`/api/mot/negotiate?sessionId=${encodeURIComponent(sessionId)}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    // Be explicit: if SWA auth uses cookies, ensure we send them.
    credentials: 'include',
  })

  const contentType = res.headers.get('content-type')

  if (!res.ok) {
    throw new NegotiateError(`negotiate failed: ${res.status}`, {
      status: res.status,
      url: res.url,
      redirected: res.redirected,
      contentType,
    })
  }

  // If SWA redirects to /.auth/*, fetch may return HTML. Detect this so Debug can show what's happening.
  if (!contentType || !contentType.includes('application/json')) {
    throw new NegotiateError('negotiate non-json response', {
      status: res.status,
      url: res.url,
      redirected: res.redirected,
      contentType,
    })
  }

  const data = (await res.json()) as Partial<NegotiateResponse>
  if (!data.url || !data.group || !data.hub) {
    throw new NegotiateError('negotiate invalid response', {
      status: res.status,
      url: res.url,
      redirected: res.redirected,
      contentType,
    })
  }
  return data as NegotiateResponse
}

export async function postMotRequest(req: RequestMessageV1): Promise<{ requestId: string }> {
  const res = await fetch('/api/mot/requests', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(req),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`request failed: ${res.status} ${text}`)
  }
  const data = (await res.json()) as Partial<{ requestId: string }>
  if (!data.requestId) throw new Error('request missing requestId')
  return { requestId: data.requestId }
}
