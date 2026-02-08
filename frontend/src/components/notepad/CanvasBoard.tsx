import { useEffect, useMemo, useRef, useState } from 'react'
import type { NotepadState, Stroke, StrokePoint } from '../../notepad/drawingTypes'
import { renderNotepad, resizeCanvasToDisplaySize } from '../../notepad/render'
import { addPoint, commitStroke, createStroke, redo, undo } from '../../notepad/strokes'

type Props = {
  state: NotepadState
  onChange: (next: NotepadState) => void
}

function newId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function clamp01(v: number) {
  return Math.min(1, Math.max(0, v))
}

function pointFromEvent(canvas: HTMLCanvasElement, e: PointerEvent): StrokePoint {
  const rect = canvas.getBoundingClientRect()
  const x = clamp01((e.clientX - rect.left) / rect.width)
  const y = clamp01((e.clientY - rect.top) / rect.height)
  return { x, y, t: Date.now() }
}

export default function CanvasBoard({ state, onChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [penColor, setPenColor] = useState('#000000')
  const [penWidth, setPenWidth] = useState(4)

  const canUndo = state.strokes.length > 0
  const canRedo = state.undoneStrokes.length > 0

  const drawingRef = useRef<{
    active: boolean
    stroke: Stroke | null
    pointerId: number | null
  }>({
    active: false,
    stroke: null,
    pointerId: null,
  })

  const dpr = useMemo(() => (typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1), [])

  // Resize observer to keep canvas crisp and preserve content via re-render.
  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const ro = new ResizeObserver(() => {
      resizeCanvasToDisplaySize(canvas, dpr)
      renderNotepad(canvas, state)
    })
    ro.observe(container)

    // initial
    resizeCanvasToDisplaySize(canvas, dpr)
    renderNotepad(canvas, state)

    return () => ro.disconnect()
  }, [dpr, state])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    renderNotepad(canvas, state)
  }, [state])

  useEffect(() => {
    const maybeCanvas = canvasRef.current
    if (!maybeCanvas) return
    const canvasEl: HTMLCanvasElement = maybeCanvas

    function onPointerDown(e: PointerEvent) {
      if (e.button !== 0 && e.pointerType === 'mouse') return
      canvasEl.setPointerCapture(e.pointerId)
      const start = pointFromEvent(canvasEl, e)
      const stroke = createStroke({ id: newId(), color: penColor, width: penWidth, start })
      drawingRef.current = { active: true, stroke, pointerId: e.pointerId }

      // Render live stroke on top by temporarily appending it.
      onChange({ ...state, strokes: [...state.strokes, stroke] })
      e.preventDefault()
    }

    function onPointerMove(e: PointerEvent) {
      const d = drawingRef.current
      if (!d.active || !d.stroke || d.pointerId !== e.pointerId) return
      const p = pointFromEvent(canvasEl, e)
      d.stroke = addPoint(d.stroke, p)
      drawingRef.current = d

      // Replace the last stroke (live) for smooth feedback.
      const strokes = state.strokes.slice(0, -1)
      onChange({ ...state, strokes: [...strokes, d.stroke] })
      e.preventDefault()
    }

    function endPointer(e: PointerEvent) {
      const d = drawingRef.current
      if (!d.active || !d.stroke || d.pointerId !== e.pointerId) return

      // Commit final stroke and clear redo stack.
      const baseHistory = {
        strokes: state.strokes.slice(0, -1),
        undoneStrokes: state.undoneStrokes,
      }
      const history = commitStroke(baseHistory, d.stroke)
      onChange({ ...state, strokes: history.strokes, undoneStrokes: history.undoneStrokes })

      drawingRef.current = { active: false, stroke: null, pointerId: null }
      e.preventDefault()
    }

    canvasEl.addEventListener('pointerdown', onPointerDown)
    canvasEl.addEventListener('pointermove', onPointerMove)
    canvasEl.addEventListener('pointerup', endPointer)
    canvasEl.addEventListener('pointercancel', endPointer)

    return () => {
      canvasEl.removeEventListener('pointerdown', onPointerDown)
      canvasEl.removeEventListener('pointermove', onPointerMove)
      canvasEl.removeEventListener('pointerup', endPointer)
      canvasEl.removeEventListener('pointercancel', endPointer)
    }
  }, [penColor, penWidth, state, onChange])

  function onClear() {
    onChange({ strokes: [], undoneStrokes: [], motCommands: [] })
  }

  function onUndo() {
    const h = undo(state)
    onChange({ ...state, ...h })
  }

  function onRedo() {
    const h = redo(state)
    onChange({ ...state, ...h })
  }

  function onExportPng() {
    const canvas = canvasRef.current
    if (!canvas) return

    const url = canvas.toDataURL('image/png')
    const a = document.createElement('a')
    a.href = url
    a.download = `canvas-notepad-${Date.now()}.png`
    a.click()
  }

  return (
    <section className="notepad-canvas" aria-label="Canvas notepad">
      <div className="notepad-canvas__toolbar" aria-label="Canvas controls">
        <label className="np-field">
          <span className="np-field__label">Color</span>
          <input
            aria-label="Pen color"
            type="color"
            value={penColor}
            onChange={(e) => setPenColor(e.target.value)}
          />
        </label>

        <label className="np-field np-field--wide">
          <span className="np-field__label">Width</span>
          <input
            aria-label="Pen width"
            type="range"
            min={1}
            max={20}
            value={penWidth}
            onChange={(e) => setPenWidth(Number(e.target.value))}
          />
          <span className="np-field__value" aria-label="Pen width value">
            {penWidth}
          </span>
        </label>

        <div className="np-actions" role="group" aria-label="Actions">
          <button type="button" className="np-btn" onClick={onClear} title="Clear canvas">
            Clear
          </button>
          <button
            type="button"
            className="np-btn"
            onClick={onUndo}
            disabled={!canUndo}
            title="Undo last stroke"
          >
            Undo
          </button>
          <button
            type="button"
            className="np-btn"
            onClick={onRedo}
            disabled={!canRedo}
            title="Redo"
          >
            Redo
          </button>
          <button
            type="button"
            className="np-btn np-btn--primary"
            onClick={onExportPng}
            title="Export as PNG"
          >
            Export PNG
          </button>
        </div>
      </div>

      <div className="notepad-canvas__surface" ref={containerRef}>
        <canvas
          ref={canvasRef}
          className="notepad-canvas__canvas"
          aria-label="Drawing canvas"
          style={{ touchAction: 'none' }}
        />
      </div>
    </section>
  )
}
