import type { DrawingCommand, NotepadState, Stroke } from './drawingTypes'

export type RenderOptions = {
  background?: string
}

function drawStroke(ctx: CanvasRenderingContext2D, stroke: Stroke) {
  if (stroke.points.length < 2) return
  ctx.save()
  ctx.strokeStyle = stroke.color
  ctx.lineWidth = stroke.width
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  const pts = stroke.points
  ctx.beginPath()
  ctx.moveTo(pts[0].x, pts[0].y)

  // basic smoothing via quadratic midpoints
  for (let i = 1; i < pts.length - 1; i++) {
    const p0 = pts[i]
    const p1 = pts[i + 1]
    const mx = (p0.x + p1.x) / 2
    const my = (p0.y + p1.y) / 2
    ctx.quadraticCurveTo(p0.x, p0.y, mx, my)
  }
  const last = pts[pts.length - 1]
  ctx.lineTo(last.x, last.y)
  ctx.stroke()
  ctx.restore()
}

function drawCommand(ctx: CanvasRenderingContext2D, cmd: DrawingCommand) {
  switch (cmd.kind) {
    case 'line': {
      ctx.save()
      ctx.strokeStyle = cmd.color ?? '#1e3a8a'
      ctx.lineWidth = cmd.width ?? 3
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(cmd.from.x, cmd.from.y)
      ctx.lineTo(cmd.to.x, cmd.to.y)
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
      ctx.moveTo(cmd.points[0].x, cmd.points[0].y)
      for (let i = 1; i < cmd.points.length; i++) {
        ctx.lineTo(cmd.points[i].x, cmd.points[i].y)
      }
      ctx.stroke()
      ctx.restore()
      return
    }

    case 'rect': {
      ctx.save()
      if (cmd.fillColor) {
        ctx.fillStyle = cmd.fillColor
        ctx.fillRect(cmd.x, cmd.y, cmd.w, cmd.h)
      }
      ctx.strokeStyle = cmd.strokeColor ?? '#1e3a8a'
      ctx.lineWidth = cmd.strokeWidth ?? 3
      ctx.strokeRect(cmd.x, cmd.y, cmd.w, cmd.h)
      ctx.restore()
      return
    }

    case 'circle': {
      ctx.save()
      ctx.beginPath()
      ctx.arc(cmd.cx, cmd.cy, cmd.r, 0, Math.PI * 2)
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
      ctx.fillText(cmd.text, cmd.x, cmd.y)
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

  const { width, height, dpr } = state.canvas

  // draw in CSS pixels; back-buffer uses device pixels.
  ctx.save()
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, width, height)
  if (opts.background) {
    ctx.fillStyle = opts.background
    ctx.fillRect(0, 0, width, height)
  }
  ctx.restore()

  ctx.save()
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

  // Keep deterministic order: Mot commands first, then user strokes (so user ink stays visible).
  for (const c of state.motCommands) drawCommand(ctx, c)
  for (const s of state.strokes) drawStroke(ctx, s)

  ctx.restore()
}

export function getDisplaySize(container: HTMLElement) {
  const rect = container.getBoundingClientRect()
  const width = Math.max(1, Math.floor(rect.width))
  const height = Math.max(1, Math.floor(rect.height))
  return { width, height }
}

export function resizeCanvasToDisplaySize(
  canvas: HTMLCanvasElement,
  container: HTMLElement,
  dpr: number,
) {
  const { width, height } = getDisplaySize(container)

  const nextW = Math.floor(width * dpr)
  const nextH = Math.floor(height * dpr)

  if (canvas.width !== nextW || canvas.height !== nextH) {
    canvas.width = nextW
    canvas.height = nextH
  }

  return { width, height }
}
