import type {
  CanvasMeta,
  CircleCommand,
  ClearCommand,
  DrawingCommand,
  LineCommand,
  NotepadState,
  Point,
  PolylineCommand,
  RectCommand,
  TextCommand,
} from './drawingTypes'

const DEFAULT_STROKE_COLOR = '#1e3a8a' // Mot blue
const DEFAULT_STROKE_WIDTH = 3

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

function clampPx(v: number, min: number, max: number): number {
  if (!Number.isFinite(v)) return min
  return Math.min(max, Math.max(min, v))
}

export function clampPoint(p: Point, canvas: CanvasMeta): Point {
  return {
    x: clampPx(p.x, 0, canvas.width),
    y: clampPx(p.y, 0, canvas.height),
  }
}

export type ValidationResult = {
  ok: boolean
  command?: DrawingCommand
  reason?: string
}

export function validateCommand(cmd: DrawingCommand, canvas: CanvasMeta): ValidationResult {
  switch (cmd.kind) {
    case 'clear':
      return { ok: true, command: cmd satisfies ClearCommand }

    case 'line': {
      const c = cmd as LineCommand
      if (!c.from || !c.to) return { ok: false, reason: 'line missing from/to' }
      if (
        !isFiniteNumber(c.from.x) ||
        !isFiniteNumber(c.from.y) ||
        !isFiniteNumber(c.to.x) ||
        !isFiniteNumber(c.to.y)
      ) {
        return { ok: false, reason: 'line has non-numeric coords' }
      }
      return {
        ok: true,
        command: {
          ...c,
          from: clampPoint(c.from, canvas),
          to: clampPoint(c.to, canvas),
          color: c.color ?? DEFAULT_STROKE_COLOR,
          width: clampWidth(c.width ?? DEFAULT_STROKE_WIDTH),
        },
      }
    }

    case 'polyline': {
      const c = cmd as PolylineCommand
      if (!Array.isArray(c.points) || c.points.length < 2)
        return { ok: false, reason: 'polyline needs 2+ points' }
      const points: Point[] = []
      for (const p of c.points) {
        if (!p || !isFiniteNumber((p as Point).x) || !isFiniteNumber((p as Point).y))
          return { ok: false, reason: 'polyline has non-numeric point' }
        points.push(clampPoint(p as Point, canvas))
      }
      return {
        ok: true,
        command: {
          ...c,
          points,
          color: c.color ?? DEFAULT_STROKE_COLOR,
          width: clampWidth(c.width ?? DEFAULT_STROKE_WIDTH),
        },
      }
    }

    case 'rect': {
      const c = cmd as RectCommand
      if (
        !isFiniteNumber(c.x) ||
        !isFiniteNumber(c.y) ||
        !isFiniteNumber(c.w) ||
        !isFiniteNumber(c.h)
      ) {
        return { ok: false, reason: 'rect has non-numeric fields' }
      }

      // Normalize negative widths/heights so a model can specify either direction.
      // Without this, negative w/h get clamped to 0 and the rect becomes invisible.
      let x = c.x
      let y = c.y
      let w0 = c.w
      let h0 = c.h
      if (w0 < 0) {
        x = x + w0
        w0 = -w0
      }
      if (h0 < 0) {
        y = y + h0
        h0 = -h0
      }

      const w = clampPx(w0, 0, canvas.width)
      const h = clampPx(h0, 0, canvas.height)
      return {
        ok: true,
        command: {
          ...c,
          x: clampPx(x, 0, canvas.width),
          y: clampPx(y, 0, canvas.height),
          w,
          h,
          strokeColor: c.strokeColor ?? DEFAULT_STROKE_COLOR,
          strokeWidth: clampWidth(c.strokeWidth ?? DEFAULT_STROKE_WIDTH),
          fillColor: c.fillColor,
        },
      }
    }

    case 'circle': {
      const c = cmd as CircleCommand
      if (!isFiniteNumber(c.cx) || !isFiniteNumber(c.cy) || !isFiniteNumber(c.r)) {
        return { ok: false, reason: 'circle has non-numeric fields' }
      }
      return {
        ok: true,
        command: {
          ...c,
          cx: clampPx(c.cx, 0, canvas.width),
          cy: clampPx(c.cy, 0, canvas.height),
          r: clampPx(c.r, 0, Math.max(canvas.width, canvas.height)),
          strokeColor: c.strokeColor ?? DEFAULT_STROKE_COLOR,
          strokeWidth: clampWidth(c.strokeWidth ?? DEFAULT_STROKE_WIDTH),
          fillColor: c.fillColor,
        },
      }
    }

    case 'text': {
      const c = cmd as TextCommand
      if (!isFiniteNumber(c.x) || !isFiniteNumber(c.y))
        return { ok: false, reason: 'text has non-numeric x/y' }
      if (typeof c.text !== 'string' || c.text.trim().length === 0)
        return { ok: false, reason: 'text missing' }
      const fontSize = clampFontSize(c.fontSize ?? 20)
      return {
        ok: true,
        command: {
          ...c,
          x: clampPx(c.x, 0, canvas.width),
          y: clampPx(c.y, 0, canvas.height),
          text: c.text,
          fontSize,
          color: c.color ?? DEFAULT_STROKE_COLOR,
        },
      }
    }

    default:
      return { ok: false, reason: 'unknown command kind' }
  }
}

export function validateCommands(commands: DrawingCommand[], canvas: CanvasMeta): DrawingCommand[] {
  const out: DrawingCommand[] = []
  for (const cmd of commands) {
    const res = validateCommand(cmd, canvas)
    if (res.ok && res.command) out.push(res.command)
  }
  return out
}

function clampWidth(v: number): number {
  if (!Number.isFinite(v)) return DEFAULT_STROKE_WIDTH
  return Math.min(40, Math.max(1, v))
}

function clampFontSize(v: number): number {
  if (!Number.isFinite(v)) return 20
  return Math.min(96, Math.max(8, v))
}

export function applyCommands(state: NotepadState, commands: DrawingCommand[]): NotepadState {
  // Commands are Mot-generated and do not affect user undo/redo stacks.
  let next: NotepadState = state
  for (const cmd of commands) {
    if (cmd.kind === 'clear') {
      next = { ...next, strokes: [], undoneStrokes: [], motCommands: [] }
      continue
    }
    next = { ...next, motCommands: [...next.motCommands, cmd] }
  }
  return next
}
