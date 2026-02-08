import type {
  CircleCommand,
  ClearCommand,
  DrawingCommand,
  LineCommand,
  NotepadState,
  PolylineCommand,
  RectCommand,
  TextCommand,
  Unit,
  UnitPoint,
} from './drawingTypes'

const DEFAULT_STROKE_COLOR = '#1e3a8a' // Mot blue
const DEFAULT_STROKE_WIDTH = 3

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

export function clampUnit(v: number): Unit {
  if (!Number.isFinite(v)) return 0
  return Math.min(1, Math.max(0, v))
}

export function clampPoint(p: UnitPoint): UnitPoint {
  return { x: clampUnit(p.x), y: clampUnit(p.y) }
}

export type ValidationResult = {
  ok: boolean
  command?: DrawingCommand
  reason?: string
}

export function validateCommand(cmd: DrawingCommand): ValidationResult {
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
          from: clampPoint(c.from),
          to: clampPoint(c.to),
          color: c.color ?? DEFAULT_STROKE_COLOR,
          width: clampWidth(c.width ?? DEFAULT_STROKE_WIDTH),
        },
      }
    }

    case 'polyline': {
      const c = cmd as PolylineCommand
      if (!Array.isArray(c.points) || c.points.length < 2)
        return { ok: false, reason: 'polyline needs 2+ points' }
      const points: UnitPoint[] = []
      for (const p of c.points) {
        if (!p || !isFiniteNumber((p as UnitPoint).x) || !isFiniteNumber((p as UnitPoint).y))
          return { ok: false, reason: 'polyline has non-numeric point' }
        points.push(clampPoint(p as UnitPoint))
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
      const w = clampUnit(c.w)
      const h = clampUnit(c.h)
      return {
        ok: true,
        command: {
          ...c,
          x: clampUnit(c.x),
          y: clampUnit(c.y),
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
          cx: clampUnit(c.cx),
          cy: clampUnit(c.cy),
          r: clampUnit(c.r),
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
          x: clampUnit(c.x),
          y: clampUnit(c.y),
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

export function validateCommands(commands: DrawingCommand[]): DrawingCommand[] {
  const out: DrawingCommand[] = []
  for (const cmd of commands) {
    const res = validateCommand(cmd)
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
      next = { strokes: [], undoneStrokes: [], motCommands: [] }
      continue
    }
    next = { ...next, motCommands: [...next.motCommands, cmd] }
  }
  return next
}
