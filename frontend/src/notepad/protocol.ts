import type { CanvasMeta, DrawingCommand, Stroke } from './drawingTypes'

export type RequestType = 'chat_draw' | 'stroke_sharpen'

export type RequestMessageV1 = {
  v: 1
  requestId: string
  sessionId: string
  type: RequestType
  createdAt: string // ISO
  payload: {
    text?: string
    canvas: CanvasMeta
    stroke?: Stroke
  }
}

export type ReplaceStrokeEditV1 = {
  op: 'replaceStroke'
  strokeId: string
  replacement: DrawingCommand[]
  confidence: number
}

export type ResponseEventV1 = {
  v: 1
  requestId: string
  sessionId: string
  createdAt: string
  replyText: string
  commands: DrawingCommand[]
  edits: ReplaceStrokeEditV1[]
}

export const LIMITS = {
  maxTextLen: 2000,
  maxStrokePoints: 2000,
  maxCommands: 200,
} as const

export function clampStrokeForSend(stroke: Stroke, canvas: CanvasMeta): Stroke {
  const maxPts = LIMITS.maxStrokePoints
  const points = stroke.points.slice(0, maxPts).map((p) => ({
    x: clampPx(p.x, 0, canvas.width),
    y: clampPx(p.y, 0, canvas.height),
    t: p.t,
  }))
  return { ...stroke, points, width: clampPx(stroke.width, 1, 30) }
}

function clampPx(v: number, min: number, max: number): number {
  if (!Number.isFinite(v)) return min
  return Math.min(max, Math.max(min, v))
}

export function safeParseResponseEvent(json: unknown): ResponseEventV1 | null {
  if (!json || typeof json !== 'object') return null
  const o = json as Partial<ResponseEventV1>
  if (o.v !== 1) return null
  if (typeof o.requestId !== 'string' || typeof o.sessionId !== 'string') return null
  if (typeof o.createdAt !== 'string' || typeof o.replyText !== 'string') return null
  if (!Array.isArray(o.commands) || !Array.isArray(o.edits)) return null
  // deeper validation happens when applying
  return o as ResponseEventV1
}
