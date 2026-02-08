import type { DrawingCommand, NotepadState, Stroke, UnitPoint } from './drawingTypes'

export type RenderOptions = {
  background?: string
}

function toPxX(p: UnitPoint, width: number) {
  return p.x * width
}

function toPxY(p: UnitPoint, height: number) {
  return p.y * height
}

function drawStroke(ctx: CanvasRenderingContext2D, stroke: Stroke, w: number, h: number) {
  if (stroke.points.length < 2) return
  ctx.save()
  ctx.strokeStyle = stroke.color
  ctx.lineWidth = stroke.width
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  const pts = stroke.points
  ctx.beginPath()
  ctx.moveTo(toPxX(pts[0], w), toPxY(pts[0], h))

  // basic smoothing via quadratic midpoints
  for (let i = 1; i < pts.length - 1; i++) {
    const p0 = pts[i]
    const p1 = pts[i + 1]
    const mx = (toPxX(p0, w) + toPxX(p1, w)) / 2
    const my = (toPxY(p0, h) + toPxY(p1, h)) / 2
    ctx.quadraticCurveTo(toPxX(p0, w), toPxY(p0, h), mx, my)
  }
  const last = pts[pts.length - 1]
  ctx.lineTo(toPxX(last, w), toPxY(last, h))
  ctx.stroke()
  ctx.restore()
}

function drawCommand(ctx: CanvasRenderingContext2D, cmd: DrawingCommand, w: number, h: number) {
  switch (cmd.kind) {
    case 'line': {
      ctx.save()
      ctx.strokeStyle = cmd.color ?? '#1e3a8a'
      ctx.lineWidth = cmd.width ?? 3
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(cmd.from.x * w, cmd.from.y * h)
      ctx.lineTo(cmd.to.x * w, cmd.to.y * h)
      ctx.stroke()
      ctx.restore()
      return
    }

    case 'polyline': {
      if (cmd.points.length < 2) return
      ctx.save()
      ctx.strokeStyle = cmd.color ?? '#1e3a8a'
      ctx.lineWidth = cmd.width ?? 3
      ctx.lineJoin = 'round'
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(cmd.points[0].x * w, cmd.points[0].y * h)
      for (let i = 1; i < cmd.points.length; i++) {
        ctx.lineTo(cmd.points[i].x * w, cmd.points[i].y * h)
      }
      ctx.stroke()
      ctx.restore()
      return
    }

    case 'rect': {
      ctx.save()
      const x = cmd.x * w
      const y = cmd.y * h
      const rw = cmd.w * w
      const rh = cmd.h * h
      if (cmd.fillColor) {
        ctx.fillStyle = cmd.fillColor
        ctx.fillRect(x, y, rw, rh)
      }
      ctx.strokeStyle = cmd.strokeColor ?? '#1e3a8a'
      ctx.lineWidth = cmd.strokeWidth ?? 3
      ctx.strokeRect(x, y, rw, rh)
      ctx.restore()
      return
    }

    case 'circle': {
      ctx.save()
      const cx = cmd.cx * w
      const cy = cmd.cy * h
      const r = cmd.r * Math.min(w, h)
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      if (cmd.fillColor) {
        ctx.fillStyle = cmd.fillColor
        ctx.fill()
      }
      ctx.strokeStyle = cmd.strokeColor ?? '#1e3a8a'
      ctx.lineWidth = cmd.strokeWidth ?? 3
      ctx.stroke()
      ctx.restore()
      return
    }

    case 'text': {
      ctx.save()
      ctx.fillStyle = cmd.color ?? '#1e3a8a'
      ctx.font = `${cmd.fontSize ?? 20}px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial`
      ctx.textBaseline = 'top'
      ctx.fillText(cmd.text, cmd.x * w, cmd.y * h)
      ctx.restore()
      return
    }

    case 'clear':
      return
  }
}

export function renderNotepad(
  canvas: HTMLCanvasElement,
  state: NotepadState,
  opts: RenderOptions = {},
) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const w = canvas.width
  const h = canvas.height

  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, w, h)
  if (opts.background) {
    ctx.fillStyle = opts.background
    ctx.fillRect(0, 0, w, h)
  }
  ctx.restore()

  // Keep deterministic order: user strokes first, then Mot commands.
  for (const s of state.strokes) drawStroke(ctx, s, w, h)
  for (const c of state.motCommands) drawCommand(ctx, c, w, h)
}

export function resizeCanvasToDisplaySize(canvas: HTMLCanvasElement, dpr: number) {
  const parent = canvas.parentElement
  if (!parent) return
  const rect = parent.getBoundingClientRect()
  const displayWidth = Math.max(1, Math.floor(rect.width))
  const displayHeight = Math.max(1, Math.floor(rect.height))

  const nextW = Math.floor(displayWidth * dpr)
  const nextH = Math.floor(displayHeight * dpr)

  if (canvas.width !== nextW || canvas.height !== nextH) {
    canvas.width = nextW
    canvas.height = nextH
  }
}
