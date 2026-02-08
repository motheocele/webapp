import type { RequestMessageV1 } from './protocol'

export type NegotiateResponse = {
  url: string
  hub: string
  group: string
}

export async function negotiate(sessionId: string): Promise<NegotiateResponse> {
  const res = await fetch(`/api/mot/negotiate?sessionId=${encodeURIComponent(sessionId)}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) {
    throw new Error(`negotiate failed: ${res.status}`)
  }
  const data = (await res.json()) as Partial<NegotiateResponse>
  if (!data.url || !data.group || !data.hub) throw new Error('negotiate invalid response')
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
